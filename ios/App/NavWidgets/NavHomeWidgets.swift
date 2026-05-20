// ios/App/NavWidgets/NavHomeWidgets.swift
//
// Home-screen widgets (offline, App Group fed). Priority order per Tate:
// Safety/last-position, Outback conditions, Fuel range, then Next trip.

import WidgetKit
import SwiftUI

// MARK: - Background helper (iOS 17 requires containerBackground)

private struct NavWidgetBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(NavTheme.ground, for: .widget)
        } else {
            ZStack { NavTheme.ground; content }
        }
    }
}
private extension View {
    func navWidgetBackground() -> some View { modifier(NavWidgetBackground()) }
}

// MARK: - 1. Safety / last known position

struct NavSafetyWidget: Widget {
    let kind = "NavSafetyWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavSafetyView(snapshot: entry.snapshot).navWidgetBackground()
        }
        .configurationDisplayName("Last Position")
        .description("Your last GPS fix and a one-tap share for remote safety.")
        .supportedFamilies([.systemSmall])
    }
}

private struct NavSafetyView: View {
    let snapshot: NavWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "location.fill").font(.system(size: 13, weight: .bold))
                Text("Last position").font(.system(size: 12, weight: .semibold))
                Spacer()
                SunHorizonMark().frame(width: 22, height: 18)
            }
            .foregroundStyle(NavTheme.creamDim)

            Spacer(minLength: 0)

            if let p = snapshot.position {
                Text(coord(p.lat, lat: true))
                    .font(.system(size: 16, weight: .heavy, design: .monospaced))
                Text(coord(p.lng, lat: false))
                    .font(.system(size: 16, weight: .heavy, design: .monospaced))
                Text(NavFormat.syncedAgo(epoch: p.timestampEpoch).replacingOccurrences(of: "synced", with: "fix"))
                    .font(.system(size: 11)).foregroundStyle(NavTheme.creamDim)
            } else {
                Text("No fix yet").font(.system(size: 15, weight: .bold))
            }

            Spacer(minLength: 0)

            Link(destination: NavDeepLink.shareLocation) {
                HStack(spacing: 5) {
                    Image(systemName: "square.and.arrow.up")
                    Text("Share location").font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(NavTheme.rust)
                .padding(.vertical, 6).frame(maxWidth: .infinity)
                .background(NavTheme.cream, in: Capsule())
            }
        }
        .foregroundStyle(NavTheme.cream)
        .padding(14)
    }
    private func coord(_ v: Double, lat: Bool) -> String {
        let hemi = lat ? (v >= 0 ? "N" : "S") : (v >= 0 ? "E" : "W")
        return String(format: "%.4f° %@", abs(v), hemi)
    }
}

// MARK: - 2. Outback conditions

struct NavConditionsWidget: Widget {
    let kind = "NavConditionsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavConditionsView(snapshot: entry.snapshot).navWidgetBackground()
        }
        .configurationDisplayName("Outback Conditions")
        .description("Hazards, floods and fires on your saved corridors.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private struct NavConditionsView: View {
    let snapshot: NavWidgetSnapshot
    @Environment(\.widgetFamily) private var family
    var body: some View {
        let c = snapshot.conditions
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(c?.corridorName ?? "Outback conditions")
                    .font(.system(size: 15, weight: .heavy)).lineLimit(1)
                Spacer()
                SunHorizonMark().frame(width: 26, height: 20)
            }
            HStack(spacing: 14) {
                stat("\(c?.hazardCount ?? 0)", "hazards", "exclamationmark.triangle.fill", NavTheme.amber)
                stat("\(c?.floodCount ?? 0)", "floods", "water.waves", NavTheme.cream)
                stat("\(c?.fireCount ?? 0)", "fires", "flame.fill", NavTheme.danger)
            }
            if let summary = c?.summary {
                Text(summary)
                    .font(.system(size: 12)).foregroundStyle(NavTheme.creamDim)
                    .lineLimit(family == .systemLarge ? 4 : 2)
            }
            Spacer(minLength: 0)
            Text(NavFormat.syncedAgo(epoch: snapshot.lastSyncedAtEpoch))
                .font(.system(size: 11, weight: .medium)).foregroundStyle(NavTheme.creamDim)
        }
        .foregroundStyle(NavTheme.cream)
        .padding(16)
        .widgetURL(NavDeepLink.conditions)
    }
    private func stat(_ value: String, _ label: String, _ symbol: String, _ tint: Color) -> some View {
        VStack(spacing: 3) {
            HStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 12, weight: .bold)).foregroundStyle(tint)
                Text(value).font(.system(size: 20, weight: .heavy, design: .rounded))
            }
            Text(label).font(.system(size: 10)).foregroundStyle(NavTheme.creamDim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(NavTheme.cream.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - 3. Fuel range

struct NavFuelWidget: Widget {
    let kind = "NavFuelWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavFuelView(snapshot: entry.snapshot).navWidgetBackground()
        }
        .configurationDisplayName("Fuel Range")
        .description("Estimated range and the last fuel before the next remote stretch.")
        .supportedFamilies([.systemSmall])
    }
}

private struct NavFuelView: View {
    let snapshot: NavWidgetSnapshot
    var body: some View {
        let f = snapshot.fuel
        let tint = NavTheme.fuelColor(tankFraction: f?.tankFraction, distanceToLastChanceKm: f?.distanceToLastChanceKm)
        VStack(spacing: 8) {
            ZStack {
                NavRing(progress: f?.tankFraction ?? 0, lineWidth: 9, color: tint)
                VStack(spacing: 0) {
                    Text("\(Int((f?.rangeKm ?? 0).rounded()))")
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                    Text("km range").font(.system(size: 9)).foregroundStyle(NavTheme.creamDim)
                }
            }
            .frame(width: 92, height: 92)

            if let name = f?.lastChanceName, let d = f?.distanceToLastChanceKm {
                VStack(spacing: 1) {
                    Text("last fuel").font(.system(size: 9)).foregroundStyle(NavTheme.creamDim)
                    Text("\(name) · \(NavFormat.distanceKm(d))")
                        .font(.system(size: 11, weight: .bold)).foregroundStyle(tint).lineLimit(1)
                }
            }
        }
        .foregroundStyle(NavTheme.cream)
        .padding(12)
        .widgetURL(NavDeepLink.fuel)
    }
}

// MARK: - 4. Next trip

struct NavNextTripWidget: Widget {
    let kind = "NavNextTripWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavNextTripView(snapshot: entry.snapshot).navWidgetBackground()
        }
        .configurationDisplayName("Next Trip")
        .description("Your planned trip at a glance. Tap to start.")
        .supportedFamilies([.systemMedium])
    }
}

private struct NavNextTripView: View {
    let snapshot: NavWidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let t = snapshot.nextTrip {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.name).font(.system(size: 16, weight: .heavy)).lineLimit(1)
                        if let o = t.originName, let d = t.destinationName {
                            Text("\(o)  →  \(d)").font(.system(size: 12)).foregroundStyle(NavTheme.creamDim).lineLimit(1)
                        }
                    }
                    Spacer()
                    SunHorizonMark().frame(width: 26, height: 20)
                }
                Spacer(minLength: 0)
                HStack(spacing: 16) {
                    metric(t.distanceKm.map { NavFormat.distanceKm($0) } ?? "—", "distance")
                    metric(t.estFuelStops.map { "\($0)" } ?? "—", "fuel stops")
                    metric(t.hazardCount.map { "\($0)" } ?? "0", "hazards")
                    Spacer()
                    Link(destination: NavDeepLink.startNextTrip) {
                        HStack(spacing: 5) {
                            Image(systemName: "location.north.line.fill")
                            Text("Start").font(.system(size: 13, weight: .heavy))
                        }
                        .foregroundStyle(NavTheme.rust)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(NavTheme.cream, in: Capsule())
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Text("No trip planned").font(.system(size: 16, weight: .heavy))
                    Text("Plan one in Nav to see it here.").font(.system(size: 12)).foregroundStyle(NavTheme.creamDim)
                }
            }
        }
        .foregroundStyle(NavTheme.cream)
        .padding(16)
        .widgetURL(NavDeepLink.openApp)
    }
    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.system(size: 17, weight: .heavy, design: .rounded))
            Text(label).font(.system(size: 10)).foregroundStyle(NavTheme.creamDim)
        }
    }
}
