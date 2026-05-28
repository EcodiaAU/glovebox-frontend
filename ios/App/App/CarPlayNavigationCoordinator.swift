// CarPlayNavigationCoordinator.swift
//
// Singleton bridge between the CarPlay scene and the rest of the Glovebox
// runtime. Responsibilities:
//
// - Issue search + route requests to the Glovebox backend (places/search,
//   nav/route).
// - Build CPListItems and CPTrips from the backend responses.
// - Own the CPNavigationSession lifecycle once a trip is started.
// - Translate maneuvers from shared state into CPManeuver objects.
// - Observe driver location changes and update CPTravelEstimates plus
//   the upcoming-maneuver list as the trip progresses.
// - Decide when to fire navigation alerts (hazard proximity, last-chance
//   fuel) and present them on the active CPMapTemplate.
//
// The scene delegate owns the templates + carWindow root view controller;
// the coordinator owns data + decisions and exposes them to the scene.

import CarPlay
import Foundation
import MapKit
import os.log
import AVFoundation

@available(iOS 14.0, *)
final class CarPlayNavigationCoordinator: NSObject {

    static let shared = CarPlayNavigationCoordinator()

    // Structured logging filterable in Console.app on a real device.
    // Filter on subsystem au.ecodia.roam + category carplay.
    static let logger = Logger(subsystem: "au.ecodia.roam", category: "carplay")

    // Apple caps nav-app template depth at 5 (root + 4 pushes).
    // Push attempts past the cap are dropped with an assert in debug.
    static let templateDepthCap = 5

    // Scene-owned references handed in via sceneDidConnect.
    private(set) var isSceneConnected = false
    weak var interfaceController: CPInterfaceController?
    weak var activeMapTemplate: CPMapTemplate?
    weak var mapViewController: CarPlayMapViewController?

    private(set) var activeNavigationSession: CPNavigationSession?
    private(set) var activeCPTrip: CPTrip?
    private var lastAnnouncedHazardId: String?
    private var lastFuelWarningId: String?
    private var hazardPollTimer: Timer?

    private lazy var apiBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "GloveboxApiBaseURL") as? String,
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://api.glovebox.ecodia.au")!
    }()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()

    private override init() {
        super.init()
    }

    // MARK: - Scene lifecycle entry points (called from CarPlaySceneDelegate)

    func sceneDidConnect(interfaceController: CPInterfaceController, mapTemplate: CPMapTemplate) {
        isSceneConnected = true
        self.interfaceController = interfaceController
        self.activeMapTemplate = mapTemplate

        NotificationCenter.default.post(
            name: GloveboxCarPlayBridgePlugin.sceneConnectedNotification, object: nil
        )

        if let trip = GloveboxCarPlaySharedState.shared.activeTrip {
            startNavigationFromSharedState(trip: trip, mapTemplate: mapTemplate)
        }

        NotificationCenter.default.addObserver(
            self, selector: #selector(handleSharedStateChange(_:)),
            name: GloveboxCarPlaySharedState.stateChangedNotification, object: nil
        )

        startHazardPollLoop()
    }

    func sceneDidDisconnect() {
        isSceneConnected = false
        activeNavigationSession?.cancelTrip()
        activeNavigationSession = nil
        activeCPTrip = nil
        lastAnnouncedHazardId = nil
        lastFuelWarningId = nil
        hazardPollTimer?.invalidate()
        hazardPollTimer = nil
        interfaceController = nil
        activeMapTemplate = nil
        mapViewController = nil

        NotificationCenter.default.removeObserver(self)
        NotificationCenter.default.post(
            name: GloveboxCarPlayBridgePlugin.sceneDisconnectedNotification, object: nil
        )
    }

    // MARK: - Shared-state observer

    @objc private func handleSharedStateChange(_ note: Notification) {
        guard let kindStr = note.userInfo?[GloveboxCarPlaySharedState.changeKindKey] as? String,
              let kind = GloveboxCarPlaySharedState.ChangeKind(rawValue: kindStr) else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch kind {
            case .trip:
                if let trip = GloveboxCarPlaySharedState.shared.activeTrip,
                   let mapTemplate = self.activeMapTemplate {
                    self.startNavigationFromSharedState(trip: trip, mapTemplate: mapTemplate)
                }
            case .cleared:
                self.endActiveNavigation()
            case .hazards:
                self.checkHazardProximity()
                self.mapViewController?.renderHazards(GloveboxCarPlaySharedState.shared.hazards)
            case .fuelStops:
                self.checkFuelWarning()
            case .location:
                self.refreshManeuversAndEstimates()
                self.checkHazardProximity()
                self.checkFuelWarning()
                self.mapViewController?.followDriverLocation()
            case .vehicle:
                self.checkFuelWarning()
            }
        }
    }

    // MARK: - Search (CPSearchTemplateDelegate)

    private struct PlacesRequestBody: Encodable {
        struct Center: Encodable { let lat: Double; let lng: Double }
        let query: String
        let center: Center?
        let radius_m: Int?
        let limit: Int
    }

    private struct PlacesResponseBody: Decodable {
        struct Item: Decodable {
            let id: String?
            let name: String?
            let lat: Double?
            let lng: Double?
            let category: String?
            let distance_m: Double?
        }
        let items: [Item]
    }

    private func searchPlaces(query: String, completion: @escaping ([CPListItem]) -> Void) {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else {
            completion([])
            return
        }

        let center: PlacesRequestBody.Center?
        if let loc = GloveboxCarPlaySharedState.shared.driverLocation {
            center = .init(lat: loc.lat, lng: loc.lng)
        } else {
            center = nil
        }

        let body = PlacesRequestBody(query: query, center: center, radius_m: 50_000, limit: 20)
        let url = apiBaseURL.appendingPathComponent("places/search")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do { request.httpBody = try JSONEncoder().encode(body) } catch {
            completion([]); return
        }

        session.dataTask(with: request) { data, _, _ in
            guard let data = data,
                  let decoded = try? JSONDecoder().decode(PlacesResponseBody.self, from: data) else {
                DispatchQueue.main.async { completion([]) }
                return
            }

            let items: [CPListItem] = decoded.items.compactMap { item in
                guard let name = item.name, let lat = item.lat, let lng = item.lng else { return nil }
                var detail = item.category ?? ""
                if let d = item.distance_m, d > 0 {
                    let km = d / 1000.0
                    if !detail.isEmpty { detail += " - " }
                    detail += String(format: "%.0f km", km)
                }
                let cp = CPListItem(text: name, detailText: detail.isEmpty ? nil : detail)
                cp.userInfo = [
                    "id": item.id ?? "",
                    "name": name,
                    "lat": lat,
                    "lng": lng,
                ] as [String: Any]
                return cp
            }
            DispatchQueue.main.async { completion(items) }
        }.resume()
    }

    // MARK: - Trip preview from a picked destination

    private struct RouteRequestBody: Encodable {
        struct Coord: Encodable { let lat: Double; let lng: Double }
        let origin: Coord
        let destination: Coord
        let profile: String
    }

    private struct RouteResponseBody: Decodable {
        let route_key: String
        let geometry_polyline6: String
        let distance_m: Double
        let duration_s: Double
        let summary: String?
    }

    private func previewTrip(toLat lat: Double, lng: Double, name: String) {
        guard let mapTemplate = activeMapTemplate else { return }
        guard let originLoc = GloveboxCarPlaySharedState.shared.driverLocation else {
            presentTransientAlert(
                title: NSLocalizedString("carplay.alert.noGps.title",
                                         value: "Cannot plan route",
                                         comment: "Title shown on CarPlay when planning is attempted without a GPS fix."),
                detail: NSLocalizedString("carplay.alert.noGps.detail",
                                          value: "Waiting for GPS fix. Try again once the map shows your position.",
                                          comment: "Detail shown on CarPlay when planning is attempted without a GPS fix.")
            )
            return
        }

        NotificationCenter.default.post(
            name: GloveboxCarPlayBridgePlugin.destinationPickedNotification,
            object: nil,
            userInfo: ["name": name, "lat": lat, "lng": lng]
        )

        let body = RouteRequestBody(
            origin: .init(lat: originLoc.lat, lng: originLoc.lng),
            destination: .init(lat: lat, lng: lng),
            profile: "drive"
        )
        let url = apiBaseURL.appendingPathComponent("nav/route")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do { request.httpBody = try JSONEncoder().encode(body) } catch { return }

        session.dataTask(with: request) { [weak self] data, _, _ in
            guard let self = self,
                  let data = data,
                  let route = try? JSONDecoder().decode(RouteResponseBody.self, from: data) else {
                DispatchQueue.main.async {
                    self?.presentTransientAlert(
                        title: NSLocalizedString("carplay.alert.routeUnavailable.title",
                                                 value: "Route unavailable",
                                                 comment: "Title shown on CarPlay when the routing backend is unreachable."),
                        detail: NSLocalizedString("carplay.alert.routeUnavailable.detail",
                                                  value: "Could not reach Glovebox to plan this route. Check signal and try again.",
                                                  comment: "Detail shown on CarPlay when the routing backend is unreachable.")
                    )
                }
                return
            }

            DispatchQueue.main.async {
                let originCoord = CLLocationCoordinate2D(latitude: originLoc.lat, longitude: originLoc.lng)
                let destCoord = CLLocationCoordinate2D(latitude: lat, longitude: lng)

                let originItem = MKMapItem(placemark: MKPlacemark(coordinate: originCoord))
                originItem.name = NSLocalizedString("carplay.origin.currentLocation",
                                                    value: "Current location",
                                                    comment: "Map item name for the driver's current location.")
                let destItem = MKMapItem(placemark: MKPlacemark(coordinate: destCoord))
                destItem.name = name

                let distanceKm = route.distance_m / 1000.0
                let durationMin = route.duration_s / 60.0
                let summary = route.summary ?? Self.formatDuration(seconds: route.duration_s)
                let routeChoice = CPRouteChoice(
                    summaryVariants: [summary],
                    additionalInformationVariants: [String(format: "%.0f km, %.0f min", distanceKm, durationMin)],
                    selectionSummaryVariants: [name]
                )
                routeChoice.userInfo = [
                    "polyline6": route.geometry_polyline6,
                    "route_key": route.route_key,
                ] as [String: Any]

                let trip = CPTrip(origin: originItem, destination: destItem, routeChoices: [routeChoice])
                self.activeCPTrip = trip

                let textConfig = CPTripPreviewTextConfiguration(
                    startButtonTitle: NSLocalizedString("carplay.trip.start",
                                                       value: "Start",
                                                       comment: "Start-navigation button on CarPlay trip preview."),
                    additionalRoutesButtonTitle: nil,
                    overviewButtonTitle: NSLocalizedString("carplay.trip.overview",
                                                          value: "Overview",
                                                          comment: "Overview button on CarPlay trip preview.")
                )
                mapTemplate.showTripPreviews([trip], textConfiguration: textConfig)
                self.mapViewController?.renderRoute(polyline6: route.geometry_polyline6)
            }
        }.resume()
    }

    // MARK: - Navigation session lifecycle

    private func startNavigationFromSharedState(trip: GloveboxCarPlaySharedState.Trip, mapTemplate: CPMapTemplate) {
        mapTemplate.hideTripPreviews()
        activeNavigationSession?.cancelTrip()

        let originCoord: CLLocationCoordinate2D
        if let l = GloveboxCarPlaySharedState.shared.driverLocation {
            originCoord = CLLocationCoordinate2D(latitude: l.lat, longitude: l.lng)
        } else if let w = trip.waypoints.first {
            originCoord = CLLocationCoordinate2D(latitude: w.lat, longitude: w.lng)
        } else {
            return
        }

        let destCoord: CLLocationCoordinate2D
        if let w = trip.waypoints.last {
            destCoord = CLLocationCoordinate2D(latitude: w.lat, longitude: w.lng)
        } else {
            let coords = Self.decodePolyline6(trip.geometryPolyline6)
            guard let tail = coords.last else { return }
            destCoord = tail
        }

        let originItem = MKMapItem(placemark: MKPlacemark(coordinate: originCoord))
        originItem.name = trip.originName
        let destItem = MKMapItem(placemark: MKPlacemark(coordinate: destCoord))
        destItem.name = trip.destinationName

        let summary = Self.formatDuration(seconds: trip.durationSeconds)
        let info = String(format: "%.0f km", trip.distanceMeters / 1000.0)
        let routeChoice = CPRouteChoice(
            summaryVariants: [summary],
            additionalInformationVariants: [info],
            selectionSummaryVariants: [trip.destinationName]
        )
        let cpTrip = CPTrip(origin: originItem, destination: destItem, routeChoices: [routeChoice])
        activeCPTrip = cpTrip

        let session = mapTemplate.startNavigationSession(for: cpTrip)
        activeNavigationSession = session

        refreshManeuversAndEstimates()
        mapViewController?.renderRoute(polyline6: trip.geometryPolyline6)
        mapViewController?.renderHazards(GloveboxCarPlaySharedState.shared.hazards)
    }

    func endActiveNavigation() {
        activeNavigationSession?.finishTrip()
        activeNavigationSession = nil
        activeCPTrip = nil
        activeMapTemplate?.hideTripPreviews()
        mapViewController?.clearRoute()
        mapViewController?.clearHazardPins()
    }

    // MARK: - Maneuver / ETA refresh on location change

    private func refreshManeuversAndEstimates() {
        guard let session = activeNavigationSession,
              let trip = GloveboxCarPlaySharedState.shared.activeTrip,
              let loc = GloveboxCarPlaySharedState.shared.driverLocation else { return }

        let here = CLLocation(latitude: loc.lat, longitude: loc.lng)
        let upcoming = trip.maneuvers.filter { m in
            let mLoc = CLLocation(latitude: m.lat, longitude: m.lng)
            return here.distance(from: mLoc) > 30
        }.prefix(3)

        let cpManeuvers: [CPManeuver] = upcoming.map { src in
            let m = CPManeuver()
            m.instructionVariants = [src.instruction]
            m.symbolImage = Self.maneuverSymbol(for: src.modifier ?? "straight")
            let mLoc = CLLocation(latitude: src.lat, longitude: src.lng)
            let dist = here.distance(from: mLoc)
            m.initialTravelEstimates = CPTravelEstimates(
                distanceRemaining: Measurement(value: dist, unit: UnitLength.meters),
                timeRemaining: max(1, dist / 22.2)
            )
            m.userInfo = ["id": "\(src.lat),\(src.lng)"] as [String: Any]
            return m
        }
        session.upcomingManeuvers = cpManeuvers

        if let cpTrip = activeCPTrip {
            let coords = Self.decodePolyline6(trip.geometryPolyline6)
            let remainingMeters = Self.distanceFromHereToEnd(coords: coords, here: here)
            let avgMps = trip.distanceMeters > 0 && trip.durationSeconds > 0
                ? trip.distanceMeters / trip.durationSeconds
                : 22.2
            let remainingSeconds = max(60, remainingMeters / avgMps)
            let est = CPTravelEstimates(
                distanceRemaining: Measurement(value: remainingMeters, unit: UnitLength.meters),
                timeRemaining: remainingSeconds
            )
            activeMapTemplate?.update(est, for: cpTrip, with: .green)
        }
    }

    // MARK: - Hazard alerts

    private func startHazardPollLoop() {
        hazardPollTimer?.invalidate()
        hazardPollTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.checkHazardProximity()
            self?.checkFuelWarning()
        }
    }

    private func checkHazardProximity() {
        guard let next = GloveboxCarPlaySharedState.shared.nextHazardToAnnounce(withinMeters: 8_000),
              next.id != lastAnnouncedHazardId else { return }
        lastAnnouncedHazardId = next.id

        let isCritical = (next.severity == "critical")
        let alert = CPNavigationAlert(
            titleVariants: [next.headline],
            subtitleVariants: [next.detail ?? Self.localizedHazardTypeLabel(next.typeLabel)],
            image: Self.hazardSymbol(for: next.typeLabel),
            primaryAction: CPAlertAction(
                title: NSLocalizedString("carplay.alert.acknowledge",
                                         value: "Acknowledge",
                                         comment: "Primary action on a CarPlay navigation alert."),
                style: .default
            ) { _ in
                NotificationCenter.default.post(
                    name: GloveboxCarPlayBridgePlugin.hazardAcknowledgedNotification,
                    object: nil,
                    userInfo: ["hazardId": next.id]
                )
            },
            secondaryAction: nil,
            duration: isCritical ? 30 : 15
        )
        Self.logger.info("hazard.alert.present id=\(next.id, privacy: .public) type=\(next.typeLabel, privacy: .public) severity=\(next.severity, privacy: .public)")
        activeMapTemplate?.present(navigationAlert: alert, animated: true)
    }

    // MARK: - Fuel warnings

    private func checkFuelWarning() {
        guard let next = GloveboxCarPlaySharedState.shared.nextFuelStop(),
              next.id != lastFuelWarningId,
              let loc = GloveboxCarPlaySharedState.shared.driverLocation else { return }

        let here = CLLocation(latitude: loc.lat, longitude: loc.lng)
        let stopLoc = CLLocation(latitude: next.lat, longitude: next.lng)
        let distanceToStop = here.distance(from: stopLoc)

        let shouldFire: Bool
        if next.isLastChance && distanceToStop <= 40_000 {
            shouldFire = true
        } else if let v = GloveboxCarPlaySharedState.shared.vehicle,
                  v.rangeKm * 1000 < distanceToStop * 1.2 {
            shouldFire = true
        } else {
            shouldFire = false
        }
        guard shouldFire else { return }
        lastFuelWarningId = next.id

        let distKm = distanceToStop / 1000.0
        let reasonKey = next.isLastChance
            ? "carplay.alert.fuel.reason.lastChance"
            : "carplay.alert.fuel.reason.rangeLow"
        let reasonFallback = next.isLastChance
            ? "Last fuel before next stretch."
            : "Fuel range low."
        let reason = NSLocalizedString(reasonKey, value: reasonFallback,
                                       comment: "Reason a fuel alert is firing.")
        let detailFormat = NSLocalizedString("carplay.alert.fuel.detailFormat",
                                             value: "%@ in %.0f km. %@",
                                             comment: "Detail format: brand-or-name, distance km, reason.")
        let detail = String(format: detailFormat, next.brand ?? next.name, distKm, reason)
        let alert = CPNavigationAlert(
            titleVariants: [NSLocalizedString("carplay.alert.fuel.title",
                                              value: "Fuel ahead",
                                              comment: "Title for the CarPlay fuel-stop alert.")],
            subtitleVariants: [detail],
            image: UIImage(systemName: "fuelpump.fill"),
            primaryAction: CPAlertAction(
                title: NSLocalizedString("carplay.alert.acknowledge",
                                         value: "Acknowledge",
                                         comment: "Primary action on a CarPlay navigation alert."),
                style: .default
            ) { _ in },
            secondaryAction: nil,
            duration: next.isLastChance ? 30 : 15
        )
        Self.logger.info("fuel.alert.present id=\(next.id, privacy: .public) lastChance=\(next.isLastChance, privacy: .public) distKm=\(distKm, privacy: .public)")
        activeMapTemplate?.present(navigationAlert: alert, animated: true)
    }

    // MARK: - Transient alerts (no nav session)

    private func presentTransientAlert(title: String, detail: String) {
        let action = CPAlertAction(
            title: NSLocalizedString("carplay.alert.ok",
                                     value: "OK",
                                     comment: "Dismiss action for a transient CarPlay alert."),
            style: .default
        ) { [weak self] _ in
            self?.interfaceController?.dismissTemplate(animated: true, completion: nil)
        }
        // CPAlertTemplate.titleVariants takes length variants of the SAME
        // headline (Apple picks the longest that fits). We compose a longer
        // single-string variant that carries the detail and provide the
        // title alone as the shorter variant.
        let combined = "\(title). \(detail)"
        let alert = CPAlertTemplate(titleVariants: [combined, title], actions: [action])
        Self.logger.info("transient.alert.present title=\(title, privacy: .public)")
        pushTemplate(alert, asModal: true)
    }

    // MARK: - Plans list (saved trips from shared state)

    func plansListTemplate() -> CPListTemplate {
        var items: [CPListItem] = []
        if let trip = GloveboxCarPlaySharedState.shared.activeTrip {
            let km = trip.distanceMeters / 1000.0
            let detail = String(format: "%.0f km - %@",
                                km, Self.formatDuration(seconds: trip.durationSeconds))
            let item = CPListItem(text: trip.destinationName, detailText: detail)
            item.userInfo = ["kind": "activeTrip"] as [String: Any]
            item.handler = { [weak self] _, completion in
                guard let self = self,
                      let mapTemplate = self.activeMapTemplate else { completion(); return }
                self.startNavigationFromSharedState(trip: trip, mapTemplate: mapTemplate)
                self.interfaceController?.popTemplate(animated: true, completion: nil)
                completion()
            }
            items.append(item)
        }

        let header: String
        if items.isEmpty {
            let placeholder = CPListItem(
                text: NSLocalizedString("carplay.plans.empty.title",
                                        value: "No saved trips",
                                        comment: "CarPlay plans list empty-state row title."),
                detailText: NSLocalizedString("carplay.plans.empty.detail",
                                              value: "Plan a trip in Glovebox on your phone; it will show here.",
                                              comment: "CarPlay plans list empty-state row detail.")
            )
            items.append(placeholder)
            header = NSLocalizedString("carplay.plans.section.header.empty",
                                       value: "Plans",
                                       comment: "Plans section header when there is no active trip.")
        } else {
            header = NSLocalizedString("carplay.plans.section.header.active",
                                       value: "Active trip",
                                       comment: "Plans section header when an active trip exists.")
        }

        let section = CPListSection(items: items, header: header, sectionIndexTitle: nil)
        return CPListTemplate(
            title: NSLocalizedString("carplay.plans.template.title",
                                     value: "Plans",
                                     comment: "Navigation bar title for the CarPlay plans list template."),
            sections: [section]
        )
    }

    // MARK: - Helpers

    static func formatDuration(seconds: Double) -> String {
        let s = Int(seconds)
        let h = s / 3600
        let m = (s % 3600) / 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    private static func maneuverSymbol(for modifier: String) -> UIImage? {
        switch modifier {
        case "left":         return UIImage(systemName: "arrow.turn.up.left")
        case "right":        return UIImage(systemName: "arrow.turn.up.right")
        case "slight-left":  return UIImage(systemName: "arrow.up.left")
        case "slight-right": return UIImage(systemName: "arrow.up.right")
        case "sharp-left":   return UIImage(systemName: "arrow.uturn.up")
        case "sharp-right":  return UIImage(systemName: "arrow.uturn.up")
        case "uturn":        return UIImage(systemName: "arrow.uturn.down")
        case "arrive":       return UIImage(systemName: "mappin.and.ellipse")
        case "depart":       return UIImage(systemName: "location.fill")
        case "roundabout":   return UIImage(systemName: "arrow.triangle.2.circlepath")
        default:             return UIImage(systemName: "arrow.up")
        }
    }

    /// Localized user-facing label for a hazard typeLabel. Hazard typeLabel
    /// arrives from the backend as a short technical token ("flood", "fire",
    /// etc.) and gets shown to the driver when no richer detail string is
    /// present; localizing it keeps the surface clean across locales.
    static func localizedHazardTypeLabel(_ raw: String) -> String {
        switch raw {
        case "flood":
            return NSLocalizedString("carplay.hazard.type.flood", value: "Flood",
                                     comment: "Hazard type label shown on CarPlay.")
        case "fire":
            return NSLocalizedString("carplay.hazard.type.fire", value: "Fire",
                                     comment: "Hazard type label shown on CarPlay.")
        case "closure":
            return NSLocalizedString("carplay.hazard.type.closure", value: "Road closure",
                                     comment: "Hazard type label shown on CarPlay.")
        case "wildlife":
            return NSLocalizedString("carplay.hazard.type.wildlife", value: "Wildlife zone",
                                     comment: "Hazard type label shown on CarPlay.")
        case "weather":
            return NSLocalizedString("carplay.hazard.type.weather", value: "Severe weather",
                                     comment: "Hazard type label shown on CarPlay.")
        case "surface":
            return NSLocalizedString("carplay.hazard.type.surface", value: "Road surface warning",
                                     comment: "Hazard type label shown on CarPlay.")
        default:
            return NSLocalizedString("carplay.hazard.type.generic", value: "Hazard",
                                     comment: "Generic hazard label shown on CarPlay.")
        }
    }

    /// Push a template onto the CarPlay nav stack with a depth-cap guard,
    /// or present it as a modal overlay that doesn't count toward the stack
    /// (alerts, search). Centralising keeps the 5-template cap enforced in
    /// one place.
    func pushTemplate(_ template: CPTemplate, asModal: Bool = false) {
        guard let ic = interfaceController else {
            Self.logger.error("pushTemplate.no_interface_controller")
            return
        }
        if asModal {
            ic.presentTemplate(template, animated: true, completion: nil)
            return
        }
        let depth = ic.templates.count
        if depth >= Self.templateDepthCap {
            Self.logger.error("template.stack.cap depth=\(depth) cap=\(Self.templateDepthCap) - dropping push")
            assertionFailure("CarPlay nav-app template depth cap (\(Self.templateDepthCap)) hit")
            return
        }
        ic.pushTemplate(template, animated: true, completion: nil)
    }

    /// CPInformationTemplate listing upstream data sources for the maps,
    /// hazard, fuel, and routing data. Apple's HIG asks for attribution
    /// surfaces for navigation apps; this is the place.
    func informationTemplate() -> CPInformationTemplate {
        let title = NSLocalizedString("carplay.info.title", value: "About Glovebox",
                                      comment: "Title of the CarPlay attribution screen.")
        let lines: [String] = [
            NSLocalizedString("carplay.info.routing",
                              value: "Routing: Glovebox backend + OSRM.",
                              comment: "Attribution line."),
            NSLocalizedString("carplay.info.maps",
                              value: "Maps: Apple MapKit.",
                              comment: "Attribution line."),
            NSLocalizedString("carplay.info.hazards",
                              value: "Hazards: state transport authorities (QLD TMR, NSW TfNSW, VicTraffic, SA DIT, WA Main Roads, NT DIPL, Tas DSG), Bureau of Meteorology, NAFI, DEA satellite imagery.",
                              comment: "Attribution line."),
            NSLocalizedString("carplay.info.fuel",
                              value: "Fuel pricing: state-published fuel-pricing feeds.",
                              comment: "Attribution line."),
            NSLocalizedString("carplay.info.weather",
                              value: "Weather: Open-Meteo.",
                              comment: "Attribution line."),
        ]
        let items: [CPInformationItem] = lines.map { CPInformationItem(title: nil, detail: $0) }
        let info = CPInformationTemplate(title: title,
                                         layout: .leading,
                                         items: items,
                                         actions: [])
        return info
    }

    private static func hazardSymbol(for type: String) -> UIImage? {
        switch type {
        case "flood":    return UIImage(systemName: "drop.triangle.fill")
        case "fire":     return UIImage(systemName: "flame.fill")
        case "closure":  return UIImage(systemName: "xmark.octagon.fill")
        case "wildlife": return UIImage(systemName: "pawprint.fill")
        case "weather":  return UIImage(systemName: "cloud.bolt.rain.fill")
        case "surface":  return UIImage(systemName: "exclamationmark.triangle.fill")
        default:         return UIImage(systemName: "exclamationmark.triangle.fill")
        }
    }

    private static func distanceFromHereToEnd(coords: [CLLocationCoordinate2D], here: CLLocation) -> Double {
        guard coords.count >= 2 else { return 0 }
        var bestIdx = 0
        var bestDist = Double.greatestFiniteMagnitude
        for (i, c) in coords.enumerated() {
            let d = here.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude))
            if d < bestDist { bestDist = d; bestIdx = i }
        }
        var total: Double = 0
        for i in bestIdx..<(coords.count - 1) {
            let a = CLLocation(latitude: coords[i].latitude, longitude: coords[i].longitude)
            let b = CLLocation(latitude: coords[i+1].latitude, longitude: coords[i+1].longitude)
            total += a.distance(from: b)
        }
        return total
    }

    // MARK: - Polyline6 decode (mirrors Mapbox polyline-codec, precision 6)

    static func decodePolyline6(_ encoded: String) -> [CLLocationCoordinate2D] {
        var coords: [CLLocationCoordinate2D] = []
        let chars = Array(encoded)
        var index = 0
        var lat = 0, lng = 0
        while index < chars.count {
            var b: Int = 0, shift = 0, result = 0
            repeat {
                guard index < chars.count else { break }
                b = Int(chars[index].asciiValue ?? 0) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlat = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1)
            lat += dlat

            shift = 0; result = 0
            repeat {
                guard index < chars.count else { break }
                b = Int(chars[index].asciiValue ?? 0) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
            } while b >= 0x20
            let dlng = ((result & 1) != 0) ? ~(result >> 1) : (result >> 1)
            lng += dlng

            coords.append(CLLocationCoordinate2D(
                latitude: Double(lat) / 1e6,
                longitude: Double(lng) / 1e6
            ))
        }
        return coords
    }
}

// MARK: - CPMapTemplateDelegate (trip start / pan controls)

@available(iOS 14.0, *)
extension CarPlayNavigationCoordinator: CPMapTemplateDelegate {

    func mapTemplate(_ mapTemplate: CPMapTemplate,
                     startedTrip trip: CPTrip,
                     using routeChoice: CPRouteChoice) {
        mapTemplate.hideTripPreviews()
        let session = mapTemplate.startNavigationSession(for: trip)
        activeNavigationSession = session
        activeCPTrip = trip

        if let info = routeChoice.userInfo as? [String: Any],
           let polyline = info["polyline6"] as? String {
            mapViewController?.renderRoute(polyline6: polyline)
        }

        refreshManeuversAndEstimates()
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate,
                     selectedPreviewFor trip: CPTrip,
                     using routeChoice: CPRouteChoice) {
        if let info = routeChoice.userInfo as? [String: Any],
           let polyline = info["polyline6"] as? String {
            mapViewController?.renderRoute(polyline6: polyline)
        }
    }

    func mapTemplateDidShowPanningInterface(_ mapTemplate: CPMapTemplate) {
        mapViewController?.stopFollowingDriver()
    }

    func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) {
        mapViewController?.followDriverLocation()
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate,
                     panWith direction: CPMapTemplate.PanDirection) {
        mapViewController?.pan(direction: direction)
    }
}

// MARK: - CPSearchTemplateDelegate

@available(iOS 14.0, *)
extension CarPlayNavigationCoordinator: CPSearchTemplateDelegate {

    func searchTemplate(_ searchTemplate: CPSearchTemplate,
                        updatedSearchText searchText: String,
                        completionHandler: @escaping ([CPListItem]) -> Void) {
        searchPlaces(query: searchText, completion: completionHandler)
    }

    func searchTemplate(_ searchTemplate: CPSearchTemplate,
                        selectedResult item: CPListItem,
                        completionHandler: @escaping () -> Void) {
        defer { completionHandler() }
        guard let info = item.userInfo as? [String: Any],
              let lat = info["lat"] as? Double,
              let lng = info["lng"] as? Double,
              let name = info["name"] as? String else { return }
        interfaceController?.popTemplate(animated: true, completion: nil)
        previewTrip(toLat: lat, lng: lng, name: name)
    }

    func searchTemplateButtonPressed(_ searchTemplate: CPSearchTemplate) {
        interfaceController?.popTemplate(animated: true, completion: nil)
    }
}
