// src/components/nav/NavigationBar.tsx

import { memo } from "react";
import type { ActiveNavState } from "@/lib/nav/activeNav";
import type { FuelTrackingState } from "@/lib/types/fuel";
import { formatDistance, formatETA } from "@/lib/nav/instructions";
import { haptic } from "@/lib/native/haptics";
import { Fuel } from "lucide-react";

type Props = {
  nav: ActiveNavState;
  fuelTracking?: FuelTrackingState | null;
  visible: boolean;
  simple?: boolean;
  onTap?: () => void;
  onFuelStopTap?: () => void;
};

// Theme-aware: NavigationBar now uses the same theme-swapped surface as the
// HUD/PlanSheet (var(--c-nav-card)). Was previously hardcoded #242220, which
// stayed dark even when the app was set to bright mode.
const BAR_BG = "var(--c-nav-card, var(--glovebox-surface, #fff))";
const BAR_FG_PRIMARY = "var(--c-text, var(--glovebox-text))";
const BAR_FG_MUTED = "var(--c-text-muted, var(--glovebox-text-muted))";
const BAR_BORDER = "var(--c-border, var(--glovebox-border))";

/** Split "2:45 PM" → { time: "2:45", ampm: "PM" } */
function splitEta(eta: string): { time: string; ampm: string } {
  const parts = eta.split(" ");
  if (parts.length === 2) return { time: parts[0], ampm: parts[1] };
  return { time: eta, ampm: "" };
}

/** Compact duration: "2h 15m", "45m", "< 1m" */
function compactDuration(seconds: number): string {
  if (seconds < 60) return "< 1m";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `${hrs}h`;
  return `${hrs}h ${rem}m`;
}

export const NavigationBar = memo(function NavigationBar({ nav, fuelTracking, visible, simple, onTap, onFuelStopTap }: Props) {
  if (!visible) return null;

  const isMultiLeg = nav.totalLegs > 1;
  const primaryEta = isMultiLeg
    ? (nav.legEtaTimestamp > 0 ? formatETA(nav.legEtaTimestamp) : "--:--")
    : (nav.etaTimestamp > 0 ? formatETA(nav.etaTimestamp) : "--:--");
  const primaryDist = isMultiLeg
    ? formatDistance(nav.legDistRemaining_m)
    : formatDistance(nav.distRemaining_m);
  const primaryDur = isMultiLeg
    ? compactDuration(nav.legDurationRemaining_s)
    : compactDuration(nav.durationRemaining_s);

  const fuelText = fuelTracking
    ? fuelTracking.km_to_next_fuel !== null
      ? `${Math.round(fuelTracking.km_to_next_fuel)} km`
      : "--"
    : null;
  const fuelUrgent = !!fuelTracking?.is_critical;

  const cs = simple ? 72 : 66;
  const pad = simple ? 8 : 7;
  const h = cs + pad * 2;
  const speedKmh = nav.speed_mps != null && nav.speed_mps > 0.5
    ? Math.round(nav.speed_mps * 3.6) : null;

  const { time: etaTime, ampm: etaAmpm } = splitEta(primaryEta);

  return (
    <div
      className="glovebox-nav-bar"
      style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--glovebox-tab-h, 64px) + 14px)",
        left: 12,
        right: 12,
        zIndex: 30,
        pointerEvents: "auto",
      }}
      onClick={() => { haptic.light(); onTap?.(); }}
      role="status"
      aria-label="Navigation summary"
    >
      {/* Prototype ProgressCard: rounded card with a 4-stat quad row
           (ETA / KM LEFT / DURATION / SPEED) and a fuel pill below.
           Theme-aware via var(--c-nav-card) so it lightens in bright mode. */}
      <div
        className="nav-bar-progress"
        style={{
          background: BAR_BG,
          border: `1px solid ${BAR_BORDER}`,
          borderRadius: 18,
          padding: "12px 14px 10px",
          boxShadow: "var(--sh-floating, var(--shadow-heavy))",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Quad row: ETA · KM LEFT · DURATION · SPEED */}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}>
          {/* ETA - accented success color, like the prototype's green ETA */}
          <div>
            <div className="t-display t-num" style={{
              fontSize: simple ? 26 : 24,
              fontWeight: 800,
              color: "var(--c-success, var(--brand-eucalypt, #2d6e40))",
              lineHeight: 1,
              letterSpacing: "-0.4px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {etaTime}{etaAmpm && <span style={{ fontSize: 11, marginLeft: 2, color: BAR_FG_MUTED }}>{etaAmpm}</span>}
            </div>
            <div className="t-mono" style={{
              fontSize: 10, fontWeight: 700,
              color: BAR_FG_MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginTop: 3,
            }}>ARRIVE</div>
          </div>

          {/* KM LEFT */}
          <div style={{ textAlign: "center" }}>
            <div className="t-display t-num" style={{
              fontSize: simple ? 20 : 18,
              fontWeight: 800,
              color: BAR_FG_PRIMARY,
              lineHeight: 1,
              letterSpacing: "-0.3px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {primaryDist}
            </div>
            <div className="t-mono" style={{
              fontSize: 10, fontWeight: 700,
              color: BAR_FG_MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginTop: 3,
            }}>LEFT</div>
          </div>

          {/* DURATION */}
          <div style={{ textAlign: "center" }}>
            <div className="t-display t-num" style={{
              fontSize: simple ? 20 : 18,
              fontWeight: 800,
              color: BAR_FG_PRIMARY,
              lineHeight: 1,
              letterSpacing: "-0.3px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {primaryDur}
            </div>
            <div className="t-mono" style={{
              fontSize: 10, fontWeight: 700,
              color: BAR_FG_MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginTop: 3,
            }}>DURATION</div>
          </div>

          {/* SPEED - shown when moving; falls back to a placeholder dash */}
          <div style={{ textAlign: "right" }}>
            <div className="t-display t-num" style={{
              fontSize: simple ? 26 : 24,
              fontWeight: 800,
              color: BAR_FG_PRIMARY,
              lineHeight: 1,
              letterSpacing: "-0.4px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {speedKmh ?? "–"}
            </div>
            <div className="t-mono" style={{
              fontSize: 10, fontWeight: 700,
              color: BAR_FG_MUTED,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginTop: 3,
            }}>KM/H</div>
          </div>
        </div>

        {/* Fuel pill row - prototype's "To next fuel · 184 km" pill (accent-tint).
             Only rendered when we have a fuel-tracking distance. */}
        {fuelText && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              type="button"
              aria-label="Detour to nearest fuel station"
              onClick={(e) => {
                e.stopPropagation();
                haptic.medium();
                onFuelStopTap?.();
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 12px",
                borderRadius: 999,
                background: fuelUrgent
                  ? "var(--c-error-bg, rgba(181,69,46,0.18))"
                  : "var(--c-accent-tint, rgba(26,111,166,0.10))",
                color: fuelUrgent
                  ? "var(--c-error-text, var(--brand-ochre))"
                  : "var(--c-accent, var(--brand-sky, #1a6fa6))",
                border: 0,
                fontSize: simple ? 13 : 12,
                fontWeight: 700,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Fuel size={14} strokeWidth={2.2} className={fuelUrgent ? "nav-fuel-blink" : undefined} />
              <span style={{
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
              }}>
                {simple ? "Next servo" : `To next fuel · ${fuelText}`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
