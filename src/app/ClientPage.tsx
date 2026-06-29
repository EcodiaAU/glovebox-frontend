import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import CopyEmail from "@/components/CopyEmail";
import { EcodiaAttribution } from "@/components/brand/EcodiaAttribution";
import { EnterSphere } from "@/components/brand/EnterSphere";
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

// iOS + Android aren't on the stores yet  only the web app is live  so the
// store links are omitted entirely until the native apps go live.

export default function LandingPage() {
  const isNative = useNativeRedirect();

  // Paint html + body burnt-orange so iOS Safari overscroll/rubber-band
  // shows the page colour instead of the system default. html bg is what
  // iOS exposes above/below content during the elastic bounce. Revert on
  // unmount so SPA navigation to other routes (e.g. /trip) doesn't carry
  // the marketing palette.
  useEffect(() => {
    if (isNative === null || isNative === true) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    html.style.backgroundColor = "#A8431F";
    body.style.backgroundColor = "#A8431F";
    body.style.overscrollBehaviorY = "contain";
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, [isNative]);

  if (isNative === null || isNative === true) return null;

  return (
    <div className="gl">

      <section className="gl-title">
        <div className="gl-title-stack">
          <p className="gl-sentence">
            <em>Offline Road Tripping for Australia</em>
          </p>
          <EnterSphere />
        </div>
      </section>

      <main className="gl-memo">
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
        <EcodiaAttribution style={{ fontSize: "14px" }} />
        <span className="gl-foot-links">
          <a href="/privacy">privacy</a>
          <span className="gl-sep" aria-hidden="true">·</span>
          <a href="/terms">terms</a>
          <span className="gl-sep" aria-hidden="true">·</span>
          <CopyEmail>code@ecodia.au</CopyEmail>
        </span>
      </footer>

    </div>
  );
}
