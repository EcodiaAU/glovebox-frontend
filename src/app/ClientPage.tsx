import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import "./landing.css";

/* Capacitor native shortcut: the marketing page never shows inside the app.
   First render before isNative resolves returns null so we don't flash the
   web landing inside the WebView. */
const subscribeNoop = () => () => {};
const getIsNative = () => Capacitor.isNativePlatform();
const getIsNativeServer = () => false;

function useNativeRedirect() {
  const navigate = useNavigate();
  const isNative = useSyncExternalStore(subscribeNoop, getIsNative, getIsNativeServer);
  useEffect(() => {
    if (isNative) navigate("/trip", { replace: true });
  }, [isNative, navigate]);
  return isNative;
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function usePlatform(): Platform {
  return useSyncExternalStore(subscribeNoop, detectPlatform, () => "desktop" as Platform);
}

const APP_STORE = "https://apps.apple.com/au/app/glovebox/id000000000";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=au.ecodia.roam";

export default function LandingPage() {
  const isNative = useNativeRedirect();
  const platform = usePlatform();
  if (isNative === null || isNative === true) return null;

  const primaryHref =
    platform === "ios" ? APP_STORE :
    platform === "android" ? PLAY_STORE :
    "/trip";
  const primaryLabel =
    platform === "ios" ? "Download for iPhone" :
    platform === "android" ? "Get it on Google Play" :
    "Open in browser";
  const primaryExt = platform !== "desktop";

  return (
    <div className="gl">

      <section className="gl-title">
        <p className="gl-sentence">
          <em>Offline navigation for the outback.</em>
        </p>
        <p className="gl-primary">
          <a
            href={primaryHref}
            {...(primaryExt ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {primaryLabel}
          </a>
        </p>
      </section>

      <main className="gl-memo">
        <p className="gl-lede">
          <em>
            Most navigation apps quit when the signal does. This one was
            built for the part of the trip where the signal stops.
          </em>
        </p>

        <p>
          Glovebox downloads the whole trip to your phone before you leave.
          Maps, fuel stations, road closures, voice directions. The map
          stays a map when you are past Longreach.
        </p>

        <p className="gl-section-label">install</p>
        <p className="gl-row">
          <a href={APP_STORE} target="_blank" rel="noopener noreferrer">App Store</a>
          <span className="gl-sep" aria-hidden="true">.</span>
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer">Google Play</a>
          <span className="gl-sep" aria-hidden="true">.</span>
          <a href="/trip">Open in browser</a>
        </p>

        <p className="gl-section-label">acknowledgement</p>
        <p>
          <em>
            Built on the lands of the Gubbi Gubbi people. We pay our respects
            to their Elders past and present, and to the Traditional
            Custodians of every track, highway, and river you will cross.
          </em>
        </p>
      </main>

      <footer className="gl-foot">
        <span className="gl-sig">
          A small thing from <a href="https://ecodia.au" target="_blank" rel="noopener noreferrer">Ecodia</a>.
        </span>
        <span className="gl-foot-links">
          <a href="/privacy">Privacy</a>
          <span className="gl-sep" aria-hidden="true">.</span>
          <a href="/terms">Terms</a>
          <span className="gl-sep" aria-hidden="true">.</span>
          <a href="mailto:hello@ecodia.au">Contact</a>
        </span>
      </footer>

    </div>
  );
}
