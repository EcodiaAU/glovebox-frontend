import { useEffect } from "react";
import { Outlet } from "react-router";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { PersistentTabs } from "@/components/ui/PersistentTabs";
import { PlaceDetailProvider } from "@/lib/context/PlaceDetailContext";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { SavedPlacesSync } from "@/components/places/SavedPlacesSync";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
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
        <main className="glovebox-main">
          <PersistentTabs>
            <Outlet />
          </PersistentTabs>
        </main>
        <BottomTabBar />
        {/* Global place detail sheet - opened via usePlaceDetail().openPlace() from anywhere */}
        <PlaceDetailSheet />
      </div>
    </PlaceDetailProvider>
  );
}

export default AppLayout;
