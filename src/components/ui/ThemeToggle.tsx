// src/components/ui/ThemeToggle.tsx

import { useTheme } from "@/lib/context/ThemeContext";
import { haptic } from "@/lib/native/haptics";
import type { CSSProperties } from "react";

/* ── Day/Night toggle ────────────────────────────────────────────────
   Lives inside the Account page as a settings row. No longer floats in
   the app shell - the floating pill was covering content and reading as
   noise. The map style picker on /trip handles light/dark per surface;
   this toggles the app chrome theme globally for non-map screens.
   ──────────────────────────────────────────────────────────────────── */

const ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: "var(--r-card)",
  background: "var(--roam-surface)",
  border: "1px solid var(--roam-border)",
  width: "100%",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  color: "var(--roam-text)",
};

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
      style={ROW}
      onClick={() => {
        haptic.selection();
        toggle();
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10,
        background: "var(--accent-tint, color-mix(in srgb, var(--roam-accent) 12%, transparent))",
        color: "var(--roam-accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {isDark ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
      <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--roam-text)" }}>Theme</div>
        <div style={{ fontSize: 12, color: "var(--roam-text-muted)", marginTop: 1 }}>
          {isDark ? "Night" : "Day"}
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--roam-text-muted)",
      }}>
        Switch
      </span>
    </button>
  );
}
