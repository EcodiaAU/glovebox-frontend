import { useLocation, useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { haptic } from "@/lib/native/haptics";

/**
 * SOS and account, pinned to the app shell.
 *
 * These were tabs. The tab bar is gone (Glovebox is one page), and the reach a
 * tab gave them is the one thing that could not regress: SOS has to be one tap
 * away from wherever you are, with no trip planned, always.
 *
 * They live HERE rather than on the trip page because putting SOS on a page
 * quietly narrows it. `/trip` redirects to `/new` when you have no plan, and
 * `/new` is exactly where a first-time user lands, so an SOS button on the trip
 * page is an SOS button a new user cannot see. A safety affordance does not get
 * to depend on which route you happen to be on.
 *
 * Hidden only on `/sos` itself (you are already there) and on the login and
 * public-embed routes, which are not the app.
 */
const HIDE_ON = ["/sos", "/login", "/auth", "/embed"];

export function ShellControls() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        right: 8,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <button
        onClick={() => { haptic.medium(); navigate("/sos"); }}
        aria-label="SOS"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "var(--c-error, #c0392b)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-heavy)",
        }}
      >
        SOS
      </button>
      <button
        onClick={() => { haptic.selection(); navigate("/account"); }}
        aria-label="Account"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "var(--c-text, #1a1a1a)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-heavy)",
        }}
      >
        <Settings size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
