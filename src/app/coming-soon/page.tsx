import { useEffect } from "react";
import "../landing.css";

/* Coming-soon page for the native apps. iOS + Android aren't on the stores
   yet  only the web app is live  so the landing's App Store / Google Play
   links land here. Reuses the rust `.gl` palette (#A8431F) from the landing. */
export default function ComingSoonPage() {
  useEffect(() => {
    document.title = "Glovebox  coming soon";
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
  }, []);

  return (
    <div className="gl">

      <section className="gl-title">
        <p className="gl-sentence">
          <em>Coming soon to the App Store and Google Play.</em>
        </p>
      </section>

      <main className="gl-memo">
        <p className="gl-row">
          <a href="/trip">Open in browser</a>
          <span className="gl-sep" aria-hidden="true">.</span>
          <a href="/">Back</a>
        </p>

        <p className="gl-section-label">in the meantime</p>
        <p>
          <em>
            The full Glovebox is already live in your browser. The native iOS
            and Android apps are on their way.
          </em>
        </p>
      </main>

    </div>
  );
}
