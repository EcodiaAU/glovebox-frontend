// src/lib/native/carPlay.ts
//
// Thin wrapper around the RoamCarPlayBridge Capacitor plugin.
// - Catches platform mismatch errors so callers don't need to gate on
//   Capacitor.getPlatform() === "ios" themselves.
// - Provides `useCarPlayBridgeSync` which pushes ActiveNav state + position
//   ticks to the in-process iOS singleton so the CarPlay scene can render
//   the trip without re-fetching anything.

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

import { RoamCarPlayBridge } from "@/plugins/roam-carplay-bridge";
import type {
  CarPlayTrip,
  CarPlayHazard,
  CarPlayFuelStop,
  CarPlayVehicle,
  CarPlayDriverLocation,
  CarPlayManeuver,
  CarPlayWaypoint,
} from "@/plugins/roam-carplay-bridge";

import type { NavPack, NavStep, NavLeg } from "@/lib/types/navigation";
import type { TripStop } from "@/lib/types/trip";
import type { ActiveNavState } from "@/lib/nav/activeNav";
import type { RoamPosition } from "@/lib/native/geolocation";

const isIos = (): boolean => Capacitor.getPlatform() === "ios";

const swallow = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    // Native bridge is not available (web dev, Android) or the call
    // failed for a reason we can't recover from. CarPlay is a best-effort
    // companion surface; never break the phone app over it.
    return null;
  }
};

// ──────────────────────────────────────────────────────────────
// Imperative setters (always safe to call - no-op on non-iOS)
// ──────────────────────────────────────────────────────────────

export const carPlay = {
  async setActiveTrip(trip: CarPlayTrip): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.setActiveTrip(trip));
  },
  async clearActiveTrip(): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.clearActiveTrip());
  },
  async setHazards(hazards: CarPlayHazard[]): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.setHazards({ hazards }));
  },
  async setFuelStops(fuelStops: CarPlayFuelStop[]): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.setFuelStops({ fuelStops }));
  },
  async setVehicle(vehicle: CarPlayVehicle): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.setVehicle(vehicle));
  },
  async setDriverLocation(location: CarPlayDriverLocation): Promise<void> {
    if (!isIos()) return;
    await swallow(RoamCarPlayBridge.setDriverLocation(location));
  },
  async isConnected(): Promise<boolean> {
    if (!isIos()) return false;
    const r = await swallow(RoamCarPlayBridge.isCarPlayConnected());
    return r?.connected ?? false;
  },
};

// ──────────────────────────────────────────────────────────────
// NavPack → CarPlayTrip conversion
// ──────────────────────────────────────────────────────────────

function modifierFromStep(step: NavStep): string | undefined {
  // OSRM-style maneuver { type, modifier } → CarPlay symbol modifier.
  const t = (step.maneuver?.type ?? "").toLowerCase();
  const m = (step.maneuver?.modifier ?? "").toLowerCase();
  if (t === "depart") return "depart";
  if (t === "arrive") return "arrive";
  if (t === "roundabout" || t === "rotary") return "roundabout";
  if (m === "uturn") return "uturn";
  if (m === "left") return "left";
  if (m === "right") return "right";
  if (m === "slight left") return "slight-left";
  if (m === "slight right") return "slight-right";
  if (m === "sharp left") return "sharp-left";
  if (m === "sharp right") return "sharp-right";
  if (m === "straight" || !m) return "straight";
  return undefined;
}

function navPackToCarPlayTrip(navpack: NavPack): CarPlayTrip | null {
  const primary = navpack.primary;
  if (!primary || !primary.geometry) return null;

  const legs: NavLeg[] = primary.legs ?? [];
  const stops: TripStop[] = navpack.req?.stops ?? [];
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  const originName = firstStop?.name ?? "Origin";
  const destinationName = lastStop?.name ?? "Destination";

  const waypoints: CarPlayWaypoint[] = stops.map((s, i) => ({
    name:
      s.name ??
      (i === 0
        ? "Origin"
        : i === stops.length - 1
          ? "Destination"
          : `Stop ${i}`),
    lat: s.lat,
    lng: s.lng,
  }));

  const maneuvers: CarPlayManeuver[] = [];
  let distanceFromStart = 0;
  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      const loc = step.maneuver?.location;
      const lng = loc?.[0];
      const lat = loc?.[1];
      if (lat == null || lng == null) {
        distanceFromStart += step.distance_m ?? 0;
        continue;
      }
      const mod = step.maneuver?.modifier ?? "";
      const t = step.maneuver?.type ?? "";
      let instruction: string;
      if (t === "arrive") {
        instruction = step.name ? `Arrive at ${step.name}` : "Arrive";
      } else if (t === "depart") {
        instruction = step.name ? `Head out on ${step.name}` : "Head out";
      } else if (t === "roundabout" || t === "rotary") {
        instruction = step.name
          ? `Take the roundabout to ${step.name}`
          : "Take the roundabout";
      } else if (step.name) {
        instruction = mod
          ? `Turn ${mod} onto ${step.name}`
          : `Continue onto ${step.name}`;
      } else {
        instruction = mod ? `Turn ${mod}` : "Continue";
      }
      maneuvers.push({
        instruction,
        lat,
        lng,
        distanceFromStartMeters: distanceFromStart,
        modifier: modifierFromStep(step),
      });
      distanceFromStart += step.distance_m ?? 0;
    }
  }

  return {
    routeKey: primary.route_key ?? "",
    geometryPolyline6: primary.geometry,
    distanceMeters: primary.distance_m ?? 0,
    durationSeconds: primary.duration_s ?? 0,
    originName,
    destinationName,
    waypoints,
    maneuvers,
  };
}

// ──────────────────────────────────────────────────────────────
// React hook: push ActiveNav state to CarPlay
// ──────────────────────────────────────────────────────────────

export interface CarPlayBridgeSyncOptions {
  navpack: NavPack | null;
  navStatus: ActiveNavState["status"];
  lastPosition: RoamPosition | null;
  hazards?: CarPlayHazard[] | null;
  fuelStops?: CarPlayFuelStop[] | null;
  vehicle?: CarPlayVehicle | null;
}

/**
 * Syncs the active trip + location + hazards + fuel + vehicle profile
 * from the phone scene to the iOS in-process singleton, so the CarPlay
 * scene can render without re-fetching. Safe to call on any platform -
 * non-iOS resolves to no-ops.
 */
export function useCarPlayBridgeSync({
  navpack,
  navStatus,
  lastPosition,
  hazards,
  fuelStops,
  vehicle,
}: CarPlayBridgeSyncOptions): void {
  const lastTripKey = useRef<string | null>(null);

  // Active trip lifecycle
  useEffect(() => {
    const isActive =
      navStatus === "navigating" ||
      navStatus === "off_route" ||
      navStatus === "rerouting";

    if (!isActive || !navpack) {
      if (lastTripKey.current) {
        lastTripKey.current = null;
        carPlay.clearActiveTrip();
      }
      return;
    }

    const cpTrip = navPackToCarPlayTrip(navpack);
    if (!cpTrip) return;
    const key = `${cpTrip.routeKey}:${cpTrip.geometryPolyline6.length}`;
    if (key === lastTripKey.current) return;
    lastTripKey.current = key;
    carPlay.setActiveTrip(cpTrip);
  }, [navpack, navStatus]);

  // Driver location ticks
  useEffect(() => {
    if (!lastPosition) return;
    carPlay.setDriverLocation({
      lat: lastPosition.lat,
      lng: lastPosition.lng,
      headingDegrees: lastPosition.heading ?? undefined,
      speedMps: lastPosition.speed ?? undefined,
      timestampMs: lastPosition.timestamp ?? Date.now(),
    });
  }, [lastPosition]);

  // Hazards
  useEffect(() => {
    if (hazards == null) return;
    carPlay.setHazards(hazards);
  }, [hazards]);

  // Fuel stops
  useEffect(() => {
    if (fuelStops == null) return;
    carPlay.setFuelStops(fuelStops);
  }, [fuelStops]);

  // Vehicle profile
  useEffect(() => {
    if (vehicle == null) return;
    carPlay.setVehicle(vehicle);
  }, [vehicle]);
}
