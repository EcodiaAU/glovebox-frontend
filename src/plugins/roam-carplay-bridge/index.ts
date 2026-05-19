// src/plugins/roam-carplay-bridge/index.ts
//
// Registers the RoamCarPlayBridge Capacitor plugin.
// On native iOS: bridges to RoamCarPlayBridge.swift.
// Elsewhere: web fallback no-ops.

import { registerPlugin } from "@capacitor/core";
import type { RoamCarPlayBridgePlugin } from "./definitions";

const RoamCarPlayBridge = registerPlugin<RoamCarPlayBridgePlugin>(
  "RoamCarPlayBridge",
  {
    web: () => import("./web").then((m) => new m.RoamCarPlayBridgeWeb()),
  },
);

export { RoamCarPlayBridge };
export type * from "./definitions";
