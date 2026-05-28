// GloveboxCarPlaySharedState.swift
//
// In-process singleton holding cross-scene Glovebox state: the active trip,
// the planned route geometry, hazards along the corridor, fuel stops,
// the vehicle's fuel profile, and the driver's last known location.
//
// The phone scene writes to this state via the GloveboxCarPlayBridge Capacitor
// plugin. The CarPlay scene observes the NotificationCenter notification
// fired on change and refreshes its templates.
//
// All public access is funnelled through a serial dispatch queue so
// concurrent reads from the CarPlay scene and writes from the phone JS
// bridge stay coherent.

import Foundation
import CoreLocation

@available(iOS 14.0, *)
final class GloveboxCarPlaySharedState {

    static let shared = GloveboxCarPlaySharedState()

    static let stateChangedNotification = Notification.Name("GloveboxCarPlayStateChanged")
    static let changeKindKey = "kind"

    enum ChangeKind: String {
        case trip
        case hazards
        case fuelStops
        case vehicle
        case location
        case cleared
    }

    // MARK: - Value types

    struct Trip: Codable, Equatable {
        var routeKey: String
        var geometryPolyline6: String
        var distanceMeters: Double
        var durationSeconds: Double
        var originName: String
        var destinationName: String
        var waypoints: [Waypoint]
        var maneuvers: [Maneuver]
    }

    struct Waypoint: Codable, Equatable {
        var name: String
        var lat: Double
        var lng: Double
    }

    struct Maneuver: Codable, Equatable {
        var instruction: String
        var lat: Double
        var lng: Double
        var distanceFromStartMeters: Double
        // CarPlay maneuver-symbol hint: one of
        // "left", "right", "slight-left", "slight-right", "sharp-left",
        // "sharp-right", "uturn", "straight", "arrive", "depart", "roundabout"
        var modifier: String?
    }

    struct Hazard: Codable, Equatable {
        var id: String
        var lat: Double
        var lng: Double
        var typeLabel: String      // "flood", "fire", "closure", "wildlife", "weather", "surface"
        var severity: String       // "info", "warning", "critical"
        var headline: String
        var detail: String?
        var distanceAlongRouteMeters: Double?
    }

    struct FuelStop: Codable, Equatable {
        var id: String
        var name: String
        var brand: String?
        var lat: Double
        var lng: Double
        var distanceAlongRouteMeters: Double
        var isLastChance: Bool
    }

    struct Vehicle: Codable, Equatable {
        var litresPer100Km: Double
        var tankCapacityLitres: Double
        var currentFuelLitres: Double

        var rangeKm: Double {
            guard litresPer100Km > 0 else { return 0 }
            return (currentFuelLitres / litresPer100Km) * 100.0
        }
    }

    struct DriverLocation: Codable, Equatable {
        var lat: Double
        var lng: Double
        var headingDegrees: Double?
        var speedMps: Double?
        var timestampMs: Double
    }

    // MARK: - Backing store (serial-queue guarded)

    private let queue = DispatchQueue(label: "au.ecodia.roam.carplay.state")
    private var _activeTrip: Trip?
    private var _hazards: [Hazard] = []
    private var _fuelStops: [FuelStop] = []
    private var _vehicle: Vehicle?
    private var _driverLocation: DriverLocation?

    private init() {}

    // MARK: - Reads (queue.sync)

    var activeTrip: Trip? { queue.sync { _activeTrip } }
    var hazards: [Hazard] { queue.sync { _hazards } }
    var fuelStops: [FuelStop] { queue.sync { _fuelStops } }
    var vehicle: Vehicle? { queue.sync { _vehicle } }
    var driverLocation: DriverLocation? { queue.sync { _driverLocation } }

    // MARK: - Writes (queue.async, broadcast on main)

    func setActiveTrip(_ trip: Trip) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._activeTrip = trip
            self.broadcast(.trip)
        }
    }

    func clearActiveTrip() {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._activeTrip = nil
            self._hazards = []
            self._fuelStops = []
            self.broadcast(.cleared)
        }
    }

    func setHazards(_ hazards: [Hazard]) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._hazards = hazards
            self.broadcast(.hazards)
        }
    }

    func setFuelStops(_ stops: [FuelStop]) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._fuelStops = stops
            self.broadcast(.fuelStops)
        }
    }

    func setVehicle(_ vehicle: Vehicle) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._vehicle = vehicle
            self.broadcast(.vehicle)
        }
    }

    func setDriverLocation(_ location: DriverLocation) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self._driverLocation = location
            self.broadcast(.location)
        }
    }

    // MARK: - Notification (always on main)

    private func broadcast(_ kind: ChangeKind) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: Self.stateChangedNotification,
                object: self,
                userInfo: [Self.changeKindKey: kind.rawValue]
            )
        }
    }

    // MARK: - Convenience helpers used by CarPlay scene

    func clCoordinate() -> CLLocationCoordinate2D? {
        guard let l = driverLocation else { return nil }
        return CLLocationCoordinate2D(latitude: l.lat, longitude: l.lng)
    }

    /// The most urgent unacknowledged hazard within `withinMeters` of the
    /// driver's current position. Used to drive CPAlertTemplate.
    func nextHazardToAnnounce(withinMeters: Double = 5_000) -> Hazard? {
        guard let loc = driverLocation else { return nil }
        let here = CLLocation(latitude: loc.lat, longitude: loc.lng)
        return hazards
            .map { (h: Hazard) -> (Hazard, Double) in
                let d = here.distance(from: CLLocation(latitude: h.lat, longitude: h.lng))
                return (h, d)
            }
            .filter { $0.1 <= withinMeters }
            .sorted { lhs, rhs in
                let sevRank: (String) -> Int = { s in
                    switch s {
                    case "critical": return 0
                    case "warning":  return 1
                    case "info":     return 2
                    default:         return 3
                    }
                }
                if sevRank(lhs.0.severity) != sevRank(rhs.0.severity) {
                    return sevRank(lhs.0.severity) < sevRank(rhs.0.severity)
                }
                return lhs.1 < rhs.1
            }
            .first?.0
    }

    /// The next fuel stop along the route from the driver's current position.
    /// Used to drive CPAlertTemplate fuel-range warnings.
    func nextFuelStop() -> FuelStop? {
        guard let _ = driverLocation else { return nil }
        return fuelStops
            .sorted { $0.distanceAlongRouteMeters < $1.distanceAlongRouteMeters }
            .first
    }
}
