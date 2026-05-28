// src/plugins/glovebox-tile-server/index.ts
//
// Registers the GloveboxTileServer Capacitor plugin.
// On native (iOS/Android): bridges to Swift/Kotlin implementation.
// On web (dev): falls back to web.ts which returns remote URLs.

import { registerPlugin } from "@capacitor/core";
import type { GloveboxTileServerPlugin } from "./definitions";

const GloveboxTileServer = registerPlugin<GloveboxTileServerPlugin>("GloveboxTileServer", {
  web: () => import("./web").then((m) => new m.GloveboxTileServerWeb()),
});

export { GloveboxTileServer };
export type {
  GloveboxTileServerPlugin,
  StartServerOptions,
  StartServerResult,
  ServerStatusResult,
  DownloadOptions,
  DownloadResult,
  DownloadProgressEvent,
  BasemapInfoOptions,
  BasemapInfoResult,
  DeleteBasemapOptions,
} from "./definitions";