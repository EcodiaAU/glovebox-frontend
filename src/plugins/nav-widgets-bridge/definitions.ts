// src/plugins/nav-widgets-bridge/definitions.ts
//
// Capacitor plugin contract for the native widgets + Live Activity.
// Payloads cross the bridge as JSON strings (version-proof; decoded into
// the shared Swift Codable models). Shapes here mirror NavWidgetModels.swift.

export interface WidgetPosition {
  lat: number;
  lng: number;
  headingDegrees?: number;
  speedMps?: number;
  accuracyMeters?: number;
  timestampEpoch: number; // seconds since 1970
}

export interface WidgetFuel {
  rangeKm?: number;
  tankFraction?: number; // 0..1
  lastChanceName?: string;
  distanceToLastChanceKm?: number;
}

export interface WidgetConditions {
  corridorName?: string;
  hazardCount: number;
  floodCount: number;
  fireCount: number;
  summary?: string;
}

export interface WidgetNextTrip {
  tripId?: string;
  name: string;
  originName?: string;
  destinationName?: string;
  distanceKm?: number;
  estFuelStops?: number;
  hazardCount?: number;
}

export interface WidgetVehicle {
  name?: string;
  fuelEconomyL100?: number;
  tankLitres?: number;
}

/** Mirrors NavWidgetSnapshot (the offline blob for home/lock widgets). */
export interface NavWidgetSnapshot {
  lastSyncedAtEpoch: number;
  isNavigating: boolean;
  position?: WidgetPosition;
  fuel?: WidgetFuel;
  conditions?: WidgetConditions;
  nextTrip?: WidgetNextTrip;
  vehicle?: WidgetVehicle;
}

/** Mirrors NavLiveActivityAttributes (fixed for the life of the activity). */
export interface LiveActivityAttributes {
  tripId: string;
  originName: string;
  destinationName: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

/** Mirrors NavLiveActivityAttributes.ContentState (dynamic, updated live). */
export interface LiveActivityState {
  legProgress: number; // 0..1
  distanceRemainingMeters: number;
  etaEpoch: number; // seconds since 1970
  maneuverInstruction: string;
  maneuverModifier?: string;
  distanceToManeuverMeters: number;
  currentRoadName?: string;
  fuelTankFraction?: number;
  fuelRangeKm?: number;
  lastChanceFuelName?: string;
  distanceToLastChanceKm?: number;
  hazardLabel?: string;
  distanceToHazardKm?: number;
  hazardSeverity?: "minor" | "moderate" | "major";
  gpsStale?: boolean;
  offline?: boolean;
}

export interface NavWidgetsBridgePlugin {
  writeWidgetSnapshot(options: { json: string }): Promise<{ ok: boolean }>;
  reloadWidgets(): Promise<void>;
  areLiveActivitiesEnabled(): Promise<{ enabled: boolean }>;
  startLiveActivity(options: { attributes: string; state: string }): Promise<{ id: string }>;
  updateLiveActivity(options: { state: string }): Promise<{ running: boolean }>;
  endLiveActivity(): Promise<void>;
  isLiveActivityRunning(): Promise<{ running: boolean }>;
  consumePendingAction(): Promise<{ action: string | null }>;
}
