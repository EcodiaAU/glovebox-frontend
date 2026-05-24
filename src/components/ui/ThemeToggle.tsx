// src/components/ui/ThemeToggle.tsx

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/context/ThemeContext";
import { haptic } from "@/lib/native/haptics";
import type { CSSProperties } from "react";

/* ── Day/Night toggle ────────────────────────────────────────────────
   Floats above the bottom tab bar at left, small and translucent so it
   doesn't compete with content. Suppressed on /trip where the map chrome
   already owns the corners and the in-map style picker offers light/dark
   per surface anyway.
   ──────────────────────────────────────────────────────────────────── */

const PILL: CSSProperties = {
  position: "fixed",
  bottom: "calc(var(--bottom-nav-height, 80px) + var(--roam-safe-bottom, 0px) + 10px)",
  left: "calc(var(--roam-safe-left, 0px) + 10px)",
  zIndex: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid var(--roam-border)",
  background: "color-mix(in srgb, var(--roam-surface) 65%, transparent)",
  backdropFilter: "blur(14px) saturate(140%)",
  WebkitBackdropFilter: "blur(14px) saturate(140%)",
  boxShadow: "var(--shadow-soft)",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  color: "var(--roam-text)",
  opacity: 0.78,
};

function useCurrentPath() {
  const [path, setPath] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.location.pathname
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    // SPA navigations don't fire popstate - poll on a slow interval is cheap
    const id = window.setInterval(update, 800);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      window.clearInterval(id);
    };
  }, []);
  return path;
}

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  const path = useCurrentPath();
  // Suppress on the trip surface - map style picker covers light/dark there
  // and the corner toggle was covering map UI underneath.
  if (path.startsWith("/trip")) return null;

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to Day mode" : "Switch to Tactical Night mode"}
      style={PILL}
      onClick={() => {
        haptic.selection();
        toggle();
      }}
    >
      {isDark ? (
        /* Moon icon - Tactical Night active */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        /* Sun icon - Day mode active */
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
    </button>
  );
}
