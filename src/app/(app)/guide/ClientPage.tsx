// src/app/(app)/guide/ClientPage.tsx
// 2026-05-19 redesign: rendered via roam-ui-v2/guide-screen.
// Real services (guide AI streaming, plan progress, weather, fuel) wire in v2.

import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { GuideScreen } from "@/components/roam-ui-v2/guide-screen";

export default function GuideClientPage() {
  const { online } = useNetworkStatus();
  return <GuideScreen networkState={online ? "online" : "offline"} onTapPlace={() => {}} />;
}
