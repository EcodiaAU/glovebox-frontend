// ios/App/NavWidgets/NavAccessoryWidgets.swift
//
// Lock-screen accessory widgets (iOS 16+). The system tints these
// monochrome, so they rely on shape + SF Symbols, not brand colour.

import WidgetKit
import SwiftUI

// MARK: - Fuel (circular + inline)

struct NavFuelAccessory: Widget {
    let kind = "NavFuelAccessory"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavFuelAccessoryView(snapshot: entry.snapshot)
        }
        .configurationDisplayName("Fuel Range")
        .description("Range gauge on your lock screen.")
        .supportedFamilies([.accessoryCircular, .accessoryInline])
    }
}

private struct NavFuelAccessoryView: View {
    let snapshot: NavWidgetSnapshot
    @Environment(\.widgetFamily) private var family
    var body: some View {
        let f = snapshot.fuel
        switch family {
        case .accessoryInline:
            Label("\(Int((f?.rangeKm ?? 0).rounded())) km · \(f?.lastChanceName ?? "fuel")",
                  systemImage: "fuelpump.fill")
        default:
            ZStack {
                AccessoryWidgetBackground()
                Gauge(value: f?.tankFraction ?? 0) {
                    Image(systemName: "fuelpump.fill")
                } currentValueLabel: {
                    Text("\(Int((f?.rangeKm ?? 0).rounded()))")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                }
                .gaugeStyle(.accessoryCircular)
            }
            .widgetURL(NavDeepLink.fuel)
        }
    }
}

// MARK: - Conditions (rectangular)

struct NavConditionsAccessory: Widget {
    let kind = "NavConditionsAccessory"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NavProvider()) { entry in
            NavConditionsAccessoryView(snapshot: entry.snapshot)
        }
        .configurationDisplayName("Outback Conditions")
        .description("Corridor hazards on your lock screen.")
        .supportedFamilies([.accessoryRectangular])
    }
}

private struct NavConditionsAccessoryView: View {
    let snapshot: NavWidgetSnapshot
    var body: some View {
        let c = snapshot.conditions
        VStack(alignment: .leading, spacing: 2) {
            Label(c?.corridorName ?? "Conditions", systemImage: "exclamationmark.triangle.fill")
                .font(.system(size: 13, weight: .heavy)).lineLimit(1)
            Text("\(c?.hazardCount ?? 0) hazards · \(c?.floodCount ?? 0) flood · \(c?.fireCount ?? 0) fire")
                .font(.system(size: 12)).lineLimit(1)
            Text(NavFormat.syncedAgo(epoch: snapshot.lastSyncedAtEpoch))
                .font(.system(size: 10)).widgetAccentable()
        }
        .widgetURL(NavDeepLink.conditions)
    }
}
