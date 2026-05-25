import { useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { Capacitor } from "@capacitor/core";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
    return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

const subscribePlatform = () => () => {};

function usePlatform(): Platform {
  return useSyncExternalStore(subscribePlatform, detectPlatform, () => "desktop" as Platform);
}

// TODO: Replace with real App Store ID after first submission
const APP_STORE = "https://apps.apple.com/au/app/glovebox/id000000000";
const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=au.ecodia.roam";

const isNativeApp = typeof window !== "undefined" && Capacitor.isNativePlatform();

function useCtaConfig(platform: Platform) {
  return useMemo(() => {
    if (isNativeApp) {
      return { href: "/login", label: "Back to Glovebox", external: false };
    }
    switch (platform) {
      case "ios":
        return { href: APP_STORE, label: "Get the app", external: true };
      case "android":
        return { href: PLAY_STORE, label: "Get the app", external: true };
      default:
        return { href: "/trip", label: "Open Glovebox", external: false };
    }
  }, [platform]);
}

function extProps(external: boolean) {
  return external
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
}

interface LegalNavProps {
  /** The href of the current page, used to highlight the active nav link */
  activePath: string;
}

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Glovebox" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/attributions", label: "Attributions" },
];

export default function LegalNav({ activePath }: LegalNavProps) {
  const platform = usePlatform();
  const cta = useCtaConfig(platform);

  return (
    <>
      <style>{NAV_STYLES}</style>
      <nav className="gl-legal-nav" aria-label="Legal">
        <ul className="gl-legal-nav-list">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = activePath === href;
            const isHome = href === "/";
            return (
              <li key={href}>
                {isHome ? (
                  <a href="/" className={`gl-legal-nav-link${isActive ? " is-active" : ""}`}>
                    {label}
                  </a>
                ) : (
                  <Link
                    to={href}
                    className={`gl-legal-nav-link${isActive ? " is-active" : ""}`}
                  >
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
          <li className="gl-legal-nav-cta-item">
            {cta.external ? (
              <a href={cta.href} className="gl-legal-nav-link" {...extProps(true)}>
                <em>{cta.label}</em>
              </a>
            ) : (
              <Link to={cta.href} className="gl-legal-nav-link">
                <em>{cta.label}</em>
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}

const NAV_STYLES = `
.gl-legal-nav {
  margin: 0 0 clamp(40px, 6vh, 64px);
  padding: 0 0 clamp(20px, 3vh, 28px);
  border-bottom: 1px solid var(--fg-hairline);
}

.gl-legal-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4em 1.4em;
  font-size: 13.5px;
  letter-spacing: 0.04em;
}

.gl-legal-nav-link {
  color: var(--fg-trace);
  text-decoration: none;
  font-style: italic;
  font-weight: 400;
  transition: color 0.18s ease;
}

.gl-legal-nav-link:hover { color: var(--fg); }
.gl-legal-nav-link.is-active { color: var(--fg); }

.gl-legal-nav-cta-item {
  margin-left: auto;
}

.gl-legal-nav-cta-item .gl-legal-nav-link em {
  font-style: italic;
  border-bottom: 1px solid var(--fg-trace);
  padding-bottom: 1px;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.gl-legal-nav-cta-item .gl-legal-nav-link:hover em {
  border-bottom-color: var(--fg);
}

/* The page-content wrapper used by every legal page. The (legal)/layout
   wrapper already constrains width, so this is a no-op container kept
   for backwards compatibility with the existing page markup. */
.rl-legal-content {
  width: 100%;
}

@media (max-width: 540px) {
  .gl-legal-nav-list { gap: 0.4em 1em; font-size: 13px; }
  .gl-legal-nav-cta-item { margin-left: 0; width: 100%; margin-top: 0.4em; }
}
`;
