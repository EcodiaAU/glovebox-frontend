// ios/App/NavWidgets/NavWidgetsBundle.swift
//
// @main entry point for the NavWidgets extension. Assembles every widget,
// the lock-screen accessories, the navigation Live Activity, and (iOS 18)
// the Control Center control.

import WidgetKit
import SwiftUI

@main
struct NavWidgetsBundle: WidgetBundle {
    var body: some Widget {
        // Home screen
        NavSafetyWidget()
        NavConditionsWidget()
        NavFuelWidget()
        NavNextTripWidget()
        // Lock screen accessories
        NavFuelAccessory()
        NavConditionsAccessory()
        // Live Activity (lock screen + Dynamic Island)
        liveActivity
        // iOS 18 Control
        control
    }

    @WidgetBundleBuilder
    private var liveActivity: some Widget {
        if #available(iOS 16.2, *) {
            NavLiveActivity()
        }
    }

    @WidgetBundleBuilder
    private var control: some Widget {
        if #available(iOS 18.0, *) {
            NavStartControl()
        }
    }
}
