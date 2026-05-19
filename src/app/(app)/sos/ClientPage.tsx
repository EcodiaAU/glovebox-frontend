// src/app/(app)/sos/ClientPage.tsx
// 2026-05-19 redesign: rendered via roam-ui-v2/sos-screen.
// The previous 765-line implementation (real Supabase contacts, native geolocation,
// haptics wiring) lives at sos/ClientPage.legacy.tsx for the next pass that rewires
// real services into the new shell.

import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { SosScreen } from "@/components/roam-ui-v2/sos-screen";

export default function EmergencyClientPage() {
  const { online } = useNetworkStatus();
  return <SosScreen networkState={online ? "online" : "offline"} />;
}
