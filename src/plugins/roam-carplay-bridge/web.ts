// src/plugins/roam-carplay-bridge/web.ts
//
// Web fallback - no-ops. CarPlay only exists on iOS so on web (dev) the
// bridge does nothing. addListener returns a remover that does nothing.

import { WebPlugin } from "@capacitor/core";
import type {
  RoamCarPlayBridgePlugin,
  CarPlayTrip,
  CarPlayHazard,
  CarPlayFuelStop,
  CarPlayVehicle,
  CarPlayDriverLocation,
} from "./definitions";

export class RoamCarPlayBridgeWeb extends WebPlugin implements RoamCarPlayBridgePlugin {
  async setActiveTrip(_trip: CarPlayTrip): Promise<void> {}
  async clearActiveTrip(): Promise<void> {}
  async setHazards(_args: { hazards: CarPlayHazard[] }): Promise<void> {}
  async setFuelStops(_args: { fuelStops: CarPlayFuelStop[] }): Promise<void> {}
  async setVehicle(_vehicle: CarPlayVehicle): Promise<void> {}
  async setDriverLocation(_location: CarPlayDriverLocation): Promise<void> {}
  async isCarPlayConnected(): Promise<{ connected: boolean }> {
    return { connected: false };
  }
}
