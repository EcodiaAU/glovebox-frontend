// src/components/brand/EcodiaAttribution.tsx
//
// The Ecodia attribution mark: "the world we build next" -> ecodia.au.
// EB Garamond italic signature, lowercase, opacity-recede. Inherits the
// surrounding text colour so it works on light and dark footers with no
// colour prop. Degrades to Georgia/Garamond where the webfont is absent
// (the glovebox footers already rely on the system serif, so no webfont
// is bundled for this line).
//
// Canonical spec (do NOT redesign):
//   patterns/ecodia-attribution-mark-the-world-we-build-next-2026-06-23.md
//
// Inline styles, not classnames: the glovebox footers ship scoped CSS that
// underlines every <a>, so text-decoration:none is set inline to win over
// `.gl a` / `.gl-legal-page a` without an !important class fight.

import type { CSSProperties } from "react";

type Props = {
  /** Extra inline styles merged last (e.g. font-size tweak for dense chrome). */
  style?: CSSProperties;
};

export function EcodiaAttribution({ style }: Props) {
  return (
    <a
      href="https://ecodia.au"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="the world we build next"
      style={{
        fontFamily: "'EB Garamond', Georgia, 'Times New Roman', serif",
        fontStyle: "italic",
        fontWeight: 400,
        fontSize: "15px",
        lineHeight: 1,
        textDecoration: "none",
        display: "inline-block",
        opacity: 0.6,
        transition: "opacity 0.2s ease",
        color: "inherit",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.6";
      }}
    >
      the world we build next
    </a>
  );
}

export default EcodiaAttribution;
