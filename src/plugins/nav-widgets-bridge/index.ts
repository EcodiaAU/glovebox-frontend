// src/plugins/nav-widgets-bridge/index.ts
//
// Registers the NavWidgetsBridge Capacitor plugin.
// On native iOS: bridges to NavWidgetsBridge.swift.
// Elsewhere: web fallback no-ops.

import { registerPlugin } from "@capacitor/core";
import type { NavWidgetsBridgePlugin } from "./definitions";

const NavWidgetsBridge = registerPlugin<NavWidgetsBridgePlugin>(
  "NavWidgetsBridge",
  {
    web: () => import("./web").then((m) => new m.NavWidgetsBridgeWeb()),
  },
);

export { NavWidgetsBridge };
export type * from "./definitions";
