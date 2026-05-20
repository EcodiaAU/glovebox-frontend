// ios/App/NavWidgets/NavLiveActivity.swift
//
// The showpiece: the navigation Live Activity (lock screen + Dynamic Island).
// Renders the active leg's progress, ETA, next maneuver, fuel-range gauge,
// and hazard alert. Fed locally from the app's background-location loop, so
// it stays live with zero signal. Brand: rust ground, cream ink, sun mark.

import SwiftUI
import WidgetKit
import ActivityKit

@available(iOS 16.2, *)
struct NavLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NavLiveActivityAttributes.self) { context in
            // ── Lock screen / banner ─────────────────────────────
            NavLiveActivityLockScreen(
                attributes: context.attributes,
                state: context.state
            )
            .activityBackgroundTint(NavTheme.rust)
            .activitySystemActionForegroundColor(NavTheme.cream)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                // Expanded
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Image(systemName: NavTheme.maneuverSymbol(s.maneuverModifier))
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(NavTheme.cream)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(NavFormat.distance(meters: s.distanceToManeuverMeters))
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(NavTheme.cream)
                            if let road = s.currentRoadName {
                                Text(road).font(.system(size: 11)).foregroundStyle(NavTheme.creamDim).lineLimit(1)
                            }
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(NavFormat.clock(epoch: s.etaEpoch))
                            .font(.system(size: 17, weight: .heavy, design: .rounded))
                            .foregroundStyle(NavTheme.cream)
                        Text("\(NavFormat.distance(meters: s.distanceRemainingMeters)) · \(NavFormat.duration(seconds: max(0, s.etaEpoch - Date().timeIntervalSince1970)))")
                            .font(.system(size: 11)).foregroundStyle(NavTheme.creamDim)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(s.maneuverInstruction)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(NavTheme.cream)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        ProgressView(value: s.legProgress)
                            .tint(NavTheme.cream)
                        HStack {
                            if let name = s.lastChanceFuelName, let d = s.distanceToLastChanceKm {
                                Label("\(name) \(NavFormat.distanceKm(d))",
                                      systemImage: "fuelpump.fill")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(NavTheme.fuelColor(tankFraction: s.fuelTankFraction, distanceToLastChanceKm: s.distanceToLastChanceKm))
                            }
                            Spacer()
                            if let hz = s.hazardLabel {
                                Label(hz, systemImage: "exclamationmark.triangle.fill")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(NavTheme.hazardColor(s.hazardSeverity))
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: NavTheme.maneuverSymbol(s.maneuverModifier))
                    .foregroundStyle(NavTheme.cream)
            } compactTrailing: {
                Text(NavFormat.distance(meters: s.distanceToManeuverMeters))
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(NavTheme.cream)
            } minimal: {
                Image(systemName: NavTheme.maneuverSymbol(s.maneuverModifier))
                    .foregroundStyle(NavTheme.cream)
            }
            .keylineTint(NavTheme.rust)
        }
    }
}

// MARK: - Lock screen layout

@available(iOS 16.2, *)
private struct NavLiveActivityLockScreen: View {
    let attributes: NavLiveActivityAttributes
    let state: NavLiveActivityAttributes.ContentState

    private var remainingSeconds: Double {
        max(0, state.etaEpoch - Date().timeIntervalSince1970)
    }

    var body: some View {
        ZStack {
            NavTheme.ground
            VStack(alignment: .leading, spacing: 12) {
                // Header: route + mark
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(attributes.originName)  →  \(attributes.destinationName)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(NavTheme.creamDim)
                            .lineLimit(1)
                        if state.gpsStale {
                            Label("Holding last position", systemImage: "location.slash.fill")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(NavTheme.amber)
                        } else if state.offline {
                            Label("Offline · navigating", systemImage: "wifi.slash")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(NavTheme.creamDim)
                        }
                    }
                    Spacer()
                    SunHorizonMark()
                        .frame(width: 38, height: 30)
                }

                // Maneuver + ETA
                HStack(alignment: .center, spacing: 14) {
                    ZStack {
                        Circle().fill(NavTheme.cream.opacity(0.14)).frame(width: 56, height: 56)
                        Image(systemName: NavTheme.maneuverSymbol(state.maneuverModifier))
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(NavTheme.cream)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(NavFormat.distance(meters: state.distanceToManeuverMeters))
                            .font(.system(size: 22, weight: .heavy, design: .rounded))
                            .foregroundStyle(NavTheme.cream)
                        Text(state.maneuverInstruction)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(NavTheme.creamDim)
                            .lineLimit(2).minimumScaleFactor(0.8)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(NavFormat.clock(epoch: state.etaEpoch))
                            .font(.system(size: 24, weight: .heavy, design: .rounded))
                            .foregroundStyle(NavTheme.cream)
                        Text("\(NavFormat.duration(seconds: remainingSeconds)) · \(NavFormat.distance(meters: state.distanceRemainingMeters))")
                            .font(.system(size: 12))
                            .foregroundStyle(NavTheme.creamDim)
                    }
                }

                // Leg progress
                ProgressView(value: state.legProgress)
                    .tint(NavTheme.cream)
                    .scaleEffect(x: 1, y: 1.4, anchor: .center)

                // Fuel + hazard row
                if state.lastChanceFuelName != nil || state.hazardLabel != nil {
                    HStack(spacing: 10) {
                        if let name = state.lastChanceFuelName, let d = state.distanceToLastChanceKm {
                            HStack(spacing: 6) {
                                Image(systemName: "fuelpump.fill")
                                NavRing(progress: state.fuelTankFraction ?? 0.5, lineWidth: 3,
                                        color: NavTheme.fuelColor(tankFraction: state.fuelTankFraction, distanceToLastChanceKm: state.distanceToLastChanceKm))
                                    .frame(width: 14, height: 14)
                                Text("\(name) · \(NavFormat.distanceKm(d))")
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(NavTheme.fuelColor(tankFraction: state.fuelTankFraction, distanceToLastChanceKm: state.distanceToLastChanceKm))
                        }
                        Spacer()
                        if let hz = state.hazardLabel {
                            HStack(spacing: 6) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(hz + (state.distanceToHazardKm.map { " · " + NavFormat.distanceKm($0) } ?? ""))
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(NavTheme.hazardColor(state.hazardSeverity))
                        }
                    }
                }
            }
            .padding(16)
        }
    }
}
