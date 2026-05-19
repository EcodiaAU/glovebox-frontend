// src/app/(app)/trip/ClientPage.tsx
// 2026-05-19 redesign: rendered via roam-ui-v2/trip-screen.
// The previous 2754-line implementation (real MapLibre, geolocation, plan
// state, navigation engine, fuel analysis, share + invite + paywall wiring)
// is preserved in git history and replaced wholesale by the prototype shell
// Tate approved on 2026-05-19. Real services wire back in via v2 follow-ups.

import { useState } from "react";
import { TripScreen } from "@/components/roam-ui-v2/trip-screen";

const DEFAULT_TWEAKS = {
  theme: "day",
  page: "trip",
  tripMode: "planning",
  mapStyle: "terrain",
  networkState: "corridor",
  enrichmentState: "done",
  fuelState: "warning",
  navProgress: 0.32,
  offRoute: false,
  alertSev: "moderate",
  nearbyRoamers: 2,
  tier: "free",
  clusterSize: "small",
  planningSnap: "default",
};

export function TripClientPage() {
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const setTweak = (key: string, value: unknown) =>
    setTweaks((t) => ({ ...t, [key]: value }));
  return <TripScreen tweaks={tweaks} setTweak={setTweak} />;
}

export default TripClientPage;
