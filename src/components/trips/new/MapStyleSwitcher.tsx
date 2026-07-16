import React, { useState } from "react";
import { haptic } from "@/lib/native/haptics";
import { Sun, Moon, Map as MapIcon, Satellite, Layers, X } from "lucide-react";

export type MapBaseMode = "vector" | "hybrid";
export type VectorTheme = "bright" | "dark";

/* ── Layout tokens (prototype: collapsed launcher button → 2x2 tile grid panel) */

type TileKey = "bright" | "dark" | "hybrid-bright" | "hybrid-dark";

const TILES: Array<{
  key: TileKey;
  label: string;
  mode: MapBaseMode;
  theme: VectorTheme;
  Icon: typeof Sun;
  preview: React.CSSProperties;
}> = [
  {
    key: "bright",
    label: "Bright",
    mode: "vector",
    theme: "bright",
    Icon: Sun,
    preview: {
      background:
        "linear-gradient(160deg, #f4efe6 0%, #e6e0d3 55%, #d8d0bf 100%)",
    },
  },
  {
    key: "dark",
    label: "Dark",
    mode: "vector",
    theme: "dark",
    Icon: Moon,
    preview: {
      background:
        "linear-gradient(160deg, #1f1d1a 0%, #14110e 55%, #0a0907 100%)",
    },
  },
  {
    key: "hybrid-bright",
    label: "Satellite",
    mode: "hybrid",
    theme: "bright",
    Icon: Satellite,
    preview: {
      background:
        "radial-gradient(circle at 30% 35%, #4a5b3a 0%, #2f4225 38%, #1d2c17 78%, #0e1a0a 100%)",
    },
  },
  {
    key: "hybrid-dark",
    label: "Satellite · Dark",
    mode: "hybrid",
    theme: "dark",
    Icon: Satellite,
    preview: {
      background:
        "radial-gradient(circle at 30% 35%, #2c3624 0%, #1a221a 42%, #0a0e0a 100%)",
    },
  },
];

function tileKey(mode: MapBaseMode, theme: VectorTheme): TileKey {
  if (mode === "hybrid") return theme === "dark" ? "hybrid-dark" : "hybrid-bright";
  return theme === "dark" ? "dark" : "bright";
}

const launcherBase: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 44,
  padding: "0 12px",
  borderRadius: "var(--r-card, 14px)",
  fontSize: 12,
  fontWeight: 700,
  // Theme-aware to match the layer button (Tate 2026-05-28): light surface in
  // day, dark surface in night, both via --glovebox-* tokens.
  color: "var(--glovebox-text, #faf6ef)",
  background: "var(--glovebox-surface, rgba(0,0,0,0.45))",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid var(--glovebox-border)",
  boxShadow: "var(--shadow-medium)",
  WebkitTapHighlightColor: "transparent",
};

export function MapStyleSwitcher(props: {
  mode: MapBaseMode;
  vectorTheme: VectorTheme;
  onChange: (next: { mode: MapBaseMode; vectorTheme: VectorTheme }) => void;
}) {
  const { mode, vectorTheme, onChange } = props;
  const [open, setOpen] = useState(false);
  const activeKey = tileKey(mode, vectorTheme);

  return (
    <div
      role="group"
      aria-label="Map style"
      style={{
        position: "absolute",
        // Clears the shell controls (SOS + account), a 40px row pinned top-right
        // at safe-top + 8px on every route since the tab bar was removed. Sharing
        // that corner puts the SOS button on top of this one, and SOS wins the
        // z-fight (as it must), which makes the style switcher unreachable.
        top: "calc(env(safe-area-inset-top, 0px) + 56px)",
        right: 10,
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        className="trip-interactive"
        onClick={() => { haptic.selection(); setOpen((v) => !v); }}
        aria-expanded={open}
        aria-label="Map style"
        style={launcherBase}
      >
        {open ? <X size={14} /> : <Layers size={14} />}
        {mode === "hybrid" ? "Sat" : "Map"}
      </button>

      {open && (
        <div
          style={{
            width: 224,
            padding: 10,
            borderRadius: 18,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(18px) saturate(1.3)",
            WebkitBackdropFilter: "blur(18px) saturate(1.3)",
            border: "1px solid var(--glovebox-border)",
            boxShadow: "var(--shadow-heavy)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            animation: "glovebox-mss-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {TILES.map((t) => {
            const isActive = t.key === activeKey;
            return (
              <button
                key={t.key}
                type="button"
                className="trip-interactive"
                onClick={() => {
                  haptic.selection();
                  onChange({ mode: t.mode, vectorTheme: t.theme });
                  setOpen(false);
                }}
                aria-pressed={isActive}
                title={t.label}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 6,
                  borderRadius: 12,
                  background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                  border: isActive
                    ? "1.5px solid var(--c-accent, var(--brand-sky, #4DB8F0))"
                    : "1.5px solid rgba(255,255,255,0.06)",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 140ms ease, border-color 140ms ease",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 8,
                    overflow: "hidden",
                    position: "relative",
                    ...t.preview,
                  }}
                >
                  {/* Faux route line for visual interest */}
                  <svg
                    width="100%" height="100%" viewBox="0 0 100 100"
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <path
                      d="M 8 78 Q 32 52, 52 56 T 92 22"
                      fill="none"
                      stroke={t.theme === "dark" ? "rgba(77,184,240,0.9)" : "rgba(26,111,166,0.75)"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="8" cy="78" r="3" fill={t.theme === "dark" ? "#4DB8F0" : "#1a6fa6"} />
                    <circle cx="92" cy="22" r="3" fill="var(--brand-ochre)" />
                  </svg>
                  <div
                    style={{
                      position: "absolute", top: 6, left: 6,
                      width: 22, height: 22, borderRadius: 999,
                      background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#faf6ef",
                    }}
                  >
                    {t.mode === "hybrid"
                      ? <Satellite size={11} />
                      : t.theme === "dark"
                        ? <Moon size={11} />
                        : <Sun size={11} />}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isActive
                      ? "var(--c-accent, var(--brand-sky, #4DB8F0))"
                      : "rgba(255,255,255,0.78)",
                    textAlign: "center",
                    letterSpacing: 0.1,
                  }}
                >
                  {t.label}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes glovebox-mss-pop {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* Legacy named exports preserved for any direct callers; unused internally
   but kept to avoid breaking imports referenced elsewhere. */
export const MAP_STYLE_TILES = TILES;
