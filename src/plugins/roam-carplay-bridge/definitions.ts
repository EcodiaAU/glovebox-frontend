// src/plugins/roam-carplay-bridge/definitions.ts
//
// Capacitor plugin: RoamCarPlayBridge
// Pushes phone-app state to the iOS in-process singleton that the CarPlay
// scene reads from. The CarPlay scene runs in the same UIApplication
// process as the Capacitor WebView; state is shared via an in-process
// singleton + NotificationCenter, not via App Group UserDefaults, so no
// extra entitlements are needed beyond carplay-maps.

export interface CarPlayWaypoint {
  name: string;
  lat: number;
  lng: number;
}

export interface CarPlayManeuver {
  /** Voice-friendly instruction string ("Turn left onto Stuart Highway") */
  instruction: string;
  lat: number;
  lng: number;
  /** Metres from the start of the route to this maneuver point */
  distanceFromStartMeters: number;
  /** One of: left, right, slight-left, slight-right, sharp-left, sharp-right,
   *  uturn, straight, arrive, depart, roundabout */
  modifier?: string;
}

export interface CarPlayTrip {
  routeKey: string;
  geometryPolyline6: string;
  distanceMeters: number;
  durationSeconds: number;
  originName: string;
  destinationName: string;
  waypoints: CarPlayWaypoint[];
  maneuvers: CarPlayManeuver[];
}

export interface CarPlayHazard {
  id: string;
  lat: number;
  lng: number;
  /** "flood" | "fire" | "closure" | "wildlife" | "weather" | "surface" */
  typeLabel: string;
  /** "info" | "warning" | "critical" */
  severity: string;
  headline: string;
  detail?: string;
  distanceAlongRouteMeters?: number;
}

export interface CarPlayFuelStop {
  id: string;
  name: string;
  brand?: string;
  lat: number;
  lng: number;
  distanceAlongRouteMeters: number;
  isLastChance: boolean;
}

export interface CarPlayVehicle {
  litresPer100Km: number;
  tankCapacityLitres: number;
  currentFuelLitres: number;
}

export interface CarPlayDriverLocation {
  lat: number;
  lng: number;
  headingDegrees?: number;
  speedMps?: number;
  timestampMs: number;
}

export interface CarPlayConnectedEvent {}
export interface CarPlayDisconnectedEvent {}
export interface CarPlayDestinationPickedEvent {
  name: string;
  lat: number;
  lng: number;
}
export interface CarPlayHazardAcknowledgedEvent {
  hazardId: string;
}

export interface RoamCarPlayBridgePlugin {
  setActiveTrip(trip: CarPlayTrip): Promise<void>;
  clearActiveTrip(): Promise<void>;
  setHazards(args: { hazards: CarPlayHazard[] }): Promise<void>;
  setFuelStops(args: { fuelStops: CarPlayFuelStop[] }): Promise<void>;
  setVehicle(vehicle: CarPlayVehicle): Promise<void>;
  setDriverLocation(location: CarPlayDriverLocation): Promise<void>;
  isCarPlayConnected(): Promise<{ connected: boolean }>;

  addListener(
    eventName: "carPlayConnected",
    listenerFunc: (event: CarPlayConnectedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "carPlayDisconnected",
    listenerFunc: (event: CarPlayDisconnectedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "carPlayDestinationPicked",
    listenerFunc: (event: CarPlayDestinationPickedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "carPlayHazardAcknowledged",
    listenerFunc: (event: CarPlayHazardAcknowledgedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}
