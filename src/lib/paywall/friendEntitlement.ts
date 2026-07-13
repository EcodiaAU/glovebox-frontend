// src/lib/paywall/friendEntitlement.ts
//
// The Friend entitlement. This module answers exactly one question:
// does this user have the Friend plan?
//
// PRICING MODEL (Tate 2026-07-13). Navigation is free, permanently and
// completely: offline maps, routing, turn-by-turn, fuel range, SOS, trip
// planning and offline packs cost nothing and are not counted. There is no
// free-trip limit and no Glovebox-only SKU. The ONLY paid thing in Glovebox is
// the co-pilot, and the co-pilot is Friend. One AI, one subscription, one
// entitlement, across every Ecodia app.
//
// This file was `tripGate.ts` until 2026-07-13. It carried a trip counter
// (`user_trip_counts`, `/api/trips/increment`, a 2-free-trip limit) and gated
// planning behind three Glovebox-only passes. All of that is retired: every
// Glovebox-only SKU was a door leading away from Friend. The trip-count
// machinery is gone; the entitlement check is what remains.
//
// SOURCE OF TRUTH:
//   - Native (iOS/Android Capacitor) -> RevenueCat, entitlement `friend`
//   - Web browser                    -> Stripe Checkout, mirrored into the
//                                       Supabase `user_entitlements` row
//   - localStorage is a device-bound cache, never the primary source.
//
// GRANDFATHERING: `roam_unlimited` (the v1 lifetime non-consumable, iOS only)
// still counts as entitled. Those buyers keep the co-pilot forever.

import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";

// Lazy-loaded to keep RevenueCat (~120KB) out of the initial bundle.
// Only loaded on native platforms when actually needed.
async function getPurchases() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod;
}

const KEY_UNLOCKED = "roam_unlimited_unlocked";
// Test-only flag set by the Account page's "Reset paywall cache" button.
// While present, syncUnlockFromRC short-circuits so the device's Apple-ID-tied
// IAP doesn't immediately restore the unlock flag after the button clears it.
// Cleared on the next successful purchase or restore so production users
// never get stuck in test mode. Tate 2026-05-29: the prior reset button was
// undone within milliseconds by RC re-sync; this flag is the test-mode toggle
// that lets the purchase flow be exercised end-to-end on a real device.
export const KEY_TEST_BLOCK_RC = "glovebox_test_block_rc";

// Friend IAP: native Glovebox sells the Friend "A little" plan (A$19.99/mo
// auto-renewable subscription) via Apple IAP / Play Billing through RevenueCat.
// Entitlement `friend`, offering `default`, product `friend_a_little_monthly`.
// The `roam_unlimited` lifetime non-consumable is GRANDFATHERED, so the check
// accepts EITHER entitlement.
const RC_ENTITLEMENT_ID = "friend";             // primary (Friend subscription)
const RC_ENTITLEMENT_LEGACY = "roam_unlimited"; // grandfathered lifetime buyers
const RC_ENTITLEMENT_IDS = [RC_ENTITLEMENT_ID, RC_ENTITLEMENT_LEGACY];
const RC_OFFERING_ID = "default";
const RC_PRODUCT_ID = "friend_a_little_monthly"; // Friend "A little" monthly sub
const RC_PRODUCT_IDS = [RC_PRODUCT_ID, RC_ENTITLEMENT_LEGACY]; // sub + legacy SKU

// Resolve entitlement from a CustomerInfo response.
//
// Primary check: the `friend` entitlement (or the grandfathered `roam_unlimited`
// entitlement) is active in the RevenueCat dashboard mapping. Fallback: StoreKit
// confirmed a qualifying product was purchased even if the dashboard entitlement
// mapping is missing / mis-named. A paying user must never be locked out because
// of a dashboard config drift - the presence of a qualifying SKU in
// allPurchasedProductIdentifiers, an active subscription, or a non-subscription
// transaction is sufficient proof of entitlement.
type CustomerInfoLike = {
  entitlements?: { active?: Record<string, unknown>; all?: Record<string, unknown> };
  allPurchasedProductIdentifiers?: string[];
  activeSubscriptions?: string[];
  nonSubscriptionTransactions?: Array<{ productIdentifier?: string }>;
};
export function resolveUnlock(info: CustomerInfoLike | undefined | null): {
  unlocked: boolean;
  source: "entitlement" | "subscription-fallback" | "product-fallback" | "transaction-fallback" | "none";
} {
  if (!info) return { unlocked: false, source: "none" };
  const active = info.entitlements?.active ?? {};
  if (RC_ENTITLEMENT_IDS.some((id) => id in active)) {
    return { unlocked: true, source: "entitlement" };
  }
  if (info.activeSubscriptions?.some((s) => RC_PRODUCT_IDS.includes(s))) {
    return { unlocked: true, source: "subscription-fallback" };
  }
  if (info.allPurchasedProductIdentifiers?.some((p) => RC_PRODUCT_IDS.includes(p))) {
    return { unlocked: true, source: "product-fallback" };
  }
  if (info.nonSubscriptionTransactions?.some((t) => t?.productIdentifier && RC_PRODUCT_IDS.includes(t.productIdentifier))) {
    return { unlocked: true, source: "transaction-fallback" };
  }
  return { unlocked: false, source: "none" };
}

/**
 * The RevenueCat app_user_id to identify with. Prefers the canonical Friend
 * account id (app_metadata.friend_id, written by link_my_friend_id after a
 * Friend SSO login) so RC's app_user_id matches what the friend-iap-reconciler
 * keys the server entitlement row on. Falls back to the local Glovebox user id
 * before a Friend is connected. Returns null when there is no session.
 */
export function rcFriendAppUserId(session: Session | null): string | null {
  if (!session?.user) return null;
  const am = (session.user.app_metadata ?? {}) as Record<string, unknown>;
  const friendId = typeof am.friend_id === "string" ? am.friend_id : null;
  return friendId ?? session.user.id ?? null;
}

function summariseEntitlements(info: CustomerInfoLike | undefined | null): string {
  if (!info) return "no customerInfo";
  const active = Object.keys(info.entitlements?.active ?? {});
  const all = Object.keys(info.entitlements?.all ?? {});
  const subs = info.activeSubscriptions ?? [];
  const purchased = info.allPurchasedProductIdentifiers ?? [];
  const tx = (info.nonSubscriptionTransactions ?? []).map((t) => t?.productIdentifier).filter(Boolean);
  return `active=[${active.join(",")}] all=[${all.join(",")}] subs=[${subs.join(",")}] purchased=[${purchased.join(",")}] tx=[${tx.join(",")}]`;
}

/* ── Platform helper ─────────────────────────────────────────────── */

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/* ── Local cache helpers (localStorage) ─────────────────────────── */
// Device-bound cache only - never the primary source of truth.

function localGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function localSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

/* ── Supabase: entitlement status ────────────────────────────────── */

/** Returns true if the authenticated user has an entitlement row in Supabase.
 *  Returns null when we can't determine (no session yet, query error) so the
 *  caller can fall back to localStorage instead of treating "unknown" as "no".
 *
 *  IMPORTANT: Uses getSession() (reads from localStorage cache), not getUser()
 *  (network round-trip). Right after login the session is hydrated into the
 *  client before getUser() can validate with the server, so getUser() races
 *  and transiently returns null - which would make an entitled user look
 *  unentitled for the first few seconds. */
async function fetchUnlockFromSupabase(): Promise<boolean | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null; // not logged in / session not hydrated yet

    const { data, error } = await supabase
      .from("user_entitlements")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data !== null;
  } catch {
    return null;
  }
}

/* ── RevenueCat ──────────────────────────────────────────────────── */

let _rcReady = false;
let _rcInitPromise: Promise<void> | null = null;

export async function initRevenueCat(apiKey: string): Promise<void> {
  if (!isNativePlatform() || _rcReady) return;
  if (_rcInitPromise) return _rcInitPromise;

  _rcInitPromise = (async () => {
    try {
      const { Purchases, LOG_LEVEL } = await getPurchases();
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      await Purchases.configure({ apiKey });
      _rcReady = true;
    } catch (e) {
      console.warn("[friendEntitlement] RevenueCat init failed:", e);
      _rcInitPromise = null; // allow retry
    }
  })();

  return _rcInitPromise;
}

/** Wait for RC to be ready, with a timeout. Returns true if ready. */
async function ensureRCReady(): Promise<boolean> {
  if (_rcReady) return true;
  if (_rcInitPromise) {
    await Promise.race([_rcInitPromise, new Promise((r) => setTimeout(r, 5000))]);
  }
  return _rcReady;
}

/** Native only: check the RC entitlement and persist to Supabase + local cache. */
async function syncUnlockFromRC(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  // Test mode: Reset paywall cache button on the Account page sets this flag
  // so RC doesn't immediately restore the unlock flag from the device's
  // Apple-ID-tied IAP. Cleared on next successful purchase/restore (below).
  if (localGet(KEY_TEST_BLOCK_RC) === "1") return false;
  await ensureRCReady();
  if (!_rcReady) return false;
  try {
    const { Purchases } = await getPurchases();
    const { customerInfo } = await Purchases.getCustomerInfo();
    const { unlocked, source } = resolveUnlock(customerInfo);
    if (unlocked) {
      if (source !== "entitlement") {
        console.warn(
          `[friendEntitlement] syncUnlockFromRC unlocked via ${source} fallback - RC dashboard entitlement '${RC_ENTITLEMENT_ID}' likely not mapped to product '${RC_PRODUCT_ID}'. ${summariseEntitlements(customerInfo)}`
        );
      }
      // Persist to server so it's visible on web too
      await markEntitlementInSupabase("revenuecat");
      localSet(KEY_UNLOCKED, "1");
    }
    return unlocked;
  } catch {
    return false;
  }
}

async function markEntitlementInSupabase(source: "revenuecat" | "stripe" | "manual"): Promise<void> {
  try {
    // getSession (localStorage-cached), not getUser (network round-trip).
    // syncUnlockFromRC fires immediately after sign-in and getUser races
    // against the session-hydration window, transiently returning null. The
    // upsert then silently no-ops, no row is ever written, and subsequent
    // fetchUnlockFromSupabase reads return false even though RC said yes.
    // (Tate 2026-05-28 on TestFlight 1.1.1(1): logout-then-Apple-SSO cycle.)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("user_entitlements").upsert(
      { user_id: userId, source },
      { onConflict: "user_id,source" }
    );
    if (error) {
      console.warn(`[friendEntitlement] markEntitlementInSupabase upsert failed: ${error.message}`);
    }
  } catch (e) {
    console.warn(`[friendEntitlement] markEntitlementInSupabase threw:`, e);
  }
}

/* ── Public: purchase / restore (native) ────────────────────────── */

/** Buy the Friend plan through the native store sheet. */
export async function purchaseFriend(): Promise<{ success: boolean; error?: string }> {
  if (!isNativePlatform()) {
    return { success: false, error: "Use Stripe on web." };
  }

  const ready = await ensureRCReady();
  if (!ready) {
    return { success: false, error: "Payment service is still loading. Please wait a moment and try again." };
  }

  try {
    const { Purchases } = await getPurchases();

    // Preferred path: buy the configured package from the `default` offering so
    // the store sheet carries RevenueCat's server-side pricing + eligibility
    // (intro offers, price localisation). This is the Friend "A little" monthly
    // subscription (product friend_a_little_monthly).
    const { customerInfo, error: pkgError } = await purchaseFriendPackage(Purchases);
    if (pkgError === "cancelled") return { success: false, error: "cancelled" };

    // Fallback: if offerings could not be loaded (dashboard drift / transient),
    // buy the store product directly by identifier so a paying user is never
    // blocked by a mis-configured offering.
    const info = customerInfo ?? (await purchaseFriendProductDirect(Purchases)).customerInfo;
    if (!info) {
      return { success: false, error: pkgError ?? "Product not available. Please check your internet connection and try again." };
    }

    const { unlocked, source } = resolveUnlock(info);
    if (unlocked) {
      if (source !== "entitlement") {
        console.warn(
          `[friendEntitlement] purchase unlocked via ${source} fallback - RC dashboard entitlement '${RC_ENTITLEMENT_ID}' likely not mapped to product '${RC_PRODUCT_ID}'. ${summariseEntitlements(info)}`
        );
      }
      await markEntitlementInSupabase("revenuecat");
      localSet(KEY_UNLOCKED, "1");
      // Clear the test-block-RC flag - a real purchase ends test mode.
      try { localStorage.removeItem(KEY_TEST_BLOCK_RC); } catch {}
      return { success: true };
    }
    console.warn(`[friendEntitlement] purchase completed but entitlement not resolved. ${summariseEntitlements(info)}`);
    return { success: false, error: "Purchase completed but entitlement not found. Please tap Restore purchase." };
  } catch (e: unknown) {
    const err = e as { code?: string; userCancelled?: boolean; message?: string };
    if (err?.userCancelled || err?.code === "1") return { success: false, error: "cancelled" };
    return { success: false, error: err?.message ?? "Purchase failed. Please try again." };
  }
}

/** Purchase the Friend package from the `default` offering. Returns the
 *  resulting CustomerInfo, or an error marker (null customerInfo) when offerings
 *  are unavailable so the caller can fall back to a direct product purchase. */
async function purchaseFriendPackage(
  Purchases: Awaited<ReturnType<typeof getPurchases>>["Purchases"],
): Promise<{ customerInfo: CustomerInfoLike | null; error?: string }> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering =
      offerings.all?.[RC_OFFERING_ID] ?? offerings.current ?? null;
    const pkg =
      offering?.availablePackages?.find(
        (p) => p.product?.identifier === RC_PRODUCT_ID,
      ) ?? offering?.availablePackages?.[0];
    if (!pkg) return { customerInfo: null, error: "offering-empty" };
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { customerInfo };
  } catch (e: unknown) {
    const err = e as { code?: string; userCancelled?: boolean };
    if (err?.userCancelled || err?.code === "1") return { customerInfo: null, error: "cancelled" };
    return { customerInfo: null, error: "offering-error" };
  }
}

/** Direct-by-identifier fallback purchase of the Friend subscription product. */
async function purchaseFriendProductDirect(
  Purchases: Awaited<ReturnType<typeof getPurchases>>["Purchases"],
): Promise<{ customerInfo: CustomerInfoLike | null }> {
  try {
    const { products } = await Purchases.getProducts({ productIdentifiers: [RC_PRODUCT_ID] });
    const product = products.find((p) => p.identifier === RC_PRODUCT_ID);
    if (!product) return { customerInfo: null };
    const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
    return { customerInfo };
  } catch {
    return { customerInfo: null };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!isNativePlatform()) {
    return { success: false, error: "Restore is only available in the app." };
  }

  const ready = await ensureRCReady();
  if (!ready) {
    return { success: false, error: "Payment service is still loading. Please wait a moment and try again." };
  }

  try {
    const { Purchases } = await getPurchases();
    const { customerInfo } = await Purchases.restorePurchases();
    const { unlocked, source } = resolveUnlock(customerInfo);
    if (unlocked) {
      if (source !== "entitlement") {
        console.warn(
          `[friendEntitlement] restore unlocked via ${source} fallback - RC dashboard entitlement '${RC_ENTITLEMENT_ID}' likely not mapped to product '${RC_PRODUCT_ID}'. ${summariseEntitlements(customerInfo)}`
        );
      }
      await markEntitlementInSupabase("revenuecat");
      localSet(KEY_UNLOCKED, "1");
      // Clear the test-block-RC flag - a successful restore ends test mode.
      try { localStorage.removeItem(KEY_TEST_BLOCK_RC); } catch {}
    } else {
      console.warn(`[friendEntitlement] restore found no qualifying purchase. ${summariseEntitlements(customerInfo)}`);
    }
    return { success: unlocked, error: unlocked ? undefined : "No previous purchase found." };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Restore failed." };
  }
}

/* ── Public: web Stripe redirect ─────────────────────────────────── */

/** Redirects browser to Stripe Checkout. Does not return on success. */
export async function redirectToStripeCheckout(): Promise<{ error: string }> {
  try {
    // Always refresh to avoid sending a stale/expired access_token that causes 401s
    const { data: { session } } = await supabase.auth.refreshSession();
    const token = session?.access_token;
    const { url } = await api.post<{ url: string }>("/stripe/checkout", undefined, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    window.location.href = url;
    return { error: "" }; // unreachable
  } catch (err: unknown) {
    const e = err as { details?: { error?: string }; message?: string };
    return { error: e?.details?.error ?? e?.message ?? "Could not connect to payment service. Please try again." };
  }
}

/* ── Public: the entitlement check ───────────────────────────────── */

/**
 * Does this user have the Friend plan? This gates the co-pilot and NOTHING
 * else. Navigation, trip planning and offline packs never call it.
 *
 * Device-first per Tate 2026-05-28: an Apple-ID purchase is bound to the
 * device's StoreKit account, not to whichever Supabase user happens to be
 * signed in. The local KEY_UNLOCKED flag is set by syncUnlockFromRC the moment
 * RC confirms the purchase on this device, so it survives sign-out / sign-in
 * cycles. The server entitlement row is the BACKUP path, and it matters on
 * fresh installs where the local cache is gone but the user re-signs in with an
 * account that already carries the entitlement (including a Friend bought on
 * the web or in another Ecodia app, which the Friend gateway pushes across via
 * pushGloveboxPerk).
 */
export async function isUnlocked(): Promise<boolean> {
  if (localGet(KEY_UNLOCKED) === "1") return true;
  // Native: ask RevenueCat directly. The purchase may have happened on another
  // device under the same store account, or in another Ecodia app.
  if (isNativePlatform() && (await syncUnlockFromRC())) return true;
  const server = await fetchUnlockFromSupabase();
  return server === true;
}

/**
 * Subscribe to auth events that should trigger re-checking the entitlement.
 * Right after login the Supabase session takes a moment to hydrate into the
 * client; callers that ran their check before hydration finished need a chance
 * to re-run once the session is actually in place. Returns an unsubscribe
 * function.
 */
export function onAuthReadyForGate(cb: () => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      cb();
    }
  });
  return () => subscription.unsubscribe();
}
