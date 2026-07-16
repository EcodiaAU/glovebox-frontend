import { useLocation, useNavigate } from "react-router";
import { Settings, MapPin } from "lucide-react";
import { haptic } from "@/lib/native/haptics";
import { Z, RAIL, RAIL_SLOT_ID } from "@/lib/ui/layers";
import { useNavStatus } from "@/lib/context/NavStatusContext";

/**
 * The one top-right control rail.
 *
 * SOS and account were tabs. The tab bar is gone (Glovebox is one page), and the
 * reach a tab gave them is the one thing that could not regress: SOS has to be
 * one tap away from wherever you are, with no trip planned, always.
 *
 * They live HERE rather than on the trip page because putting SOS on a page
 * quietly narrows it. `/trip` redirects to `/new` when you have no plan, and
 * `/new` is exactly where a first-time user lands, so an SOS button on the trip
 * page is an SOS button a new user cannot see. A safety affordance does not get
 * to depend on which route you happen to be on.
 *
 * ── Why this component owns a portal slot (2026-07-16) ────────────────────
 * It used to own only its own three buttons, and the map's controls (layer
 * switcher, road-report) floated separately over on the trip page. Nothing
 * connected them, so each file hardcoded its guess at where the others ended:
 * TripMap carried a SHELL_CONTROLS_CLEARANCE of 56px, ClientPage independently
 * put the report FAB at 116px, and the layer switcher landed at 108px. 108 and
 * 116 overlap. The buttons sat on top of each other, in different stacking
 * contexts, each invisible to the other - which is precisely what Tate reported.
 *
 * Three files coordinating pixel offsets by comment will drift again. So the
 * rail is now ONE flex column and the map controls portal into `RAIL_SLOT_ID`
 * beneath these buttons. Geometry comes from `gap`, not arithmetic, and two rail
 * items cannot overlap because they are siblings in a column. The clearance
 * constant is deleted rather than corrected.
 */
const HIDE_ON = ["/sos", "/login", "/auth", "/embed"];

export function ShellControls() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { navActive } = useNavStatus();

  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  /* In turn-by-turn the rail collapses to SOS alone.
     Tate: the buttons "shouldnt be there... they're overlapping hte top tbt
     card". The maneuver card is full-bleed (left:12/right:12), so anything in
     this corner lands on it.
     Places and Settings go: browsing places and changing settings are not things
     to be doing at 100km/h, and removing them is the fix.
     SOS STAYS. It is the one control whose entire reason for existing is the
     moment you are out on a road, and this app's users are on remote ones. The
     overlap is solved by moving it clear of the card (below), not by taking the
     emergency button away from the person driving. */
  const railTop = navActive ? RAIL.TOP + 84 : RAIL.TOP;

  return (
    <div
      className="gb-rail"
      style={{
        position: "fixed",
        top: `calc(env(safe-area-inset-top, 0px) + ${railTop}px)`,
        right: RAIL.RIGHT,
        // One value for every control in the rail. Below the drawers (60/70):
        // an open drawer is a modal surface, and a button painting on top of it
        // reads as a rendering bug - which is what these did to Friend at z90.
        // Above the sheet (50) so an expanded sheet cannot swallow SOS.
        zIndex: Z.RAIL,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: RAIL.GAP,
        // The rail is a layout box over a map: it must not eat map drags in the
        // gaps between its buttons. Children opt back in.
        pointerEvents: "none",
        transition: "top 180ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: RAIL.GAP, pointerEvents: "auto" }}>
        {/* Places: standalone place discovery, one tap from anywhere in the app,
            no trip required. Hidden on /places itself, and while driving. */}
        {pathname !== "/places" && !navActive && (
          <button
            onClick={() => { haptic.selection(); navigate("/places"); }}
            aria-label="Places"
            className="glovebox-shell-btn"
            style={{
              width: RAIL.BTN,
              height: RAIL.BTN,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-heavy)",
            }}
          >
            <MapPin size={18} strokeWidth={2} />
          </button>
        )}
        <button
          onClick={() => { haptic.medium(); navigate("/sos"); }}
          aria-label="SOS"
          style={{
            width: RAIL.BTN,
            height: RAIL.BTN,
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
        {!navActive && (
          <button
            onClick={() => { haptic.selection(); navigate("/account"); }}
            aria-label="Account"
            className="glovebox-shell-btn"
            style={{
              width: RAIL.BTN,
              height: RAIL.BTN,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-heavy)",
            }}
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Map controls dock here (layer switcher, road report). Empty and
          zero-height on routes with no map, so the rail costs nothing there.
          Kept mounted rather than conditionally rendered: the portal targets it
          by id on mount, so it has to exist before the map's first paint. */}
      <div
        id={RAIL_SLOT_ID}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: RAIL.GAP,
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
