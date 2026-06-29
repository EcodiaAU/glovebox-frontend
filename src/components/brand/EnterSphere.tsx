/**
 * The front-door enter control: the canonical cream dot from the app icon, made
 * clickable (rust arrow + subtle lift). On click it reports its centre + size +
 * the platform's primary target via a 'gl-enter' event; the app-level
 * EnterTransition owns the grow/navigate/fade so the animation survives the
 * route change. When the primary platform is a store (not web), an "Open in
 * browser" link sits beneath the button.
 */
import { useRef } from 'react';
import { detectPlatform, GLOVEBOX_TARGETS, WEB_HREF } from '@/lib/brand/enter-platform';

const CREAM = '#E8DFC9';
const RUST = '#A8431F';

export function EnterSphere() {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const platform = detectPlatform();
  const target = GLOVEBOX_TARGETS[platform];

  function enter() {
    const r = btnRef.current?.getBoundingClientRect();
    const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const cy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    const size = r ? r.width : 56;
    window.dispatchEvent(
      new CustomEvent('gl-enter', {
        detail: { cx, cy, size, href: target.href, external: target.external },
      }),
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={enter}
        aria-label="Open Glovebox"
        className="gl-enter-dot"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: CREAM,
          color: RUST,
          cursor: 'pointer',
          boxShadow: '0 10px 34px rgba(0,0,0,.28)',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      {target.external ? (
        <a href={WEB_HREF} style={{ fontSize: 14, color: CREAM, opacity: 0.7, textDecoration: 'underline', textUnderlineOffset: 5 }}>
          Open in browser
        </a>
      ) : null}
    </div>
  );
}
