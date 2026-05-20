// ios/App/Shared/NavWidgetModels.swift
//
// Shared data contract for the Nav. widget + Live Activity surfaces.
// Compiled into BOTH the App target (which writes via NavWidgetsBridge)
// and the NavWidgets extension target (which reads to render).
//
// Two payloads:
//   - NavWidgetSnapshot: the offline state blob for WidgetKit home/lock
//     widgets. Written to the App Group container on every meaningful
//     change so widgets render with zero network.
//   - NavLiveActivityAttributes: the ActivityKit attributes + dynamic
//     ContentState for the lock-screen / Dynamic Island Live Activity
//     shown during navigation. Updated locally from the app's background
//     location loop, so it stays live even with no signal.

import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

// MARK: - App Group

public enum NavAppGroup {
    /// Shared container id. Must match the App Group capability on both the
    /// App target and the NavWidgets extension target, and the JS bridge.
    public static let id = "group.au.ecodia.roam"
    /// UserDefaults key holding the JSON-encoded NavWidgetSnapshot.
    public static let snapshotKey = "nav.widget.snapshot.v1"
}

// MARK: - Home / lock widget snapshot

public struct NavWidgetSnapshot: Codable, Equatable {
    public var lastSyncedAtEpoch: Double          // seconds since 1970
    public var isNavigating: Bool
    public var position: Position?
    public var fuel: Fuel?
    public var conditions: Conditions?
    public var nextTrip: NextTrip?
    public var vehicle: Vehicle?

    public init(
        lastSyncedAtEpoch: Double,
        isNavigating: Bool,
        position: Position? = nil,
        fuel: Fuel? = nil,
        conditions: Conditions? = nil,
        nextTrip: NextTrip? = nil,
        vehicle: Vehicle? = nil
    ) {
        self.lastSyncedAtEpoch = lastSyncedAtEpoch
        self.isNavigating = isNavigating
        self.position = position
        self.fuel = fuel
        self.conditions = conditions
        self.nextTrip = nextTrip
        self.vehicle = vehicle
    }

    public struct Position: Codable, Equatable {
        public var lat: Double
        public var lng: Double
        public var headingDegrees: Double?
        public var speedMps: Double?
        public var accuracyMeters: Double?
        public var timestampEpoch: Double
        public init(lat: Double, lng: Double, headingDegrees: Double? = nil, speedMps: Double? = nil, accuracyMeters: Double? = nil, timestampEpoch: Double) {
            self.lat = lat; self.lng = lng; self.headingDegrees = headingDegrees
            self.speedMps = speedMps; self.accuracyMeters = accuracyMeters; self.timestampEpoch = timestampEpoch
        }
    }

    public struct Fuel: Codable, Equatable {
        public var rangeKm: Double?               // estimated remaining range
        public var tankFraction: Double?          // 0..1, drives the ring
        public var lastChanceName: String?        // last fuel before remote stretch
        public var distanceToLastChanceKm: Double?
        public init(rangeKm: Double? = nil, tankFraction: Double? = nil, lastChanceName: String? = nil, distanceToLastChanceKm: Double? = nil) {
            self.rangeKm = rangeKm; self.tankFraction = tankFraction
            self.lastChanceName = lastChanceName; self.distanceToLastChanceKm = distanceToLastChanceKm
        }
    }

    public struct Conditions: Codable, Equatable {
        public var corridorName: String?
        public var hazardCount: Int
        public var floodCount: Int
        public var fireCount: Int
        public var summary: String?               // one-line human summary
        public init(corridorName: String? = nil, hazardCount: Int = 0, floodCount: Int = 0, fireCount: Int = 0, summary: String? = nil) {
            self.corridorName = corridorName; self.hazardCount = hazardCount
            self.floodCount = floodCount; self.fireCount = fireCount; self.summary = summary
        }
    }

    public struct NextTrip: Codable, Equatable {
        public var tripId: String?
        public var name: String
        public var originName: String?
        public var destinationName: String?
        public var distanceKm: Double?
        public var estFuelStops: Int?
        public var hazardCount: Int?
        public init(tripId: String? = nil, name: String, originName: String? = nil, destinationName: String? = nil, distanceKm: Double? = nil, estFuelStops: Int? = nil, hazardCount: Int? = nil) {
            self.tripId = tripId; self.name = name; self.originName = originName
            self.destinationName = destinationName; self.distanceKm = distanceKm
            self.estFuelStops = estFuelStops; self.hazardCount = hazardCount
        }
    }

    public struct Vehicle: Codable, Equatable {
        public var name: String?
        public var fuelEconomyL100: Double?
        public var tankLitres: Double?
        public init(name: String? = nil, fuelEconomyL100: Double? = nil, tankLitres: Double? = nil) {
            self.name = name; self.fuelEconomyL100 = fuelEconomyL100; self.tankLitres = tankLitres
        }
    }
}

// MARK: - Live Activity

#if canImport(ActivityKit)

@available(iOS 16.1, *)
public struct NavLiveActivityAttributes: ActivityAttributes {

    // Fixed for the life of the activity (set at request time).
    public var tripId: String
    public var originName: String
    public var destinationName: String
    public var totalDistanceMeters: Double
    public var totalDurationSeconds: Double

    public init(tripId: String, originName: String, destinationName: String, totalDistanceMeters: Double, totalDurationSeconds: Double) {
        self.tripId = tripId
        self.originName = originName
        self.destinationName = destinationName
        self.totalDistanceMeters = totalDistanceMeters
        self.totalDurationSeconds = totalDurationSeconds
    }

    public struct ContentState: Codable, Hashable {
        // Progress
        public var legProgress: Double            // 0..1 along the active leg
        public var distanceRemainingMeters: Double
        public var etaEpoch: Double               // arrival time, seconds since 1970

        // Next maneuver
        public var maneuverInstruction: String
        public var maneuverModifier: String?      // "left", "right", "uturn", ... -> SF Symbol
        public var distanceToManeuverMeters: Double
        public var currentRoadName: String?

        // Fuel (optional)
        public var fuelTankFraction: Double?      // 0..1, drives gauge colour
        public var fuelRangeKm: Double?
        public var lastChanceFuelName: String?
        public var distanceToLastChanceKm: Double?

        // Hazard (optional)
        public var hazardLabel: String?
        public var distanceToHazardKm: Double?
        public var hazardSeverity: String?        // "minor" | "moderate" | "major"

        // State flags
        public var gpsStale: Bool
        public var offline: Bool

        public init(
            legProgress: Double,
            distanceRemainingMeters: Double,
            etaEpoch: Double,
            maneuverInstruction: String,
            maneuverModifier: String? = nil,
            distanceToManeuverMeters: Double,
            currentRoadName: String? = nil,
            fuelTankFraction: Double? = nil,
            fuelRangeKm: Double? = nil,
            lastChanceFuelName: String? = nil,
            distanceToLastChanceKm: Double? = nil,
            hazardLabel: String? = nil,
            distanceToHazardKm: Double? = nil,
            hazardSeverity: String? = nil,
            gpsStale: Bool = false,
            offline: Bool = false
        ) {
            self.legProgress = legProgress
            self.distanceRemainingMeters = distanceRemainingMeters
            self.etaEpoch = etaEpoch
            self.maneuverInstruction = maneuverInstruction
            self.maneuverModifier = maneuverModifier
            self.distanceToManeuverMeters = distanceToManeuverMeters
            self.currentRoadName = currentRoadName
            self.fuelTankFraction = fuelTankFraction
            self.fuelRangeKm = fuelRangeKm
            self.lastChanceFuelName = lastChanceFuelName
            self.distanceToLastChanceKm = distanceToLastChanceKm
            self.hazardLabel = hazardLabel
            self.distanceToHazardKm = distanceToHazardKm
            self.hazardSeverity = hazardSeverity
            self.gpsStale = gpsStale
            self.offline = offline
        }
    }
}

#endif

// MARK: - Formatting helpers (shared by app + widgets)

public enum NavFormat {
    /// "850 m" / "12 km" / "1,240 km"
    public static func distance(meters: Double) -> String {
        if meters < 1000 { return "\(Int(meters.rounded())) m" }
        let km = meters / 1000
        if km < 10 { return String(format: "%.1f km", km) }
        return "\(Int(km.rounded())) km"
    }

    public static func distanceKm(_ km: Double) -> String {
        if km < 1 { return "\(Int((km * 1000).rounded())) m" }
        if km < 10 { return String(format: "%.1f km", km) }
        return "\(Int(km.rounded())) km"
    }

    /// "2h 14m" / "47m"
    public static func duration(seconds: Double) -> String {
        let total = Int(seconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    /// "3:42 pm"
    public static func clock(epoch: Double) -> String {
        let df = DateFormatter()
        df.dateFormat = "h:mm a"
        df.amSymbol = "am"; df.pmSymbol = "pm"
        return df.string(from: Date(timeIntervalSince1970: epoch))
    }

    /// "synced just now" / "synced 2h ago"
    public static func syncedAgo(epoch: Double, now: Date = Date()) -> String {
        let secs = max(0, now.timeIntervalSince1970 - epoch)
        if secs < 90 { return "synced just now" }
        if secs < 3600 { return "synced \(Int(secs / 60))m ago" }
        if secs < 86400 { return "synced \(Int(secs / 3600))h ago" }
        return "synced \(Int(secs / 86400))d ago"
    }
}
