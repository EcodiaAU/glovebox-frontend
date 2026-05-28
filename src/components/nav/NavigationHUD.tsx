// src/components/nav/NavigationHUD.tsx

import { memo, useMemo } from "react";
import type { ActiveNavState } from "@/lib/nav/activeNav";
import { formatShort, formatDistance, maneuverIcon } from "@/lib/nav/instructions";

type Props = {
  nav: ActiveNavState;
  visible: boolean;
  simple?: boolean;
};

const ARROW_SVGS: Record<string, string> = {
  "arrow-up":          "M12 4 12 20M12 4 5 11M12 4 19 11",
  "arrow-left":        "M5 12 20 12M5 12 12 5M5 12 12 19",
  "arrow-right":       "M19 12 4 12M19 12 12 5M19 12 12 19",
  "arrow-slight-left": "M7 4 7 20M7 4 17 14",
  "arrow-slight-right":"M17 4 17 20M17 4 7 14",
  "arrow-sharp-left":  "M5 19 5 4M5 19 19 5",
  "arrow-sharp-right": "M19 19 19 4M19 19 5 5",
  "uturn-left":        "M5 20 5 10a7 7 0 0 1 14 0M5 20 1 16M5 20 9 16",
  "roundabout":        "M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 7 12 2M12 2 9 5M12 2 15 5",
  "roundabout-exit":   "M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M17 12 22 12M22 12 19 9M22 12 19 15",
  "merge-left":        "M6 4 12 12 12 20M18 4 12 12",
  "merge-right":       "M18 4 12 12 12 20M6 4 12 12",
  "fork-left":         "M12 20 12 12 5 4M12 12 19 4",
  "fork-right":        "M12 20 12 12 19 4M12 12 5 4",
  "ramp-left":         "M12 20 12 12 5 4",
  "ramp-right":        "M12 20 12 12 19 4",
  "offramp-left":      "M12 20 12 12 5 4M12 12 4 12",
  "offramp-right":     "M12 20 12 12 19 4M12 12 20 12",
  "arrive":            "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  "depart":            "M4 2v20M4 2l12 7-12 7",
};

export const NavigationHUD = memo(function NavigationHUD({ nav, visible, simple }: Props) {
  const currentStep = nav.currentStep;
  const nextStep    = nav.nextStep;
  const displayStep = nextStep ?? currentStep;

  const maneuverType     = displayStep?.maneuver?.type;
  const maneuverModifier = displayStep?.maneuver?.modifier;
  const iconName = useMemo(
    () => (displayStep ? maneuverIcon(displayStep.maneuver) : "arrow-up"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maneuverType, maneuverModifier],
  );

  const isImminent = nav.distToNextManeuver_m < 100;

  if (!visible || !displayStep) return null;

  // Prototype: 64x64 rounded-square accent-tint icon plate (was: full circle on dark).
  // Tile sizes scale slightly in simple mode for accessibility.
  const tile = simple ? 72 : 64;
  // The maneuver arrow always renders in the accent colour for legibility against
  // the accent-tint background, with an imminent override to ochre.
  const accentColor = isImminent
    ? "var(--brand-ochre, var(--c-cat-solar, #d97706))"
    : "var(--c-accent, var(--brand-sky, #1a6fa6))";
  const tilebg = isImminent
    ? "var(--c-warn-bg, rgba(217,119,6,0.14))"
    : "var(--c-accent-tint, rgba(26,111,166,0.12))";

  // Current road name — secondary descriptor.
  const streetText = currentStep?.name
    ? (currentStep.ref && !simple
        ? `${currentStep.name} · ${currentStep.ref}`
        : currentStep.name)
    : null;

  return (
    <div className="glovebox-nav-hud" style={{
      position: "absolute",
      top: "calc(env(safe-area-inset-top, 0px) + 12px)",
      left: 12,
      right: 12,
      zIndex: 30,
      pointerEvents: "none",
    }}>
      <div
        className="nav-hud-unroll"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 14,
          borderRadius: 18,
          /* Theme-aware: white in bright mode, near-black in tactical-night.
             Was hardcoded rgba(18,14,10,0.93) which never changed. */
          background: "var(--c-nav-card, var(--glovebox-surface, #fff))",
          border: "1px solid var(--c-border, var(--glovebox-border))",
          boxShadow: "var(--sh-floating, 0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10))",
          pointerEvents: "auto",
        }}
      >
        {/* Maneuver icon tile (prototype: rounded-square accent-tint, NOT a solid circle) */}
        <div
          className={isImminent ? "hud-imminent" : undefined}
          style={{
            flexShrink: 0,
            width: tile,
            height: tile,
            borderRadius: 16,
            background: tilebg,
            color: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.3s ease, color 0.3s ease",
          }}
        >
          <svg
            width={simple ? 38 : 34}
            height={simple ? 38 : 34}
            viewBox="0 0 24 24"
            style={{ overflow: "visible" }}
          >
            {(() => {
              const pathD    = ARROW_SVGS[iconName] ?? ARROW_SVGS["arrow-up"];
              const isArrive = iconName === "arrive" || iconName === "depart";
              return (
                <path
                  d={pathD}
                  fill={isArrive ? "currentColor" : "none"}
                  stroke={isArrive ? "none" : "currentColor"}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })()}
          </svg>
        </div>

        {/* Middle column: distance (big, accent) + short detail + current road name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="t-display glovebox-wrap-1"
            style={{
              fontWeight: 800,
              fontSize: simple ? 32 : 28,
              lineHeight: 1,
              letterSpacing: "-0.6px",
              color: accentColor,
              fontVariantNumeric: "tabular-nums",
              transition: "color 0.3s ease",
            }}
          >
            {formatDistance(nav.distToNextManeuver_m)}
          </div>
          <div
            className="glovebox-wrap-1"
            style={{
              marginTop: 3,
              fontSize: simple ? 13 : 12,
              fontWeight: 500,
              color: "var(--c-text-muted, var(--glovebox-text-muted))",
            }}
          >
            {formatShort(displayStep)}
          </div>
          {streetText && (
            <div
              className="glovebox-wrap-1"
              style={{
                marginTop: 2,
                fontSize: simple ? 16 : 15,
                fontWeight: 700,
                color: "var(--c-text, var(--glovebox-text))",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {streetText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
