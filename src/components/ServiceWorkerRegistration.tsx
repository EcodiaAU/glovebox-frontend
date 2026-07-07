import { useEffect } from "react";

/**
 * Registers the service worker and drives its update lifecycle on the web/PWA
 * path. No-ops on native Capacitor (which serves a local static bundle).
 *
 * Why the lifecycle matters: a plain `.register()` leaves cache invalidation to
 * the browser's opportunistic update check, and gives a client stuck on an old
 * worker no way to recover. Here we (1) proactively check for a new worker on
 * load, on focus, and hourly, (2) promote a freshly-installed worker so it
 * activates immediately, and (3) hard-reload ONCE when a new worker takes
 * control of an already-controlled page, so a shipped fix reaches every open
 * client instead of waiting indefinitely.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const sw = navigator.serviceWorker;
    let cleanup: (() => void) | undefined;

    // If the page is ALREADY controlled by a worker, a controller change means
    // a new deploy activated -> reload once onto the fresh shell. Guard against
    // reload loops. First-time visitors (no controller yet) are skipped so
    // their initial load is never disrupted.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    if (sw.controller) {
      sw.addEventListener("controllerchange", onControllerChange);
    }

    sw.register("/sw.js", { scope: "/" })
      .then((reg) => {
        const check = () => {
          reg.update().catch(() => {});
        };
        check();

        const onVisible = () => {
          if (document.visibilityState === "visible") check();
        };
        document.addEventListener("visibilitychange", onVisible);
        const interval = window.setInterval(check, 60 * 60 * 1000);

        // When an update installs while the page is controlled, tell the waiting
        // worker to skip waiting so it activates (-> controllerchange -> reload).
        const onUpdateFound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && sw.controller) {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        };
        reg.addEventListener("updatefound", onUpdateFound);

        cleanup = () => {
          document.removeEventListener("visibilitychange", onVisible);
          window.clearInterval(interval);
          reg.removeEventListener("updatefound", onUpdateFound);
        };
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      cleanup?.();
    };
  }, []);

  return null;
}
