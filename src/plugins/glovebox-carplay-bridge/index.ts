// src/plugins/glovebox-carplay-bridge/index.ts
//
// Registers the GloveboxCarPlayBridge Capacitor plugin.
// On native iOS: bridges to GloveboxCarPlayBridge.swift.
// Elsewhere: web fallback no-ops.

import { registerPlugin } from "@capacitor/core";
import type { GloveboxCarPlayBridgePlugin } from "./definitions";

const GloveboxCarPlayBridge = registerPlugin<GloveboxCarPlayBridgePlugin>(
  "GloveboxCarPlayBridge",
  {
    web: () => import("./web").then((m) => new m.GloveboxCarPlayBridgeWeb()),
  },
);

export { GloveboxCarPlayBridge };
export type * from "./definitions";
