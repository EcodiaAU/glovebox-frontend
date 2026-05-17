// src/lib/native/backgroundLocation.ts
//
// Background-capable GPS tracking for active navigation.
//
// This wraps @capacitor/geolocation specifically for the active navigation
// use case where we need continuous position updates even when the screen
// is off or the user switches to Spotify.
//
// Different from useGeolocation hook:
//   - useGeolocation is for general map centering (foreground only)
//   - backgroundLocation is for active TBT navigation (background-capable)
//
// iOS requirements (in Info.plist):
//   NSLocationAlwaysAndWhenInUseUsageDescription
//   UIBackgroundModes: ["location", "audio"]
//
// Android requirements (in AndroidManifest.xml):
//   ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION,
//   FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION

import { Geolocation } from "@capacitor/geolocation";
import type { RoamPosition } from "./geolocation";

let watchId: string | null = null;
let lastPosition: RoamPosition | null = null;
let currentMode: BackgroundLocationMode = "nav";
let currentCallbacks: { onPosition?: PositionCallback; onError?: ErrorCallback } = {};

export type PositionCallback = (pos: RoamPosition) => void;
export type ErrorCallback = (err: unknown) => void;

// Battery-adaptive GPS mode. Caller flips between these based on nav state.
//   coarse: low-power, no active TBT (e.g. user parked, lunch stop).
//           enableHighAccuracy=false, ~30s freshness window, ~30s interval.
//   nav:    standard turn-by-turn at highway speeds.
//           enableHighAccuracy=true, 2s freshness, 1-2s interval.
//   hazard: high-precision near a hazard, fuel station, or turn instruction.
//           enableHighAccuracy=true, 0s freshness, 1s interval.
export type BackgroundLocationMode = "coarse" | "nav" | "hazard";

function watchOptionsForMode(mode: BackgroundLocationMode) {
  switch (mode) {
    case "coarse":
      return { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 };
    case "hazard":
      return { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    case "nav":
    default:
      return { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 };
  }
}

/**
 * Start continuous background-capable GPS tracking.
 *
 * Calls onPosition every ~1 second with high-accuracy GPS data.
 * On iOS, this keeps GPS alive in the background if Info.plist
 * is configured correctly.
 *
 * Safe to call multiple times - if already tracking, does nothing.
 */
export async function startBackgroundTracking(
  onPosition: PositionCallback,
  onError?: ErrorCallback,
  mode: BackgroundLocationMode = "nav",
): Promise<void> {
  if (watchId !== null) return; // already tracking

  currentMode = mode;
  currentCallbacks = { onPosition, onError };

  // Check permissions first
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location !== "granted" && status.coarseLocation !== "granted") {
      const req = await Geolocation.requestPermissions();
      if (req.location !== "granted" && req.coarseLocation !== "granted") {
        onError?.(new Error("Location permission denied"));
        return;
      }
    }
  } catch (e) {
    onError?.(e);
    return;
  }

  try {
    watchId = await Geolocation.watchPosition(
      watchOptionsForMode(mode),
      (position, err) => {
        if (err) {
          onError?.(err);
          return;
        }
        if (!position) return;

        const rp: RoamPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 999,
          altitude: position.coords.altitude ?? null,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          heading: position.coords.heading ?? null,
          speed: position.coords.speed ?? null,
          timestamp: position.timestamp,
        };

        lastPosition = rp;
        onPosition(rp);
      },
    );
  } catch (e) {
    onError?.(e);
  }
}

// Flip GPS power profile mid-flight (e.g. nav engine detected proximity to a
// hazard, or user came off the highway and parked). Restarts the underlying
// watch with the new options. Safe to call when not tracking (no-op).
export async function setBackgroundLocationMode(
  mode: BackgroundLocationMode,
): Promise<void> {
  if (mode === currentMode) return;
  currentMode = mode;
  if (watchId === null || !currentCallbacks.onPosition) return;
  const { onPosition, onError } = currentCallbacks;
  await stopBackgroundTracking();
  await startBackgroundTracking(onPosition, onError, mode);
}

export function getBackgroundLocationMode(): BackgroundLocationMode {
  return currentMode;
}

/**
 * Stop background GPS tracking.
 * Safe to call multiple times or when not tracking.
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (watchId !== null) {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch {
      // ignore - watch may already be cleared
    }
    watchId = null;
  }
  lastPosition = null;
}

/**
 * Whether we're currently tracking in background mode.
 */
export function isBackgroundTracking(): boolean {
  return watchId !== null;
}

/**
 * Get the last known position from background tracking.
 * Returns null if not tracking or no position received yet.
 */
function getLastBackgroundPosition(): RoamPosition | null {
  return lastPosition;
}
