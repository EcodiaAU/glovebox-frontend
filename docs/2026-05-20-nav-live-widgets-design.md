# Nav. Live - Native Widgets + Live Activity (design)

Date: 2026-05-20. Status: approved (Tate "full send, all of it"). App: Nav. (`au.ecodia.roam`, Option-A bundle id kept).

## Goal
A gorgeous, offline-first realtime presence on the lock screen + home screen, extending the existing `RoamCarPlayBridge` data model. The app already runs with **background location**, so the Live Activity updates in real time even with zero signal - no APNs required for driving.

## Surfaces
1. **Live Activity (ActivityKit)** - lock screen + Dynamic Island, active during navigation. THE showpiece.
   - Lock screen: leg progress arc, big ETA, distance/time remaining, next-maneuver chevron, fuel-range gauge (cream -> amber -> red as last-chance fuel nears), hazard pill.
   - Dynamic Island: compact (chevron + distance), expanded (ETA + leg progress + next fuel + hazard), minimal (range dot).
   - Updated locally from the background-location loop. Offline. "Holding last position" on GPS loss.
2. **WidgetKit home + lock widgets** (priority order per Tate):
   - **Safety / Last position** (small + lock circular): last GPS fix + coords + share-my-location intent.
   - **Outback conditions** (medium/large): hazard/flood/fire summary on saved corridors, offline-aware ("synced 2h ago").
   - **Fuel range** (small + lock circular): vehicle range ring + last-chance fuel.
   - **Next trip** (medium): planned trip distance/fuel-stops/hazards, tap-to-start.
   - Lock-screen accessories (inline/rectangular): ETA, next-fuel distance, range.
3. **iOS 17/18 extras**: interactive widget buttons + App Intents (Siri: start next trip, how far to fuel), Control Center / Lock Screen "Start Nav" control, StandBy nightstand nav view.

## Architecture
- New extension target **NavWidgetsExtension**, bundle id `au.ecodia.roam.widgets` (child of kept parent).
- **App Group** `group.au.ecodia.roam` shared between app + extension (entitlement on both).
- Shared Swift sources compiled into both targets: `NavWidgetSnapshot` (Codable, the offline state blob) + `NavLiveActivityAttributes` (ActivityKit attributes + ContentState) + `AppGroupStore` (read/write JSON to the shared container).
- New Capacitor plugin **NavWidgetsBridge** (sibling to RoamCarPlayBridge, keeps concerns clean): `startLiveActivity`, `updateLiveActivity`, `endLiveActivity`, `writeWidgetSnapshot`, `reloadWidgets`, `areLiveActivitiesEnabled`.
- JS: `src/plugins/nav-widgets-bridge/` (definitions) + `src/lib/native/widgets.ts` (`liveActivity` wrapper + `useWidgetSync` hook), mirroring `carPlay.ts`. Wired from the trip/live pages alongside `useCarPlayBridgeSync`.

## Data flow (offline-first)
1. Web/nav layer computes trip/leg progress/fuel/hazards/position/conditions (already does, for CarPlay).
2. On each meaningful update: `writeWidgetSnapshot(snapshot)` -> AppGroupStore writes JSON + `WidgetCenter.reloadAllTimelines()`.
3. During nav: `updateLiveActivity(contentState)` from the background-location loop (throttled ~ every 5-10s or on maneuver change).
4. WidgetKit timeline providers read the App Group snapshot -> render with zero network. `lastSyncedAt` drives offline-awareness copy.
5. Optional `BGAppRefreshTask` refreshes conditions when online + app backgrounded.

## Brand
Rust `#A8431F`, cream `#E8DFC9`, sun-horizon mark. Gauges/arcs in cream; warnings amber/red. SF Rounded heavy for numerals.

## Build/verify
pbxproj target wiring mirrors `scripts/wire-carplay-pbxproj.rb`. Compile-verify headless on SY094 via `xcodebuild`; GUI signing/scheme via RDP if needed. Live Activity + Dynamic Island visual check in the iOS simulator on SY094.

## Build order
Live Activity (end-to-end, verified) -> home/lock widgets -> App Intents/Control/StandBy.
