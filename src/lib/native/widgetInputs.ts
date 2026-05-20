// src/lib/native/widgetInputs.ts
//
// Maps the app's live nav state into the widget + Live Activity payloads.
// Isolated from the trip page so the mapping is testable on its own and the
// page just calls buildWidgetInputs(...) -> useWidgetSync(...).
//
// Reuses the already-derived CarPlay shapes (hazards/fuel/vehicle) so there
// is one derivation, not two.

import type { NavPack } from "@/lib/types/navigation";
import type { ActiveNavState } from "@/lib/nav/activeNav";
import type { RoamPosition } from "@/lib/native/geolocation";
import { haversineM } from "@/lib/nav/snapToRoute";
import type {
  CarPlayHazard,
  CarPlayFuelStop,
  CarPlayVehicle,
} from "@/plugins/roam-carplay-bridge";
import type { WidgetSyncOptions } from "@/lib/native/widgets";
import type {
  NavWidgetSnapshot,
  LiveActivityAttributes,
  LiveActivityState,
} from "@/plugins/nav-widgets-bridge";

export interface BuildWidgetInputsArgs {
  navpack: NavPack | null;
  nav: ActiveNavState;
  lastPosition: RoamPosition | null;
  isActive: boolean;
  hazards: CarPlayHazard[] | null;
  fuelStops: CarPlayFuelStop[] | null;
  vehicle: CarPlayVehicle | null;
  isOnline: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function maneuverInstruction(step: ActiveNavState["nextStep"]): string {
  if (!step) return "Continue";
  const t = (step.maneuver?.type ?? "").toLowerCase();
  const m = (step.maneuver?.modifier ?? "").toLowerCase();
  if (t === "arrive") return step.name ? `Arrive at ${step.name}` : "Arrive";
  if (t === "depart") return step.name ? `Head out on ${step.name}` : "Head out";
  if (t === "roundabout" || t === "rotary") return step.name ? `Roundabout to ${step.name}` : "Take the roundabout";
  if (step.name) return m ? `Turn ${m} onto ${step.name}` : `Continue onto ${step.name}`;
  return m ? `Turn ${m}` : "Continue";
}

function fuelSummary(
  fuelStops: CarPlayFuelStop[] | null,
  vehicle: CarPlayVehicle | null,
  kmAlongRoute: number,
): { tankFraction?: number; rangeKm?: number; lastChanceName?: string; distanceToLastChanceKm?: number } {
  let tankFraction: number | undefined;
  let rangeKm: number | undefined;
  if (vehicle && vehicle.tankCapacityLitres > 0 && vehicle.litresPer100Km > 0) {
    tankFraction = clamp01(vehicle.currentFuelLitres / vehicle.tankCapacityLitres);
    rangeKm = (vehicle.currentFuelLitres / vehicle.litresPer100Km) * 100;
  }
  const stops = (fuelStops ?? []).filter((s) => s.distanceAlongRouteMeters / 1000 >= kmAlongRoute - 1);
  const lastChance = stops.find((s) => s.isLastChance) ?? stops[0];
  return {
    tankFraction,
    rangeKm,
    lastChanceName: lastChance?.name,
    distanceToLastChanceKm: lastChance
      ? Math.max(0, lastChance.distanceAlongRouteMeters / 1000 - kmAlongRoute)
      : undefined,
  };
}

function nearestHazard(
  hazards: CarPlayHazard[] | null,
  pos: RoamPosition | null,
): { label?: string; distanceKm?: number; severity?: "minor" | "moderate" | "major" } {
  const items = hazards ?? [];
  if (!items.length) return {};
  const sevMap: Record<string, "minor" | "moderate" | "major"> = {
    info: "minor", warning: "moderate", critical: "major",
  };
  if (!pos) {
    const h = items[0];
    return { label: h.headline, severity: sevMap[h.severity] ?? "minor" };
  }
  let best: CarPlayHazard | null = null;
  let bestM = Infinity;
  for (const h of items) {
    const d = haversineM(pos.lat, pos.lng, h.lat, h.lng);
    if (d < bestM) { bestM = d; best = h; }
  }
  if (!best) return {};
  return { label: best.headline, distanceKm: bestM / 1000, severity: sevMap[best.severity] ?? "minor" };
}

export function buildWidgetInputs(args: BuildWidgetInputsArgs): WidgetSyncOptions {
  const { navpack, nav, lastPosition, isActive, hazards, fuelStops, vehicle, isOnline } = args;
  const now = Date.now();

  const stops = navpack?.req?.stops ?? [];
  const originName = stops[0]?.name ?? "Origin";
  const destinationName = stops[stops.length - 1]?.name ?? "Destination";
  const totalDistanceMeters = navpack?.primary?.distance_m ?? 0;
  const totalDurationSeconds = navpack?.primary?.duration_s ?? 0;
  const tripId = navpack?.primary?.route_key ?? "";

  const fuel = fuelSummary(fuelStops, vehicle, nav.kmAlongRoute);
  const hz = nearestHazard(hazards, lastPosition);
  const hazardItems = hazards ?? [];
  const floodCount = hazardItems.filter((h) => h.typeLabel === "flood").length;
  const fireCount = hazardItems.filter((h) => h.typeLabel === "fire").length;

  // ── Home-widget snapshot (always) ──
  const snapshot: NavWidgetSnapshot = {
    lastSyncedAtEpoch: now / 1000,
    isNavigating: isActive,
    position: lastPosition
      ? {
          lat: lastPosition.lat,
          lng: lastPosition.lng,
          headingDegrees: lastPosition.heading ?? undefined,
          speedMps: lastPosition.speed ?? undefined,
          accuracyMeters: lastPosition.accuracy ?? undefined,
          timestampEpoch: (lastPosition.timestamp ?? now) / 1000,
        }
      : undefined,
    fuel: (fuel.rangeKm != null || fuel.lastChanceName != null)
      ? {
          rangeKm: fuel.rangeKm,
          tankFraction: fuel.tankFraction,
          lastChanceName: fuel.lastChanceName,
          distanceToLastChanceKm: fuel.distanceToLastChanceKm,
        }
      : undefined,
    conditions: hazardItems.length
      ? {
          corridorName: destinationName !== "Destination" ? `${originName} to ${destinationName}` : undefined,
          hazardCount: hazardItems.length,
          floodCount,
          fireCount,
          summary: hz.label,
        }
      : undefined,
    nextTrip: navpack
      ? {
          tripId,
          name: destinationName !== "Destination" ? `${originName} to ${destinationName}` : "Planned trip",
          originName,
          destinationName,
          distanceKm: totalDistanceMeters / 1000,
          estFuelStops: (fuelStops ?? []).length,
          hazardCount: hazardItems.length,
        }
      : undefined,
    vehicle: vehicle
      ? {
          fuelEconomyL100: vehicle.litresPer100Km,
          tankLitres: vehicle.tankCapacityLitres,
        }
      : undefined,
  };

  // ── Live Activity (only while navigating) ──
  const navigating =
    isActive && (nav.status === "navigating" || nav.status === "off_route" || nav.status === "rerouting");

  let activity: LiveActivityAttributes | null = null;
  let liveState: LiveActivityState | null = null;

  if (navigating && navpack) {
    activity = { tripId, originName, destinationName, totalDistanceMeters, totalDurationSeconds };

    const gpsStale = lastPosition?.timestamp ? now - lastPosition.timestamp > 15000 : false;
    liveState = {
      legProgress: totalDistanceMeters > 0 ? clamp01(1 - nav.distRemaining_m / totalDistanceMeters) : 0,
      distanceRemainingMeters: nav.distRemaining_m,
      etaEpoch: nav.etaTimestamp / 1000,
      maneuverInstruction: maneuverInstruction(nav.nextStep),
      maneuverModifier: nav.nextStep?.maneuver?.modifier ?? nav.nextStep?.maneuver?.type ?? undefined,
      distanceToManeuverMeters: nav.distToNextManeuver_m,
      currentRoadName: nav.currentStep?.name ?? undefined,
      fuelTankFraction: fuel.tankFraction,
      fuelRangeKm: fuel.rangeKm,
      lastChanceFuelName: fuel.lastChanceName,
      distanceToLastChanceKm: fuel.distanceToLastChanceKm,
      hazardLabel: hz.label,
      distanceToHazardKm: hz.distanceKm,
      hazardSeverity: hz.severity,
      gpsStale,
      offline: !isOnline,
    };
  }

  return { navigating, activity, liveState, snapshot };
}
