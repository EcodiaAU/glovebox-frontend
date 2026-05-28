// src/app/(app)/new/NewTripSkeleton.tsx
// Loading shell for /new - matches StopsEditor peek layout.

import type { CSSProperties } from "react";

function Skel({
  w,
  h,
  r = 8,
  delay = 0,
  style,
}: {
  w: number | string;
  h: number;
  r?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "var(--glovebox-surface-hover)",
        animation: `trip-skel-pulse 1.6s ease-in-out infinite ${delay}s`,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function NewTripSkeleton() {
  return (
    <div className="trip-app-container">
      {/* ── Map placeholder ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "var(--surface-muted)",
          animation: "trip-skel-pulse 1.6s ease-in-out infinite",
        }}
      />

      {/* Sheet shell matches StopsEditor. The data-desktop-open attribute
          opts both wrap + inner into the left-side panel layout on >=900px
          via globals.css media queries; under 900px the inline transform
          drives the bottom-sheet peek position. */}
      <div
        className="trip-bottom-sheet-wrap"
        data-desktop-open="true"
        style={{
          transform: `translateY(calc(100% - 260px - 400px - var(--glovebox-safe-bottom, 0px)))`,
        }}
      >
        <div className="trip-bottom-sheet" data-desktop-open="true">
          {/* Drag handle + header - matches trip-sheet-header */}
          <div className="trip-sheet-header">
            <div className="trip-drag-handle" />

            <div className="trip-row-between">
              {/* Title + subtitle */}
              <div>
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    color: "var(--glovebox-text)",
                    letterSpacing: "-0.3px",
                    lineHeight: 1.2,
                  }}
                >
                  Plan Trip
                </div>
                <div
                  className="trip-muted-small"
                  style={{ marginTop: 2 }}
                >
                  Add stops. Tap save. Done.
                </div>
              </div>

              {/* 2 round icon buttons (Plans + AI Plan) */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Skel w={34} h={34} r={999} delay={0.1} />
                <Skel w={34} h={34} r={999} delay={0.15} />
              </div>
            </div>
          </div>

          {/* Sheet content - stop input rows + action buttons */}
          <div className="trip-sheet-content" style={{ paddingBottom: "calc(var(--bottom-nav-height, 80px) + 120px)" }}>
            {/* Stop rows (start + end) */}
            <div className="trip-flex-col">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: "var(--r-card)",
                    background: "var(--glovebox-surface-hover)",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    animation: `trip-skel-pulse 1.6s ease-in-out infinite ${0.05 + i * 0.08}s`,
                  }}
                >
                  {/* Stop marker circle */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-card)",
                      background: "var(--glovebox-surface)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 14, borderRadius: "var(--r-card)", background: "var(--glovebox-surface)", width: i === 0 ? "40%" : "55%" }} />
                    <div style={{ height: 11, borderRadius: "var(--r-card)", background: "var(--glovebox-surface)", width: "65%" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {/* Save & Go hero button placeholder - solid burnt orange */}
              <Skel w="100%" h={46} r={4} delay={0.2} style={{
                background: "#A8431F",
                opacity: 0.35,
              }} />

              {/* Add Stop + Go Now row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <Skel w="100%" h={38} r={4} delay={0.25} />
                <Skel w="100%" h={38} r={4} delay={0.3} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes trip-skel-pulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
