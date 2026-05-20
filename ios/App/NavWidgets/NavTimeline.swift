// ios/App/NavWidgets/NavTimeline.swift
//
// Shared WidgetKit timeline provider. Reads the NavWidgetSnapshot from the
// App Group container written by the app, so every home/lock widget renders
// fully offline. Refreshes on a gentle cadence; the app also calls
// WidgetCenter.reloadAllTimelines() on every meaningful change for immediacy.

import WidgetKit
import SwiftUI

struct NavEntry: TimelineEntry {
    let date: Date
    let snapshot: NavWidgetSnapshot
}

struct NavProvider: TimelineProvider {
    func placeholder(in context: Context) -> NavEntry {
        NavEntry(date: Date(), snapshot: AppGroupStore.placeholderSnapshot())
    }

    func getSnapshot(in context: Context, completion: @escaping (NavEntry) -> Void) {
        let snap = AppGroupStore.readSnapshot() ?? AppGroupStore.placeholderSnapshot()
        completion(NavEntry(date: Date(), snapshot: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NavEntry>) -> Void) {
        let snap = AppGroupStore.readSnapshot() ?? AppGroupStore.placeholderSnapshot()
        let now = Date()
        // Re-render every 15 min as a floor; the app pushes immediate reloads on change.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [NavEntry(date: now, snapshot: snap)], policy: .after(next)))
    }
}

// Deep-link helpers (reuse the existing au.ecodia.roam:// scheme the app already handles).
enum NavDeepLink {
    static let scheme = "au.ecodia.roam"
    static func url(_ path: String) -> URL { URL(string: "\(scheme)://\(path)")! }
    static let openApp = url("open")
    static let startNextTrip = url("trip/start-next")
    static let shareLocation = url("sos/share-location")
    static let conditions = url("conditions")
    static let fuel = url("fuel")
}
