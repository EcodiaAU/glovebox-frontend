// RoamCarPlayBridge.swift
//
// Capacitor plugin exposing the in-process RoamCarPlaySharedState to the
// phone-app JS layer. The phone app pushes trip / route / hazard / fuel /
// vehicle / location state in; the CarPlay scene observes the resulting
// NotificationCenter notifications and re-renders.
//
// JS plugin name: RoamCarPlayBridge
// JS API:
//   setActiveTrip({routeKey, geometryPolyline6, distanceMeters,
//                  durationSeconds, originName, destinationName,
//                  waypoints: [{name,lat,lng}], maneuvers: [...]})
//   clearActiveTrip()
//   setHazards([{id,lat,lng,typeLabel,severity,headline,detail?,distanceAlongRouteMeters?}])
//   setFuelStops([{id,name,brand?,lat,lng,distanceAlongRouteMeters,isLastChance}])
//   setVehicle({litresPer100Km,tankCapacityLitres,currentFuelLitres})
//   setDriverLocation({lat,lng,headingDegrees?,speedMps?,timestampMs})
//   isCarPlayConnected() -> { connected: Bool }
//
// JS event listeners:
//   addListener("carPlayConnected",     ({}) => {})
//   addListener("carPlayDisconnected",  ({}) => {})
//   addListener("carPlayDestinationPicked", ({name,lat,lng}) => {})
//   addListener("carPlayHazardAcknowledged", ({hazardId}) => {})

import Foundation
import Capacitor
import os.log

@available(iOS 14.0, *)
@objc(RoamCarPlayBridgePlugin)
public class RoamCarPlayBridgePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "RoamCarPlayBridgePlugin"
    public let jsName = "RoamCarPlayBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setActiveTrip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearActiveTrip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHazards", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFuelStops", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVehicle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setDriverLocation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isCarPlayConnected", returnType: CAPPluginReturnPromise),
    ]

    private static let logger = Logger(subsystem: "au.ecodia.roam", category: "carplay.bridge")

    // Location-update rate limit. The phone-side JS layer can push raw
    // CoreLocation updates at up to 10Hz; each push fans out into hazard
    // proximity, fuel range, maneuver refresh, and map region update on
    // the CarPlay side. We coalesce sub-second pushes into the most-recent
    // value, with a 1s minimum interval between bridge writes.
    private static let locationDebounceInterval: TimeInterval = 1.0
    private let locationQueue = DispatchQueue(label: "au.ecodia.roam.carplay.bridge.location")
    private var lastLocationWriteTs: TimeInterval = 0
    private var pendingLocation: RoamCarPlaySharedState.DriverLocation?
    private var pendingFlushScheduled = false

    // MARK: - Setup

    override public func load() {
        // Forward CarPlay scene lifecycle + driver picks back to JS.
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleSceneConnected),
            name: RoamCarPlayBridgePlugin.sceneConnectedNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleSceneDisconnected),
            name: RoamCarPlayBridgePlugin.sceneDisconnectedNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleDestinationPicked(_:)),
            name: RoamCarPlayBridgePlugin.destinationPickedNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleHazardAcknowledged(_:)),
            name: RoamCarPlayBridgePlugin.hazardAcknowledgedNotification, object: nil
        )
    }

    // MARK: - CarPlay scene -> JS notifications (posted from the scene delegate)

    static let sceneConnectedNotification = Notification.Name("RoamCarPlaySceneConnected")
    static let sceneDisconnectedNotification = Notification.Name("RoamCarPlaySceneDisconnected")
    static let destinationPickedNotification = Notification.Name("RoamCarPlayDestinationPicked")
    static let hazardAcknowledgedNotification = Notification.Name("RoamCarPlayHazardAcknowledged")

    @objc private func handleSceneConnected() {
        notifyListeners("carPlayConnected", data: [:])
    }
    @objc private func handleSceneDisconnected() {
        notifyListeners("carPlayDisconnected", data: [:])
    }
    @objc private func handleDestinationPicked(_ note: Notification) {
        guard let info = note.userInfo else { return }
        notifyListeners("carPlayDestinationPicked", data: info as? [String: Any] ?? [:])
    }
    @objc private func handleHazardAcknowledged(_ note: Notification) {
        guard let info = note.userInfo else { return }
        notifyListeners("carPlayHazardAcknowledged", data: info as? [String: Any] ?? [:])
    }

    // MARK: - JS -> CarPlay scene (state writes)

    @objc func setActiveTrip(_ call: CAPPluginCall) {
        guard let routeKey = call.getString("routeKey"),
              let geometry = call.getString("geometryPolyline6"),
              let distance = call.getDouble("distanceMeters"),
              let duration = call.getDouble("durationSeconds"),
              let originName = call.getString("originName"),
              let destinationName = call.getString("destinationName") else {
            call.reject("Missing required trip fields")
            return
        }

        let waypoints = (call.getArray("waypoints") as? [[String: Any]] ?? []).compactMap { dict -> RoamCarPlaySharedState.Waypoint? in
            guard let name = dict["name"] as? String,
                  let lat = dict["lat"] as? Double,
                  let lng = dict["lng"] as? Double else { return nil }
            return RoamCarPlaySharedState.Waypoint(name: name, lat: lat, lng: lng)
        }

        let maneuvers = (call.getArray("maneuvers") as? [[String: Any]] ?? []).compactMap { dict -> RoamCarPlaySharedState.Maneuver? in
            guard let instruction = dict["instruction"] as? String,
                  let lat = dict["lat"] as? Double,
                  let lng = dict["lng"] as? Double,
                  let dist = dict["distanceFromStartMeters"] as? Double else { return nil }
            return RoamCarPlaySharedState.Maneuver(
                instruction: instruction,
                lat: lat, lng: lng,
                distanceFromStartMeters: dist,
                modifier: dict["modifier"] as? String
            )
        }

        let trip = RoamCarPlaySharedState.Trip(
            routeKey: routeKey,
            geometryPolyline6: geometry,
            distanceMeters: distance,
            durationSeconds: duration,
            originName: originName,
            destinationName: destinationName,
            waypoints: waypoints,
            maneuvers: maneuvers
        )
        RoamCarPlaySharedState.shared.setActiveTrip(trip)
        call.resolve()
    }

    @objc func clearActiveTrip(_ call: CAPPluginCall) {
        RoamCarPlaySharedState.shared.clearActiveTrip()
        call.resolve()
    }

    @objc func setHazards(_ call: CAPPluginCall) {
        let raw = call.getArray("hazards") as? [[String: Any]] ?? []
        let mapped = raw.compactMap { dict -> RoamCarPlaySharedState.Hazard? in
            guard let id = dict["id"] as? String,
                  let lat = dict["lat"] as? Double,
                  let lng = dict["lng"] as? Double,
                  let typeLabel = dict["typeLabel"] as? String,
                  let severity = dict["severity"] as? String,
                  let headline = dict["headline"] as? String else { return nil }
            return RoamCarPlaySharedState.Hazard(
                id: id, lat: lat, lng: lng,
                typeLabel: typeLabel, severity: severity, headline: headline,
                detail: dict["detail"] as? String,
                distanceAlongRouteMeters: dict["distanceAlongRouteMeters"] as? Double
            )
        }
        RoamCarPlaySharedState.shared.setHazards(mapped)
        call.resolve()
    }

    @objc func setFuelStops(_ call: CAPPluginCall) {
        let raw = call.getArray("fuelStops") as? [[String: Any]] ?? []
        let mapped = raw.compactMap { dict -> RoamCarPlaySharedState.FuelStop? in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let lat = dict["lat"] as? Double,
                  let lng = dict["lng"] as? Double,
                  let dist = dict["distanceAlongRouteMeters"] as? Double,
                  let last = dict["isLastChance"] as? Bool else { return nil }
            return RoamCarPlaySharedState.FuelStop(
                id: id, name: name,
                brand: dict["brand"] as? String,
                lat: lat, lng: lng,
                distanceAlongRouteMeters: dist,
                isLastChance: last
            )
        }
        RoamCarPlaySharedState.shared.setFuelStops(mapped)
        call.resolve()
    }

    @objc func setVehicle(_ call: CAPPluginCall) {
        guard let litres100 = call.getDouble("litresPer100Km"),
              let tank = call.getDouble("tankCapacityLitres"),
              let current = call.getDouble("currentFuelLitres") else {
            call.reject("Missing vehicle fields")
            return
        }
        let v = RoamCarPlaySharedState.Vehicle(
            litresPer100Km: litres100,
            tankCapacityLitres: tank,
            currentFuelLitres: current
        )
        RoamCarPlaySharedState.shared.setVehicle(v)
        call.resolve()
    }

    @objc func setDriverLocation(_ call: CAPPluginCall) {
        guard let lat = call.getDouble("lat"),
              let lng = call.getDouble("lng"),
              let ts = call.getDouble("timestampMs") else {
            call.reject("Missing location fields")
            return
        }
        let loc = RoamCarPlaySharedState.DriverLocation(
            lat: lat, lng: lng,
            headingDegrees: call.getDouble("headingDegrees"),
            speedMps: call.getDouble("speedMps"),
            timestampMs: ts
        )
        submitDebouncedLocation(loc)
        call.resolve()
    }

    /// Coalesce high-frequency JS location pushes into at most one
    /// shared-state write per `locationDebounceInterval`. If a push arrives
    /// within the window, it overwrites the pending value (newest wins) and
    /// schedules a single trailing flush at the next allowed write time.
    private func submitDebouncedLocation(_ loc: RoamCarPlaySharedState.DriverLocation) {
        locationQueue.async { [weak self] in
            guard let self = self else { return }
            let now = Date().timeIntervalSince1970
            let elapsed = now - self.lastLocationWriteTs

            if elapsed >= Self.locationDebounceInterval {
                self.lastLocationWriteTs = now
                self.pendingLocation = nil
                self.pendingFlushScheduled = false
                RoamCarPlaySharedState.shared.setDriverLocation(loc)
                return
            }

            self.pendingLocation = loc
            if self.pendingFlushScheduled { return }
            self.pendingFlushScheduled = true

            let delay = max(0, Self.locationDebounceInterval - elapsed)
            self.locationQueue.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self else { return }
                self.pendingFlushScheduled = false
                guard let toFlush = self.pendingLocation else { return }
                self.pendingLocation = nil
                self.lastLocationWriteTs = Date().timeIntervalSince1970
                Self.logger.debug("location.flush.coalesced")
                RoamCarPlaySharedState.shared.setDriverLocation(toFlush)
            }
        }
    }

    @objc func isCarPlayConnected(_ call: CAPPluginCall) {
        let connected = CarPlayNavigationCoordinator.shared.isSceneConnected
        call.resolve(["connected": connected])
    }
}
