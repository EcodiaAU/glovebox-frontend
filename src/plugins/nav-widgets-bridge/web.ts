// src/plugins/nav-widgets-bridge/web.ts
//
// Web fallback. No widgets/Live Activities off-iOS; every method no-ops so
// callers never have to gate on platform.

import { WebPlugin } from "@capacitor/core";
import type { NavWidgetsBridgePlugin } from "./definitions";

export class NavWidgetsBridgeWeb extends WebPlugin implements NavWidgetsBridgePlugin {
  async writeWidgetSnapshot(): Promise<{ ok: boolean }> {
    return { ok: false };
  }
  async reloadWidgets(): Promise<void> {}
  async areLiveActivitiesEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }
  async startLiveActivity(): Promise<{ id: string }> {
    return { id: "" };
  }
  async updateLiveActivity(): Promise<{ running: boolean }> {
    return { running: false };
  }
  async endLiveActivity(): Promise<void> {}
  async isLiveActivityRunning(): Promise<{ running: boolean }> {
    return { running: false };
  }
  async consumePendingAction(): Promise<{ action: string | null }> {
    return { action: null };
  }
}
