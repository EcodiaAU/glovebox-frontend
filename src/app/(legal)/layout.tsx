import React from "react";
import { Outlet } from "react-router";
import { EcodiaAttribution } from "@/components/brand/EcodiaAttribution";

// Burnt-orange ground for the whole document while the legal pages are
// mounted. globals.css paints html/body --glovebox-bg (sand); the
// .gl-legal-page div paints orange on top, but an overscroll bounce past
// the top or bottom rubber-bands open to reveal the sand body underneath.
// Painting html + body the legal orange (and containing overscroll) makes
// the gutters orange too, so the ground reads as genuinely full-bleed.
// Restored on unmount so the app shell + other routes are untouched.
// Keep in sync with --bg in legal.module.css / the .gl-legal-page wrapper.
const LEGAL_BG = "#A8431F";

function useDocumentGround(color: string) {
  React.useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevOverscroll = body.style.overscrollBehaviorY;
    html.style.backgroundColor = color;
    body.style.backgroundColor = color;
    body.style.overscrollBehaviorY = "contain";
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      body.style.overscrollBehaviorY = prevOverscroll;
    };
  }, [color]);
}

export function LegalLayout() {
  useDocumentGround(LEGAL_BG);
  return (
    <>
      <style>{WRAPPER_CSS}</style>
      <div className="gl-legal-page">
        <main className="gl-legal-main">
          <Outlet />
        </main>
        <footer className="gl-legal-footer">
          <p>
            © {new Date().getFullYear()} Ecodia Pty Ltd · ABN 89693123278
          </p>
          <p>
            <em>Built on Gubbi Gubbi land, Sunshine Coast, Australia.</em>
          </p>
          <p>
            <EcodiaAttribution style={{ fontSize: "13px" }} />
          </p>
        </footer>
      </div>
    </>
  );
}

export default LegalLayout;

/* Wrapper-scoped tokens + base type. Inherits the marketing palette
   (burnt-orange #A8431F on cream #E8DFC9) and EB Garamond body. */
const WRAPPER_CSS = `
.gl-legal-page {
  --bg: #A8431F;
  --fg: #E8DFC9;
  --fg-trace: rgba(232, 223, 201, 0.45);
  --fg-soft: rgba(232, 223, 201, 0.7);
  --fg-hairline: rgba(232, 223, 201, 0.18);

  min-height: 100dvh;
  background: var(--bg);
  color: var(--fg);
  font-family: "EB Garamond", "Iowan Old Style", Garamond, "Times New Roman", serif;
  font-feature-settings: "kern", "liga", "dlig", "onum";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-size: clamp(17px, 1.4vw, 19px);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
}

.gl-legal-page ::selection { background: var(--fg); color: var(--bg); }

.gl-legal-page a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--fg-trace);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
  transition: text-decoration-color 0.18s ease, color 0.18s ease;
}
.gl-legal-page a:hover { text-decoration-color: var(--fg); }

.gl-legal-main {
  flex: 1;
  width: 100%;
  max-width: 62ch;
  margin: 0 auto;
  padding: clamp(40px, 8vh, 96px) clamp(24px, 5vw, 60px) clamp(40px, 6vh, 80px);
}

.gl-legal-footer {
  padding: clamp(24px, 4vh, 48px) clamp(24px, 5vw, 60px) clamp(20px, 3vh, 32px);
  border-top: 1px solid var(--fg-hairline);
  text-align: center;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--fg-trace);
  font-style: italic;
  line-height: 1.7;
}
.gl-legal-footer p { margin: 0; }
.gl-legal-footer p + p { margin-top: 0.3em; }
`;
