// src/components/brand/GloveboxMark.tsx
//
// The Glovebox mark, lifted from the app icon. A sun cresting a
// horizon line. Inherits currentColor so the caller sets the tint
// via colour or CSS variable. Re-used on login, paywall, welcome,
// guide-intro, and any other editorial surface that needs the brand.

type Props = {
  size?: number | string;
  color?: string;
  ariaLabel?: string;
};

export function GloveboxMark({
  size = 56,
  color,
  ariaLabel = "Glovebox",
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label={ariaLabel}
      style={color ? { color } : undefined}
    >
      <circle cx="512" cy="450" r="133" fill="currentColor" />
      <line
        x1="205"
        y1="635"
        x2="819"
        y2="635"
        stroke="currentColor"
        strokeWidth="46"
        strokeLinecap="round"
      />
    </svg>
  );
}
