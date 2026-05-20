// ios/App/NavWidgets/NavStartControl.swift
//
// iOS 18 Control Center / Lock Screen control: one-tap start of the next
// planned trip. Runs StartNextTripIntent (opens the app + sets the pending
// action the JS layer drains).

import WidgetKit
import SwiftUI
import AppIntents

@available(iOS 18.0, *)
struct NavStartControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "NavStartControl") {
            ControlWidgetButton(action: StartNextTripIntent()) {
                Label("Start Nav", systemImage: "location.north.line.fill")
            }
        }
        .displayName("Start Nav")
        .description("Begin your next planned Nav trip.")
    }
}
