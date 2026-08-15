// src/lib/supabase/auth.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User, AuthError, Provider } from "@supabase/supabase-js";
import { supabase } from "./client";
import { planSync } from "@/lib/offline/planSync";

import { Capacitor } from "@capacitor/core";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** True when signed in via the App Review demo account - no real Supabase session. */
  isDemoMode: boolean;

  /** "Connect your Friend" - federate into the shared Ecodia consumer identity (Friend IdP). */
  signInWithFriend: () => Promise<{ error: AuthError | null }>;

  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

// App Review demo credentials - allows Apple reviewers to access all features
// without requiring a real Supabase account to be set up.
const DEMO_EMAIL = "apple@ecodia.au";
const DEMO_PASSWORD = "appleecodia";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(() => {
    // Persist demo mode across reloads so reviewers don't get logged out
    // when the app restarts. Cleared on sign-out.
    try { return localStorage.getItem("glovebox_demo_mode") === "1"; } catch { return false; }
  });

  useEffect(() => {
    // Race getSession() against a short timeout so the app never hangs on
    // cold start when there is no network. Supabase persists the session in
    // localStorage so this resolves instantly from cache in the happy path;
    // the timeout only fires when the SDK tries to reach the server and stalls.
    const sessionTimeout = new Promise<{ data: { session: Session | null } }>(
      (resolve) => setTimeout(() => resolve({ data: { session: null } }), 2500),
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout]).then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // START/STOP SYNC BASED ON AUTH
  useEffect(() => {
    const uid = session?.user?.id ?? null;

    if (uid) {
      planSync.start(uid);
    } else {
      planSync.stop();
    }

    return () => {
      planSync.stop();
    };
  }, [session?.user?.id]);

  /**
   * "Connect your Friend" - sign in via the shared Ecodia consumer identity.
   *
   * Friend is a custom OIDC provider (custom:friend) on this project. The flow
   * mirrors Google exactly: Glovebox's GoTrue drives the OIDC handshake against
   * the Friend IdP and mints a LOCAL Glovebox session, so nothing about RLS or
   * the local user id changes. On the callback we copy the Friend sub into
   * app_metadata.friend_id (link_my_friend_id RPC) so this Glovebox user is
   * resolvable to the canonical Friend person.
   */
  const signInWithFriend = useCallback(async () => {
    // Same native/web redirect split as Google: on native we return to the web
    // callback which bounces to the au.ecodia.roam:// scheme; on web we use the
    // current origin so localhost dev returns to localhost.
    // `flow=native` tells the callback page it is running inside the native
    // in-app browser (which also reports !isNativePlatform()) so it bounces to
    // the au.ecodia.roam:// scheme; a real web browser omits it and exchanges
    // the code in-page.
    const redirectTo = Capacitor.isNativePlatform()
      ? "https://glovebox.ecodia.au/auth/callback?flow=native"
      : `${window.location.origin}/auth/callback`;

    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "custom:friend" as Provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error };
      if (data?.url) {
        const { Browser } = await import("@capacitor/browser");

        let settled = false;
        const timeout = setTimeout(async () => {
          if (!settled) {
            settled = true;
            Browser.close().catch(() => {});
          }
        }, 120_000);

        const closeHandler = await Browser.addListener("browserFinished", async () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          closeHandler.remove();
          setTimeout(async () => {
            const { data: sess } = await supabase.auth.getSession();
            if (!sess.session) {
              await supabase.auth.getSession();
            }
          }, 1000);
        });
        const isIpad =
          /iPad/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        await Browser.open({
          url: data.url,
          presentationStyle: isIpad ? "popover" : "fullscreen",
        });
      }
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "custom:friend" as Provider,
      options: { redirectTo },
    });
    return { error };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    // App Review demo account: bypass Supabase and enter demo mode so the
    // reviewer can access all features without a real account.
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      try { localStorage.setItem("glovebox_demo_mode", "1"); } catch {}
      setIsDemoMode(true);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem("glovebox_demo_mode"); } catch {}
    setIsDemoMode(false);
    await supabase.auth.signOut();
    setSession(null);
    planSync.stop();
    // Clear the per-account trial counter on signOut. Intentionally do NOT
    // clear roam_unlimited_unlocked - per Tate's device-driven entitlement
    // reframe 2026-05-28, an Apple-ID purchase is bound to the device and
    // should survive sign-out so the user is never re-paywalled for a
    // purchase StoreKit still owns.
    try { localStorage.removeItem("glovebox_trips_used"); } catch {}
  }, []);

  const deleteAccount = useCallback(async (): Promise<{ error: string | null }> => {
    // Irreversibly erase this Glovebox account server-side. delete_glovebox_account
    // runs SECURITY DEFINER and, in one atomic transaction, deletes every Glovebox
    // user-keyed row (trips, plans, saved places, emergency contacts, entitlements,
    // trip counts, plan memberships/invites, trip clones) and the auth.users record,
    // which cascades auth.identities - including the custom:friend link for THIS app.
    // It does NOT touch the separate Friend IdP account, and it CANNOT cancel an App
    // Store / Google Play subscription (only the store can - disclosed in the UI).
    const { error: rpcError } = await supabase.rpc("delete_glovebox_account");
    if (rpcError) {
      return { error: rpcError.message || "Failed to delete account. Please try again or contact support." };
    }
    // Server erased the user - tear down the local session and caches.
    planSync.stop();
    await supabase.auth.signOut();
    setSession(null);
    localStorage.removeItem("glovebox_trips_used");
    localStorage.removeItem("roam_unlimited_unlocked");
    try { localStorage.removeItem("glovebox_demo_mode"); } catch {}
    setIsDemoMode(false);
    return { error: null };
  }, []);

  const user = session?.user ?? null;

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user,
      isDemoMode,
      signInWithFriend,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      deleteAccount,
    }),
    [
      loading,
      session,
      user,
      isDemoMode,
      signInWithFriend,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
