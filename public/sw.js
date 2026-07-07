// Glovebox service worker - offline-first app shell + asset caching.
//
// Strategy (see fix/sw-cache-invalidation-2026-07-07):
//   - Navigation (HTML): NETWORK-FIRST, cache fallback for offline. Online users
//     always get the current index.html referencing the current hashed bundles.
//   - Static assets (JS/CSS/img/fonts/manifest): STALE-WHILE-REVALIDATE. Serve
//     from cache instantly, refresh in the background, so a changed stable-URL
//     asset self-heals on the next load without waiting for a version bump.
//   - API / Supabase / auth: passthrough (the app owns its own offline layer).
//
// CACHE_VERSION is injected at BUILD TIME by the sw-build-id Vite plugin
// (vite.config.ts): the "__BUILD_ID__" placeholder is replaced with a hash of
// the emitted asset filenames, so every deploy that changes content produces a
// new service worker. A new SW => install + activate re-fire => the previous
// cache is purged and every controlled client force-reloads onto the fresh
// shell ONCE (see ServiceWorkerRegistration.tsx). This removes the old failure
// where cache invalidation depended on a human editing a constant, which left
// the cache frozen from 2026-05-28 onward.

const CACHE_VERSION = "glovebox-__BUILD_ID__";

// Minimal offline shell. Route pages are intentionally NOT pre-cached: Vercel
// rewrites every route to /index.html, so caching "/" alone covers the offline
// SPA fallback, and client-side routing takes over from there. Because
// CACHE_VERSION now changes every deploy, this shell is re-fetched fresh on
// each release and can never reference deleted (404-ing) hashed bundles.
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/img/glovebox-app-icon.png",
  "/img/glovebox-logo.png",
  "/img/noise.png",
  "/img/paper-texture.png",
  "/fonts/PlusJakartaSans-Bold.woff2",
  "/fonts/PlusJakartaSans-ExtraBold.woff2",
  "/fonts/Syne-Bold.woff2",
];

// ── Install: pre-cache the shell (resiliently) ────────────────────────────
// Cache each URL independently: a single 404 must not abort the whole install
// (cache.addAll is atomic and would leave the old worker in control forever).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.allSettled(
          SHELL_URLS.map((u) =>
            cache.add(new Request(u, { cache: "reload" })),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: purge every previous cache, take control immediately ────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Message: allow the page to promote a waiting worker (manual update flow) ─
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Passthrough: cross-origin, API, auth, and any non-GET request.
  if (
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    request.method !== "GET"
  ) {
    return; // let the browser handle it normally
  }

  // Navigation: network-first, fall back to the exact cached page, then "/".
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((exact) =>
          exact ?? caches.match("/").then((root) => root ?? Response.error()),
        ),
      ),
    );
    return;
  }

  // Static assets: stale-while-revalidate. Serve cache immediately when present
  // while refreshing it in the background; otherwise wait for the network and
  // fall back to any cached copy when offline.
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok && response.type === "basic") {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
