// ios/App/NavWidgets/NavTheme.swift
//
// Brand system for the Nav. widgets + Live Activity.
// Rust ground, cream ink, the sun-over-horizon mark. Warnings shift the
// fuel gauge cream -> amber -> red.

import SwiftUI

public enum NavTheme {
    // Core palette
    public static let rust = Color(red: 0xA8/255, green: 0x43/255, blue: 0x1F/255)   // #A8431F
    public static let rustDeep = Color(red: 0x7E/255, green: 0x30/255, blue: 0x15/255) // darker rust for depth
    public static let cream = Color(red: 0xE8/255, green: 0xDF/255, blue: 0xC9/255)   // #E8DFC9
    public static let creamDim = Color(red: 0xE8/255, green: 0xDF/255, blue: 0xC9/255).opacity(0.55)
    public static let amber = Color(red: 0xE8/255, green: 0xA5/255, blue: 0x3F/255)
    public static let danger = Color(red: 0xD9/255, green: 0x53/255, blue: 0x40/255)

    /// Vertical rust gradient for widget/activity backgrounds.
    public static var ground: LinearGradient {
        LinearGradient(
            colors: [rust, rustDeep],
            startPoint: .top, endPoint: .bottom
        )
    }

    /// Fuel gauge colour by remaining tank fraction (or proximity to last-chance fuel).
    public static func fuelColor(tankFraction: Double?, distanceToLastChanceKm: Double?) -> Color {
        if let d = distanceToLastChanceKm, d <= 25 { return danger }
        if let d = distanceToLastChanceKm, d <= 80 { return amber }
        guard let f = tankFraction else { return cream }
        if f <= 0.15 { return danger }
        if f <= 0.30 { return amber }
        return cream
    }

    public static func hazardColor(_ severity: String?) -> Color {
        switch (severity ?? "").lowercased() {
        case "major": return danger
        case "moderate": return amber
        default: return cream
        }
    }

    /// OSRM-ish maneuver modifier -> SF Symbol.
    public static func maneuverSymbol(_ modifier: String?) -> String {
        switch (modifier ?? "straight").lowercased() {
        case "left": return "arrow.turn.up.left"
        case "right": return "arrow.turn.up.right"
        case "slight-left", "slight left": return "arrow.up.left"
        case "slight-right", "slight right": return "arrow.up.right"
        case "sharp-left", "sharp left": return "arrow.uturn.left"
        case "sharp-right", "sharp right": return "arrow.uturn.right"
        case "uturn": return "arrow.uturn.down"
        case "roundabout", "rotary": return "arrow.triangle.2.circlepath"
        case "arrive": return "mappin.and.ellipse"
        case "depart": return "location.north.line.fill"
        default: return "arrow.up"
        }
    }
}

/// The Nav. sun-over-horizon mark, drawn at any size in brand cream (or a tint).
public struct SunHorizonMark: View {
    public var tint: Color = NavTheme.cream
    public init(tint: Color = NavTheme.cream) { self.tint = tint }

    public var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let r = min(w, h) * 0.26
            ZStack {
                Circle()
                    .fill(tint)
                    .frame(width: r * 2, height: r * 2)
                    .position(x: w / 2, y: h * 0.42)
                Capsule()
                    .fill(tint)
                    .frame(width: w * 0.74, height: max(2, h * 0.07))
                    .position(x: w / 2, y: h * 0.62)
            }
        }
    }
}

/// A circular progress arc used for leg progress + fuel range.
public struct NavRing: View {
    public var progress: Double            // 0..1
    public var lineWidth: CGFloat
    public var color: Color
    public var track: Color
    public init(progress: Double, lineWidth: CGFloat = 8, color: Color = NavTheme.cream, track: Color = NavTheme.cream.opacity(0.22)) {
        self.progress = max(0, min(1, progress)); self.lineWidth = lineWidth; self.color = color; self.track = track
    }
    public var body: some View {
        ZStack {
            Circle().stroke(track, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}
