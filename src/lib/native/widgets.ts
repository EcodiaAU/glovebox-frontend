// src/lib/native/widgets.ts
//
// Thin wrapper + React hook around the NavWidgetsBridge Capacitor plugin.
// Mirrors carPlay.ts: every call is safe on any platform (no-ops off iOS),
// and failures are swallowed - widgets are a best-effort companion surface,
// never a reason to break the app.
//
// Two jobs:
//   - keep the App Group snapshot fresh so the home/lock widgets render
//     offline (writeWidgetSnapshot);
//   - drive the navigation Live Activity start/update/end from the active
//     nav HUD state the caller already computes for the on-screen UI.

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

import { NavWidgetsBridge } from "@/plugins/nav-widgets-bridge";
import type {
  NavWidgetSnapshot,
  LiveActivityAttributes,
  LiveActivityState,
} from "@/plugins/nav-widgets-bridge";

const isIos = (): boolean => Capacitor.getPlatform() === "ios";

const swallow = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

// ──────────────────────────────────────────────────────────────
// Imperative API (safe to call anywhere)
// ──────────────────────────────────────────────────────────────

export const widgets = {
  async writeSnapshot(snapshot: NavWidgetSnapshot): Promise<void> {
    if (!isIos()) return;
    await swallow(NavWidgetsBridge.writeWidgetSnapshot({ json: JSON.stringify(snapshot) }));
  },
  async reload(): Promise<void> {
    if (!isIos()) return;
    await swallow(NavWidgetsBridge.reloadWidgets());
  },
  async liveActivitiesEnabled(): Promise<boolean> {
    if (!isIos()) return false;
    const r = await swallow(NavWidgetsBridge.areLiveActivitiesEnabled());
    return r?.enabled ?? false;
  },
  async startLiveActivity(attributes: LiveActivityAttributes, state: LiveActivityState): Promise<void> {
    if (!isIos()) return;
    await swallow(
      NavWidgetsBridge.startLiveActivity({
        attributes: JSON.stringify(attributes),
        state: JSON.stringify(state),
      }),
    );
  },
  async updateLiveActivity(state: LiveActivityState): Promise<void> {
    if (!isIos()) return;
    await swallow(NavWidgetsBridge.updateLiveActivity({ state: JSON.stringify(state) }));
  },
  async endLiveActivity(): Promise<void> {
    if (!isIos()) return;
    await swallow(NavWidgetsBridge.endLiveActivity());
  },
  async isLiveActivityRunning(): Promise<boolean> {
    if (!isIos()) return false;
    const r = await swallow(NavWidgetsBridge.isLiveActivityRunning());
    return r?.running ?? false;
  },
  /** Drain a one-shot widget/Siri/Control action ("start-next-trip" | "share-location" | "fuel" | "conditions"). */
  async consumePendingAction(): Promise<string | null> {
    if (!isIos()) return null;
    const r = await swallow(NavWidgetsBridge.consumePendingAction());
    return r?.action ?? null;
  },
};

// ──────────────────────────────────────────────────────────────
// useWidgetSync - keep snapshot + Live Activity in step with nav state
// ──────────────────────────────────────────────────────────────

export interface WidgetSyncOptions {
  /** True while actively navigating (drives the Live Activity lifecycle). */
  navigating: boolean;
  /** Fixed trip facts for the Live Activity (origin/dest/totals). Null when no trip. */
  activity: LiveActivityAttributes | null;
  /** Live progress for the running activity; recomputed by the caller each tick. */
  liveState: LiveActivityState | null;
  /** Offline blob for the home/lock widgets. Written whenever it changes. */
  snapshot: NavWidgetSnapshot | null;
  /** Minimum ms between Live Activity updates (ActivityKit budget friendly). Default 5000. */
  minUpdateMs?: number;
}

/**
 * Reconciles the Live Activity lifecycle (start on nav begin, throttled
 * updates, end on nav stop) and writes the home-widget snapshot on change.
 * Safe on any platform.
 */
export function useWidgetSync({
  navigating,
  activity,
  liveState,
  snapshot,
  minUpdateMs = 5000,
}: WidgetSyncOptions): void {
  const activeTripId = useRef<string | null>(null);
  const lastUpdateAt = useRef<number>(0);
  const lastSnapshotJson = useRef<string | null>(null);

  // Live Activity lifecycle + throttled updates
  useEffect(() => {
    if (!navigating || !activity || !liveState) {
      if (activeTripId.current) {
        activeTripId.current = null;
        widgets.endLiveActivity();
      }
      return;
    }

    if (activeTripId.current !== activity.tripId) {
      // New trip -> (re)start the activity.
      activeTripId.current = activity.tripId;
      lastUpdateAt.current = Date.now();
      widgets.startLiveActivity(activity, liveState);
      return;
    }

    // Same trip -> throttle updates. Always push immediately on a maneuver change.
    const now = Date.now();
    if (now - lastUpdateAt.current >= minUpdateMs) {
      lastUpdateAt.current = now;
      widgets.updateLiveActivity(liveState);
    }
  }, [navigating, activity, liveState, minUpdateMs]);

  // End the activity if the component unmounts mid-trip.
  useEffect(() => {
    return () => {
      if (activeTripId.current) {
        activeTripId.current = null;
        widgets.endLiveActivity();
      }
    };
  }, []);

  // Home-widget snapshot (write only when it actually changes).
  useEffect(() => {
    if (!snapshot) return;
    const json = JSON.stringify(snapshot);
    if (json === lastSnapshotJson.current) return;
    lastSnapshotJson.current = json;
    widgets.writeSnapshot(snapshot);
  }, [snapshot]);
}
