// src/app/(app)/live/LiveSkeleton.tsx
// Shared skeleton for the Live "Go Now" page. Used by both loading.tsx
// (route-level Suspense fallback) and ClientPage.tsx (the boot/route-build
// gate), so the in-component loading state matches the route-level one, the
// same way /trip shares TripSkeleton. Mirrors the real /live layout: map
// underlay + bottom sheet with the "Live Trip" header and Start Navigation
// button, so the shell feels continuous while the route is being built.

import type { CSSProperties } from "react";

function Skel({
  w,
  h,
  r = "var(--r-card)",
  delay = 0,
  style,
}: {
  w: number | string;
  h: number;
  r?: number | string;
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
        animation: `live-skel-pulse 1.6s ease-in-out infinite ${delay}s`,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function LiveSkeleton() {
  return (
    <div className="trip-app-container">
      {/* Map underlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "var(--surface-muted)",
          animation: "live-skel-pulse 1.6s ease-in-out infinite",
        }}
      />

      {/* Bottom sheet - peek position */}
      <div
        className="trip-bottom-sheet"
        style={{
          position: "absolute",
          bottom: -200,
          left: 0,
          right: 0,
          height: "calc(100% - 80px + 200px)",
          zIndex: 20,
          transform: "translateY(calc(100% - 420px - var(--glovebox-safe-bottom, 0px)))",
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: "16px 20px 6px", touchAction: "none" }}>
          <div className="trip-drag-handle" />
        </div>

        {/* Header: "Live Trip" title + Live badge */}
        <div style={{ padding: "0 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Skel w={100} h={22} delay={0.05} />
            <Skel
              w={44}
              h={20}
              r={999}
              delay={0.1}
              style={{ background: "var(--brand-eucalypt, #2d6e40)", opacity: 0.35 }}
            />
          </div>
          {/* "Online only · not saved to device" subtitle */}
          <Skel w={200} h={12} delay={0.12} style={{ marginTop: 6 }} />
        </div>

        {/* Start navigation button placeholder */}
        <div style={{ padding: "0 20px" }}>
          <Skel w="100%" h={48} delay={0.15} />
        </div>
      </div>

      <style>{`
        @keyframes live-skel-pulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
