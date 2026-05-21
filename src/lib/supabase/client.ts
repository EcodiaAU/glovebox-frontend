// src/lib/supabase/client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// A web bundle built without .env.production (e.g. a fresh CI/clone build that
// never had the gitignored env file) bakes EMPTY values here. createClient()
// then throws "supabaseUrl is required" at module-eval, before React mounts -
// crashing the whole bundle into a permanent black screen on launch (this is
// exactly what shipped in Nav build 35). Degrade to a syntactically-valid
// placeholder so the offline-first app still boots and renders; auth + sync
// simply no-op until the env is fixed. The ship script (scripts/navship.sh)
// ALSO hard-fails the build if the URL is missing, so this branch should never
// be reachable in a real release - it is the last-resort safety net.
if (!SUPA_URL || !SUPA_ANON) {
  console.error(
    "[Nav] FATAL CONFIG: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing at " +
      "build time. The web bundle was built without .env.production - auth and " +
      "sync are disabled. Rebuild with the env present.",
  );
}

/**
 * Single Supabase client for the entire frontend.
 *
 * Uses localStorage for session persistence (works in both browser and
 * Capacitor WebView). The `autoRefreshToken` + `persistSession` defaults
 * handle token rotation automatically.
 */
export const supabase: SupabaseClient = createClient(
  SUPA_URL || "https://placeholder.supabase.co",
  SUPA_ANON || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // needed for OAuth redirect flow
    },
  },
);