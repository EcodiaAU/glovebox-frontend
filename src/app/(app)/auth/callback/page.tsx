// src/app/auth/callback/page.tsx

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

/**
 * On a Friend (custom OIDC) login, copy the Friend sub into the local user's
 * app_metadata.friend_id via the link_my_friend_id RPC so this Glovebox user
 * is resolvable to the canonical Friend person. No-op for Google/Apple/email.
 * Best-effort: a failure never blocks sign-in (a later login retries).
 */
async function maybeLinkFriend(session: Session | null): Promise<void> {
  if (!session) return;
  const am = (session.user.app_metadata ?? {}) as Record<string, unknown>;
  const providers = Array.isArray(am.providers) ? (am.providers as unknown[]) : [];
  const isFriend =
    am.provider === "custom:friend" ||
    providers.some((p) => typeof p === "string" && p.includes("friend"));
  if (!isFriend || typeof am.friend_id === "string") return;
  try {
    await supabase.rpc("link_my_friend_id");
    // Pull the freshly-written friend_id into the live session claims.
    await supabase.auth.refreshSession();
  } catch {
    // Non-fatal.
  }
}

/**
 * OAuth redirect landing page.
 *
 * Runs in two contexts:
 *
 * A) Inside in-app browser (SFSafariViewController / Chrome Custom Tab):
 *    Capacitor.isNativePlatform() returns false because the browser is a
 *    separate process. We redirect to the au.ecodia.roam:// custom scheme
 *    so the OS hands the URL back to the app via appUrlOpen, which closes
 *    the in-app browser and navigates the main WebView here (context B).
 *
 * B) Main WebView (web or after deep-link handoff from A):
 *    Capacitor is present (native) or we're on web. Supabase exchanges the
 *    code via detectSessionInUrl, onAuthStateChange fires → /trip.
 */
export default function AuthCallbackPage() {
  const router = useNavigate();

  useEffect(() => {
    const params = window.location.search || window.location.hash;

    // Bounce to the au.ecodia.roam:// custom scheme ONLY for the native in-app
    // browser (SFSafariViewController / Chrome Custom Tab), where the OS hands
    // the URL back to the app. Plain WEB has no such scheme registered, so
    // bouncing there hangs the page on "Signing you in..." forever.
    //
    // The WEB sign-in tags its redirectTo with flow=web; the native sign-in does
    // NOT. So we bounce by DEFAULT (what an in-app browser needs) and skip the
    // bounce only when flow=web is present. Marked on web, not native, on
    // purpose: an already-installed native binary sends no marker and keeps
    // bouncing correctly, while the web build opts out. Before this guard the
    // condition was `!isNative && params`, which fired on web too and stranded
    // every web OAuth login.
    const isWebFlow = /[?&]flow=web(?:&|=|$)/.test(window.location.search);
    if (!Capacitor.isNativePlatform() && params && !isWebFlow) {
      window.location.href =
        "au.ecodia.roam://auth/callback" +
        window.location.search +
        window.location.hash;
      return;
    }

    // Main WebView (native or web): exchange code → session → navigate.
    // Guard so the two triggers (event + getSession) resolve only once.
    let handled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        onSignedIn(session);
      }
    });

    // Session may already be established by the time we mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) onSignedIn(data.session);
    });

    async function onSignedIn(session: Session) {
      if (handled) return;
      handled = true;
      // Federated-identity link (Friend path only; no-op otherwise).
      await maybeLinkFriend(session);
      // On native, close the in-app browser if it's still open
      if (Capacitor.isNativePlatform()) {
        import("@capacitor/browser")
          .then(({ Browser }) => Browser.close())
          .catch(() => {});
      }
      router("/trip", { replace: true });
    }

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Signing you in…</div>
        <div style={{ color: "var(--glovebox-muted, #888)" }}>Please wait</div>
      </div>
    </div>
  );
}
