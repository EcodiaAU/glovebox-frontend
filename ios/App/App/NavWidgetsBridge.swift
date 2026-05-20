// ios/App/App/NavWidgetsBridge.swift
//
// Capacitor plugin bridging the JS/web nav layer to the native widget +
// Live Activity surfaces. Sibling to RoamCarPlayBridge (kept separate so
// CarPlay and widget concerns do not entangle).
//
// JS passes payloads as JSON strings (version-proof across Capacitor
// releases, avoids JSObject<->JSONSerialization quirks); we decode into
// the shared Codable models in ios/App/Shared/NavWidgetModels.swift.
//
// Live Activity updates are driven LOCALLY from the app's background
// location loop, so the lock screen stays live even with zero signal.
//
// Add this file to the App target (see scripts/wire-widgets-pbxproj.rb).

import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(NavWidgetsBridge)
public class NavWidgetsBridge: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "NavWidgetsBridge"
    public let jsName = "NavWidgetsBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "writeWidgetSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidgets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "areLiveActivitiesEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isLiveActivityRunning", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingAction", returnType: CAPPluginReturnPromise),
    ]

    /// Held as Any? so the stored property has no @available constraint.
    /// Cast back to Activity<NavLiveActivityAttributes> inside guarded blocks.
    private var liveActivityBox: Any?

    private let decoder = JSONDecoder()

    // MARK: - Widget snapshot

    @objc func writeWidgetSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.reject("writeWidgetSnapshot requires a 'json' string")
            return
        }
        do {
            let snapshot = try decoder.decode(NavWidgetSnapshot.self, from: data)
            let ok = AppGroupStore.writeSnapshot(snapshot)
            AppGroupStore.reloadAllWidgets()
            call.resolve(["ok": ok])
        } catch {
            call.reject("Failed to decode snapshot: \(error.localizedDescription)")
        }
    }

    @objc func reloadWidgets(_ call: CAPPluginCall) {
        AppGroupStore.reloadAllWidgets()
        call.resolve()
    }

    /// Drains a one-shot action queued by a widget/Siri/Control intent
    /// (e.g. "start-next-trip", "share-location", "fuel"). JS calls this on
    /// resume + appUrlOpen and routes accordingly. Returns {action: string|null}.
    @objc func consumePendingAction(_ call: CAPPluginCall) {
        call.resolve(["action": AppGroupStore.takePendingAction() ?? NSNull()])
    }

    // MARK: - Live Activity

    @objc func areLiveActivitiesEnabled(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
            call.resolve(["enabled": ActivityAuthorizationInfo().areActivitiesEnabled])
            return
        }
        #endif
        call.resolve(["enabled": false])
    }

    @objc func isLiveActivityRunning(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.1, *), liveActivityBox as? Activity<NavLiveActivityAttributes> != nil {
            call.resolve(["running": true]); return
        }
        #endif
        call.resolve(["running": false])
    }

    @objc func startLiveActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.reject("Live Activities require iOS 16.2+"); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in Settings"); return
        }
        guard
            let attrJson = call.getString("attributes")?.data(using: .utf8),
            let stateJson = call.getString("state")?.data(using: .utf8)
        else { call.reject("startLiveActivity requires 'attributes' and 'state' JSON strings"); return }

        do {
            let attributes = try decoder.decode(NavLiveActivityAttributes.self, from: attrJson)
            let state = try decoder.decode(NavLiveActivityAttributes.ContentState.self, from: stateJson)

            // End any existing activity first so we never stack two.
            endCurrentActivity(dismiss: true)

            let staleDate = Date().addingTimeInterval(60 * 8) // mark stale after 8 min without an update
            let content = ActivityContent(state: state, staleDate: staleDate)
            let activity = try Activity<NavLiveActivityAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            liveActivityBox = activity
            call.resolve(["id": activity.id])
        } catch {
            call.reject("startLiveActivity failed: \(error.localizedDescription)")
        }
        #else
        call.reject("ActivityKit unavailable")
        #endif
    }

    @objc func updateLiveActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard let activity = liveActivityBox as? Activity<NavLiveActivityAttributes> else {
            call.resolve(["running": false]); return
        }
        guard let stateJson = call.getString("state")?.data(using: .utf8) else {
            call.reject("updateLiveActivity requires a 'state' JSON string"); return
        }
        do {
            let state = try decoder.decode(NavLiveActivityAttributes.ContentState.self, from: stateJson)
            let staleDate = Date().addingTimeInterval(60 * 8)
            let content = ActivityContent(state: state, staleDate: staleDate)
            Task {
                await activity.update(content)
                call.resolve(["running": true])
            }
        } catch {
            call.reject("updateLiveActivity failed: \(error.localizedDescription)")
        }
        #else
        call.resolve()
        #endif
    }

    @objc func endLiveActivity(_ call: CAPPluginCall) {
        endCurrentActivity(dismiss: true)
        call.resolve()
    }

    private func endCurrentActivity(dismiss: Bool) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), let activity = liveActivityBox as? Activity<NavLiveActivityAttributes> else { return }
        let policy: ActivityUIDismissalPolicy = dismiss ? .immediate : .default
        Task { await activity.end(nil, dismissalPolicy: policy) }
        liveActivityBox = nil
        #endif
    }
}
