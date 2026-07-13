import { useEffect } from "react";
import { Outlet } from "react-router";
import { PlaceDetailProvider } from "@/lib/context/PlaceDetailContext";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { SavedPlacesSync } from "@/components/places/SavedPlacesSync";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
import { FloatingGuideChat } from "@/components/guide/FloatingGuideChat";
import { ShellControls } from "@/components/ui/ShellControls";
export function AppLayout() {
  useEffect(() => {
    document.documentElement.classList.add("glovebox-shell");
    return () => document.documentElement.classList.remove("glovebox-shell");
  }, []);

  return (
    <PlaceDetailProvider>
      {/* Wires useSavedPlaces into PlaceDetailContext so the sheet can toggle bookmarks */}
      <SavedPlacesSync />
      <div className="glovebox-shell">
        {/* Persistent offline status - always visible, never dismissable.
            Pinned top-center so it doesn't collide with per-page corner
            controls (MapStyleSwitcher top-right, etc). */}
        <div style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
        }}>
          <OfflineStatusIndicator />
        </div>
        {/* One page. There is no tab bar.
            Glovebox does one thing, so it is one screen: the trip surface. SOS is
            reached from a persistent button on it (never a menu), and the co-pilot
            is the floating Friend chat below, which is already reachable from
            anywhere. The Guide tab and the SOS tab are gone: both were worse
            versions of something the phone or the ecosystem already had. */}
        {/* SOS + account live in the SHELL, not on a page.
            They used to be tabs, which meant they were reachable from EVERY screen.
            Putting SOS on the trip page alone silently narrowed that: /trip
            redirects to /new when you have no plan, and /new had no SOS at all. A
            safety affordance does not get to depend on which route you happen to
            be on. */}
        <ShellControls />
        <main className="glovebox-main">
          <Outlet />
        </main>
        {/* Global place detail sheet - opened via usePlaceDetail().openPlace() from anywhere */}
        <PlaceDetailSheet />
        {/* The co-pilot. Friend replaced the in-app Guide, and it is gated on the
            pass (see lib/paywall/tripGate). Floating, so it is reachable from the
            single page without costing a tab. */}
        <FloatingGuideChat />
      </div>
    </PlaceDetailProvider>
  );
}

export default AppLayout;
