// ios/App/Shared/AppGroupStore.swift
//
// Read/write the NavWidgetSnapshot to the shared App Group container.
// The App target writes (via NavWidgetsBridge); the NavWidgets extension
// reads (in its timeline providers). UserDefaults(suiteName:) is the
// standard, low-overhead widget data channel for small JSON payloads.
//
// Compiled into both targets.

import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

public enum AppGroupStore {

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: NavAppGroup.id)
    }

    // MARK: Write (App target)

    @discardableResult
    public static func writeSnapshot(_ snapshot: NavWidgetSnapshot) -> Bool {
        guard let defaults else { return false }
        do {
            let data = try JSONEncoder().encode(snapshot)
            defaults.set(data, forKey: NavAppGroup.snapshotKey)
            return true
        } catch {
            return false
        }
    }

    // MARK: Read (extension)

    public static func readSnapshot() -> NavWidgetSnapshot? {
        guard let defaults, let data = defaults.data(forKey: NavAppGroup.snapshotKey) else {
            return nil
        }
        return try? JSONDecoder().decode(NavWidgetSnapshot.self, from: data)
    }

    /// A friendly default so widgets never render empty in the gallery / first install.
    public static func placeholderSnapshot() -> NavWidgetSnapshot {
        NavWidgetSnapshot(
            lastSyncedAtEpoch: Date().timeIntervalSince1970,
            isNavigating: false,
            position: .init(lat: -25.897, lng: 139.351, headingDegrees: 0, speedMps: 0, accuracyMeters: 8, timestampEpoch: Date().timeIntervalSince1970),
            fuel: .init(rangeKm: 420, tankFraction: 0.62, lastChanceName: "Mungerannie", distanceToLastChanceKm: 86),
            conditions: .init(corridorName: "Birdsville Track", hazardCount: 3, floodCount: 1, fireCount: 0, summary: "1 flood gauge, 2 road hazards ahead"),
            nextTrip: .init(name: "Brisbane to Birdsville", originName: "Brisbane", destinationName: "Birdsville", distanceKm: 1587, estFuelStops: 4, hazardCount: 3),
            vehicle: .init(name: "LandCruiser", fuelEconomyL100: 12.5, tankLitres: 138)
        )
    }

    // MARK: Reload

    public static func reloadAllWidgets() {
        #if canImport(WidgetKit)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        #endif
    }
}
