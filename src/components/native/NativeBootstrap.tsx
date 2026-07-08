// src/components/native/NativeBootstrap.tsx

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

import {
    configureStatusBar,
    configureKeyboard,
    lockPortrait,
    hideSplash,
    initAppLifecycle,
    onAppStateChange,
    initNotificationTapListener,
    requestNotificationPermission,
    requestLocationPermission,
    onNotificationTap,
} from "@/lib/native";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { networkMonitor } from "@/lib/offline/networkMonitor";
import { planSync } from "@/lib/offline/planSync";
import { initRevenueCat, rcFriendAppUserId } from "@/lib/paywall/tripGate";
import { supabase } from "@/lib/supabase/client";

// RevenueCat public SDK keys are platform-specific (iOS `appl_…`, Android
// `goog_…`) but the same web bundle ships in both native shells, so the key
// must be selected at runtime by platform - a single baked key is wrong on one
// of the two stores. Both are baked into the env (public client keys ship in
// the binary anyway; see docs/secrets/revenuecat.md). Legacy single-var env
// (VITE_REVENUECAT_API_KEY) is the last-resort fallback.
function resolveRcApiKey(): string {
  const ios = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  const android = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  const legacy = (import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined) ?? "";
  const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
  if (platform === "ios") return ios ?? legacy;
  if (platform === "android") return android ?? legacy;
  return legacy;
}
const RC_API_KEY = resolveRcApiKey();

/**
 * Invisible component that initializes all native Capacitor plugins.
 *
 * Mount once in the root layout. Renders nothing.
 *
 * Initialization order:
 *   1. Status bar → dark, transparent (instant visual)
 *   2. Screen orientation → lock portrait
 *   3. Keyboard → configure resize + done button
 *   4. App lifecycle → listen for foreground/background
 *   5. Notifications → request permission + listen for taps
 *   6. Splash screen → hide after all setup is done
 */
export function NativeBootstrap() {
  const router = useNavigate();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // A single bootstrap step failure must never prevent the splash from
    // hiding - otherwise we ship a black-screen build. Each step is wrapped
    // in its own catch and the splash hide runs in a finally.
    const safe = async (label: string, fn: () => Promise<unknown> | unknown) => {
      try { await fn(); } catch (e) { console.warn(`[NativeBootstrap] ${label} failed`, e); }
    };

    (async () => {
      try {
        await safe("configureStatusBar", configureStatusBar);
        await safe("lockPortrait", lockPortrait);
        await safe("configureKeyboard", configureKeyboard);
        await safe("initAppLifecycle", initAppLifecycle);

        onAppStateChange((state) => {
          if (state === "foreground") {
            networkMonitor.start();
            planSync.drainQueue();
          }
        });

        // Permissions run in parallel; either rejecting must not abort boot.
        await Promise.allSettled([
          requestNotificationPermission(),
          requestLocationPermission(),
        ]);
        await safe("initNotificationTapListener", initNotificationTapListener);

        onNotificationTap((extra) => {
          const type = extra?.type;
          if (type === "bundle_ready" || type === "sync" || type === "hazard") {
            router("/trip");
          }
        });

        App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url);
            if (parsed.pathname === "/auth/callback") {
              router("/auth/callback" + parsed.search + parsed.hash, { replace: true });
            }
          } catch {}
        });

        if (RC_API_KEY) {
          initRevenueCat(RC_API_KEY).catch(() => {});
          // Identify RC with the canonical FRIEND account id, not the local
          // Glovebox user id. The friend-iap-reconciler keys the server
          // entitlement row on RC's app_user_id == the Friend account id, so
          // logging in as the local user would orphan the purchase from the
          // Friend identity. friend_id lands in app_metadata after the
          // link_my_friend_id RPC + refreshSession (auth/callback), which fires
          // a TOKEN_REFRESHED here - so re-run on every auth change and let RC
          // alias if the id upgrades from local -> friend. Falls back to the
          // local user id when the person has not connected a Friend yet.
          supabase.auth.onAuthStateChange((_event, session) => {
            const appUserID = rcFriendAppUserId(session);
            if (appUserID) {
              import("@revenuecat/purchases-capacitor")
                .then(({ Purchases }) => Purchases.logIn({ appUserID }))
                .catch(() => {});
            }
          });
        }
      } finally {
        // Always hide the splash, even if a step above threw. The 150ms
        // delay gives the first React paint time to land so the transition
        // doesn't reveal an empty WebView.
        setTimeout(() => { hideSplash().catch(() => {}); }, 150);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
