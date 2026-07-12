// src/components/auth/SyncBootstrap.tsx

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { networkMonitor } from "@/lib/offline/networkMonitor";
import { planSync } from "@/lib/offline/planSync";
import { presenceBeacon } from "@/lib/offline/presenceBeacon";
import { syncSavedPlacesToCloud } from "@/lib/offline/savedPlacesSync";

/**
 * Invisible component mounted at the root layout level.
 *
 * Responsibilities:
 *   1. Start NetworkMonitor on mount (always, regardless of auth).
 *   2. Start PlanSync when user is authenticated.
 *   3. Start PresenceBeacon when user is authenticated (dead-reckoning pings).
 *   4. Sync saved places to cloud on auth + reconnect.
 *   5. Stop PlanSync + PresenceBeacon on sign-out.
 *
 * Emergency contacts are deliberately NOT here. They never leave the device
 * (the phone already backs up its own address book), so there is nothing to
 * sync. The Supabase table they used to mirror to was dropped 2026-07-12.
 *
 * Renders nothing.
 */
export function SyncBootstrap() {
  const { user, loading } = useAuth();
  const networkUnsubRef = useRef<(() => void) | null>(null);

  // Start network monitor once
  useEffect(() => {
    networkMonitor.start();
    return () => networkMonitor.stop();
  }, []);

  // Start/stop plan sync + presence beacon based on auth state
  // Also set up memory + saved places sync on reconnect
  useEffect(() => {
    if (loading) return;

    if (user?.id) {
      planSync.start(user.id);
      presenceBeacon.start();

      // Initial sync of saved places
      syncSavedPlacesToCloud().catch(() => {});

      // Re-sync whenever network comes back
      networkUnsubRef.current = networkMonitor.subscribe((isOnline) => {
        if (isOnline) {
          syncSavedPlacesToCloud().catch(() => {});
        }
      });
    } else {
      planSync.stop();
      presenceBeacon.stop();
      networkUnsubRef.current?.();
      networkUnsubRef.current = null;
    }

    return () => {
      planSync.stop();
      presenceBeacon.stop();
      networkUnsubRef.current?.();
      networkUnsubRef.current = null;
    };
  }, [user?.id, loading]);

  return null;
}