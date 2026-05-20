// ios/App/NavWidgets/NavAppIntents.swift
//
// App Intents powering Siri/Shortcuts, interactive widget buttons, and the
// iOS 18 Control. Each intent records a pending action in the App Group and
// opens the app; the JS layer drains it on resume via
// NavWidgetsBridge.consumePendingAction(). This keeps one routing path:
// native intent -> App Group flag -> JS handles, same as deep links.

import AppIntents
import WidgetKit
import Foundation

// MARK: - Pending action channel (App Group)

extension AppGroupStore {
    static let pendingActionKey = "nav.widget.pendingAction.v1"

    static func setPendingAction(_ action: String) {
        UserDefaults(suiteName: NavAppGroup.id)?.set(action, forKey: pendingActionKey)
    }
    static func takePendingAction() -> String? {
        let d = UserDefaults(suiteName: NavAppGroup.id)
        let v = d?.string(forKey: pendingActionKey)
        d?.removeObject(forKey: pendingActionKey)
        return v
    }
}

// MARK: - Intents

@available(iOS 16.0, *)
struct StartNextTripIntent: AppIntent {
    static var title: LocalizedStringResource = "Start my next trip"
    static var description = IntentDescription("Begin navigation for your next planned Nav trip.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        AppGroupStore.setPendingAction("start-next-trip")
        return .result()
    }
}

@available(iOS 16.0, *)
struct ShareLocationIntent: AppIntent {
    static var title: LocalizedStringResource = "Share my location"
    static var description = IntentDescription("Open Nav and share your last known position.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        AppGroupStore.setPendingAction("share-location")
        return .result()
    }
}

@available(iOS 16.0, *)
struct CheckFuelIntent: AppIntent {
    static var title: LocalizedStringResource = "How far to fuel"
    static var description = IntentDescription("See the last fuel before the next remote stretch.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let f = AppGroupStore.readSnapshot()?.fuel
        if let name = f?.lastChanceName, let d = f?.distanceToLastChanceKm {
            AppGroupStore.setPendingAction("fuel")
            return .result(dialog: "Last fuel is \(name), \(Int(d.rounded())) kilometres ahead.")
        }
        return .result(dialog: "No fuel data yet. Plan a trip in Nav first.")
    }
}

// MARK: - Siri shortcuts

@available(iOS 16.0, *)
struct NavShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartNextTripIntent(),
            phrases: ["Start my next trip in \(.applicationName)", "Start \(.applicationName)"],
            shortTitle: "Start next trip",
            systemImageName: "location.north.line.fill"
        )
        AppShortcut(
            intent: CheckFuelIntent(),
            phrases: ["How far to fuel in \(.applicationName)", "\(.applicationName) fuel range"],
            shortTitle: "Fuel range",
            systemImageName: "fuelpump.fill"
        )
        AppShortcut(
            intent: ShareLocationIntent(),
            phrases: ["Share my location in \(.applicationName)"],
            shortTitle: "Share location",
            systemImageName: "square.and.arrow.up"
        )
    }
}
