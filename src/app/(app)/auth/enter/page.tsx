// src/app/auth/enter/page.tsx

import { useEffect, useRef } from "react";
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

/**
 * Force-federation entry point: /auth/enter?next=/
 *
 * "Open Glovebox" from Friend lands here. The browser may still hold a STALE
 * local Glovebox session (an old account, or a session minted before the
 * visitor switched Friend identities), so this route UNCONDITIONALLY restarts
 * the connect-with-Friend OIDC flow: no session check, no early return. The
 * round trip through the Friend IdP re-authenticates as the CURRENT Friend
 * identity and the code exchange on /auth/callback replaces whatever session
 * was sitting in localStorage.
 *
 * The client + option construction mirrors signInWithFriend's web branch in
 * lib/supabase/auth.tsx exactly (same singleton supabase client, same
 * provider, same origin-derived redirectTo) so PKCE verifier storage stays on
 * the identical localStorage discipline. Native never navigates here - the
 * AASA/assetlinks claim only /auth/callback - so this is a web-only surface
 * and needs none of the in-app-browser choreography.
 *
 * `next` is validated to a same-origin path (no scheme, no protocol-relative
 * "//host") before it rides along on the callback URL, so the entry route can
 * never be used as an open redirect.
 */
function safeNext(raw: string | null): string {
  const n = raw ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function AuthEnterPage() {
  // One shot per mount lifecycle: StrictMode double-invokes effects in dev,
  // and a second signInWithOAuth would overwrite the first call's PKCE
  // verifier in localStorage while the first call's authorize URL is already
  // navigating - a race that breaks the code exchange.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const next = safeNext(new URLSearchParams(window.location.search).get("next"));

    supabase.auth
      .signInWithOAuth({
        provider: "custom:friend" as Provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      .then(({ error }) => {
        // signInWithOAuth navigates via window.location on success, so this
        // only runs when GoTrue refused to even build the authorize URL.
        // Fall back to the landing page rather than stranding the visitor on
        // a blank trampoline.
        if (error) window.location.replace("/");
      });
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Opening with your Friend…</div>
        <div style={{ color: "var(--glovebox-muted, #888)" }}>Please wait</div>
      </div>
    </div>
  );
}
