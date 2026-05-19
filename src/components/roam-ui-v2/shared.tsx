// roam-ui-v2/shared.tsx
// Ported from the 2026-05-19 Claude Designs prototype.
// Icons + pills + sheets + drawers + modals + buttons used by trip / guide / sos.

import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SVGProps,
} from "react";

/* ──────────────────────────────────────────────────────────────
   Icon library — line-style, 24x24, stroke="currentColor"
   ────────────────────────────────────────────────────────────── */

export type IconName =
  | "map" | "compass" | "nav" | "sos" | "guide" | "wifi" | "wifiOff" | "sync"
  | "user" | "plus" | "minus" | "chev" | "chevDown" | "chevLeft" | "x" | "dots"
  | "drag" | "layers" | "fuel" | "sparkle" | "share" | "invite" | "star" | "starFill"
  | "pin" | "clock" | "route" | "target" | "arrowUp" | "turnRight" | "turnLeft"
  | "mute" | "speaker" | "grid" | "warn" | "phone" | "msg" | "trash" | "edit"
  | "search" | "elev" | "drop" | "leaf" | "crown" | "radio" | "flag" | "addUser"
  | "bolt" | "eye" | "fire" | "cafe" | "mountain" | "tent" | "closure" | "wind"
  | "cluster" | "headset" | "rotate" | "open";

type IconProps = {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
} & Omit<SVGProps<SVGSVGElement>, "name" | "style" | "stroke" | "width" | "height">;

export function Icon({ name, size = 22, stroke = 1.8, style, ...rest }: IconProps) {
  const sw = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    map:        <g {...sw}><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2zm0 0v14m6-12v14"/></g>,
    compass:    <g {...sw}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13 13l-4.5 2.5L11 11l4.5-2.5z"/></g>,
    nav:        <g {...sw}><path d="M3 11l18-7-7 18-2-8-9-3z"/></g>,
    sos:        <g {...sw}><path d="M12 3l9 4-2 10a8 8 0 01-14 0L3 7l9-4z"/><path d="M12 8v4M12 16v.01"/></g>,
    guide:      <g {...sw}><path d="M4 6v13a1 1 0 001.4.9L12 18l6.6 1.9A1 1 0 0020 19V6a2 2 0 00-2-2H6a2 2 0 00-2 2z"/><path d="M12 18V8"/></g>,
    wifi:       <g {...sw}><path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5v.01"/></g>,
    wifiOff:    <g {...sw}><path d="M3 3l18 18M8.5 16a5 5 0 016-.8M5 12.5a10 10 0 0111-2.2"/></g>,
    sync:       <g {...sw}><path d="M21 12a9 9 0 01-15.4 6.3M3 12a9 9 0 0115.4-6.3M21 3v6h-6M3 21v-6h6"/></g>,
    user:       <g {...sw}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></g>,
    plus:       <g {...sw}><path d="M12 5v14M5 12h14"/></g>,
    minus:      <g {...sw}><path d="M5 12h14"/></g>,
    chev:       <g {...sw}><path d="M9 6l6 6-6 6"/></g>,
    chevDown:   <g {...sw}><path d="M6 9l6 6 6-6"/></g>,
    chevLeft:   <g {...sw}><path d="M15 6l-6 6 6 6"/></g>,
    x:          <g {...sw}><path d="M6 6l12 12M18 6L6 18"/></g>,
    dots:       <g {...sw}><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></g>,
    drag:       <g {...sw}><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></g>,
    layers:     <g {...sw}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 14l9 5 9-5"/></g>,
    fuel:       <g {...sw}><path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12"/><path d="M14 8l3 1v9a2 2 0 002 2 2 2 0 002-2v-9l-3-3"/><path d="M7 7h4v4H7z"/></g>,
    sparkle:    <g {...sw}><path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3z"/><path d="M19 14l.8 1.8L21.5 17l-1.7.5L19 19l-.8-1.5L16.5 17l1.7-1.2L19 14z"/></g>,
    share:      <g {...sw}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></g>,
    invite:     <g {...sw}><path d="M16 21a6 6 0 00-12 0"/><circle cx="10" cy="7" r="4"/><path d="M19 8v6m-3-3h6"/></g>,
    star:       <g {...sw}><path d="M12 3l2.7 5.5L21 9.4l-4.5 4.4 1 6.2L12 17l-5.5 3 1-6.2L3 9.4l6.3-.9L12 3z"/></g>,
    starFill:   <g><path d="M12 3l2.7 5.5L21 9.4l-4.5 4.4 1 6.2L12 17l-5.5 3 1-6.2L3 9.4l6.3-.9L12 3z" fill="currentColor"/></g>,
    pin:        <g {...sw}><path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></g>,
    clock:      <g {...sw}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
    route:      <g {...sw}><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M9 17l2-2a3 3 0 014 0l2 2M6 15V9a3 3 0 013-3h0a3 3 0 013 3v6"/></g>,
    target:     <g {...sw}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></g>,
    arrowUp:    <g {...sw}><path d="M12 19V5M5 12l7-7 7 7"/></g>,
    turnRight:  <g {...sw}><path d="M7 21V8a3 3 0 013-3h7M14 8l4-3-4-3"/></g>,
    turnLeft:   <g {...sw}><path d="M17 21V8a3 3 0 00-3-3H7M10 8L6 5l4-3"/></g>,
    mute:       <g {...sw}><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M17 9l4 6M21 9l-4 6"/></g>,
    speaker:    <g {...sw}><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8"/></g>,
    grid:       <g {...sw}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></g>,
    warn:       <g {...sw}><path d="M12 4l10 17H2L12 4z"/><path d="M12 10v5M12 18v.01"/></g>,
    phone:      <g {...sw}><path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></g>,
    msg:        <g {...sw}><path d="M21 11.5a8.4 8.4 0 01-3.9 7.1A8.4 8.4 0 0112.5 20a8.4 8.4 0 01-3.8-.9L3 20l1.3-4.4A8.5 8.5 0 0112.5 3a8.4 8.4 0 016 2.5 8.4 8.4 0 012.5 6z"/></g>,
    trash:      <g {...sw}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6M14 11v6"/></g>,
    edit:       <g {...sw}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></g>,
    search:     <g {...sw}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></g>,
    elev:       <g {...sw}><path d="M3 18l5-8 4 4 4-6 5 10H3z"/></g>,
    drop:       <g {...sw}><path d="M12 3s7 7 7 12a7 7 0 01-14 0c0-5 7-12 7-12z"/></g>,
    leaf:       <g {...sw}><path d="M4 20c0-9 7-16 16-16-1 9-7 16-16 16z"/><path d="M4 20s5-3 9-7"/></g>,
    crown:      <g {...sw}><path d="M3 18h18l-2-10-4 4-4-7-4 7-4-4-2 10z"/></g>,
    radio:      <g {...sw}><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 010 8.4M7.8 7.8a6 6 0 000 8.4M19 5a10 10 0 010 14M5 5a10 10 0 000 14"/></g>,
    flag:       <g {...sw}><path d="M5 21V4h13l-2 5 2 5H5"/></g>,
    addUser:    <g {...sw}><path d="M16 21a6 6 0 00-12 0"/><circle cx="10" cy="7" r="4"/><path d="M19 7v6m-3-3h6"/></g>,
    bolt:       <g {...sw}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></g>,
    eye:        <g {...sw}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></g>,
    fire:       <g {...sw}><path d="M12 22c-4 0-7-3-7-7 0-3 2-5 3-7 1 2 2 3 4 3 0-4-2-6-2-9 4 1 9 6 9 13 0 4-3 7-7 7z"/></g>,
    cafe:       <g {...sw}><path d="M3 8h14v6a5 5 0 01-5 5H8a5 5 0 01-5-5V8z"/><path d="M17 10h2a2 2 0 010 4h-2M7 3v2M11 3v2"/></g>,
    mountain:   <g {...sw}><path d="M3 20l6-10 4 6 3-4 5 8H3z"/></g>,
    tent:       <g {...sw}><path d="M3 20L12 4l9 16H3z"/><path d="M12 4v16M9 20l3-4 3 4"/></g>,
    closure:    <g {...sw}><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></g>,
    wind:       <g {...sw}><path d="M3 8h13a3 3 0 100-6M3 16h17a3 3 0 110 6M3 12h7"/></g>,
    cluster:    <g {...sw}><circle cx="7" cy="9" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="17" cy="14" r="2"/><circle cx="9" cy="16" r="2"/></g>,
    headset:    <g {...sw}><path d="M4 14v-2a8 8 0 0116 0v2M4 14a2 2 0 002 2h1v-5H6a2 2 0 00-2 2v1zm16 0a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2v1z"/><path d="M16 16v1a3 3 0 01-3 3h-1"/></g>,
    rotate:     <g {...sw}><path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6"/></g>,
    open:       <g {...sw}><path d="M14 3h7v7M21 3l-9 9M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...rest}>
      {paths[name]}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Network status pill
   ────────────────────────────────────────────────────────────── */

export type NetworkState = "online" | "offline" | "syncing" | "corridor";

export function NetworkPill({
  state = "online",
  compact = false,
}: { state?: NetworkState; compact?: boolean }) {
  const map: Record<NetworkState, { label: string; icon: IconName; color: string }> = {
    online:   { label: "Online",  icon: "wifi",    color: "var(--c-success)" },
    offline:  { label: "Offline", icon: "wifiOff", color: "var(--c-text-muted)" },
    syncing:  { label: "Syncing", icon: "sync",    color: "var(--c-info)" },
    corridor: { label: "Corridor", icon: "wifi",   color: "var(--c-accent)" },
  };
  const s = map[state] || map.online;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: compact ? "4px 8px" : "6px 10px",
      height: compact ? 28 : 32,
      borderRadius: 999, background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      boxShadow: "var(--sh-card)",
      color: s.color, fontWeight: 600, fontSize: 12,
    }}>
      <Icon
        name={s.icon}
        size={14}
        stroke={2}
        style={state === "syncing" ? { animation: "spin-360 1.4s linear infinite" } : undefined}
      />
      {!compact && <span style={{ color: "var(--c-text)" }}>{s.label}</span>}
    </div>
  );
}

export function AccountBtn({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Account"
      style={{
        width: 40, height: 40, borderRadius: 999,
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        boxShadow: "var(--sh-card)",
        color: "var(--c-text)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon name="user" size={18} stroke={2} />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sheets / drawers / modals
   ────────────────────────────────────────────────────────────── */

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  height?: number | string;
};

export function BottomSheet({ open, onClose, children, title, height = "auto" }: SheetProps) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "var(--c-overlay)",
        zIndex: 40, animation: "fade-in 0.2s ease",
      }}/>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "var(--c-surface)",
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: "8px 0 24px",
        height,
        zIndex: 41,
        boxShadow: "var(--sh-raised)",
        animation: "slide-up 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        display: "flex", flexDirection: "column",
        maxHeight: "85%",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: "var(--c-border-strong)" }}/>
        </div>
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 8px" }}>
            <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
            <button onClick={onClose} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={20}/>
            </button>
          </div>
        )}
        <div className="scroll-y" style={{ flex: 1, padding: "0 18px 8px" }}>{children}</div>
      </div>
    </>
  );
}

export function RightDrawer({ open, onClose, children, title }: SheetProps) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "var(--c-overlay)",
        zIndex: 40, animation: "fade-in 0.2s ease",
      }}/>
      <div style={{
        position: "absolute", top: 0, bottom: 0, right: 0, width: "85%",
        background: "var(--c-surface)",
        zIndex: 41,
        boxShadow: "var(--sh-raised)",
        animation: "slide-in-right 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "54px 16px 12px", borderBottom: "1px solid var(--c-border)",
        }}>
          <div className="t-display" style={{ fontWeight: 700, fontSize: 20 }}>{title}</div>
          <button onClick={onClose} style={{ width: 40, height: 40 }}>
            <Icon name="x" size={20}/>
          </button>
        </div>
        <div className="scroll-y" style={{ flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

export function Modal({
  open, onClose, children, width = "88%",
}: { open: boolean; onClose: () => void; children: ReactNode; width?: number | string }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "var(--c-overlay)",
        zIndex: 50, animation: "fade-in 0.2s ease",
      }}/>
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width,
        background: "var(--c-surface)",
        borderRadius: 22,
        zIndex: 51,
        boxShadow: "var(--sh-raised)",
        animation: "slide-up 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        maxHeight: "80%", display: "flex", flexDirection: "column",
      }}>
        {children}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Buttons
   ────────────────────────────────────────────────────────────── */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  large?: boolean;
  danger?: boolean;
};

export function PrimaryBtn({ children, onClick, style, large = false, danger = false }: BtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: large ? 56 : 48,
        padding: large ? "0 24px" : "0 18px",
        borderRadius: 14,
        background: danger ? "var(--c-danger)" : "var(--grad-cta)",
        color: "white",
        fontWeight: 700, fontSize: large ? 17 : 15,
        fontFamily: "var(--font-body)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: "var(--sh-card)",
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, style }: BtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 48,
        padding: "0 16px",
        borderRadius: 14,
        background: "var(--c-surface)",
        color: "var(--c-text)",
        fontWeight: 600, fontSize: 15,
        border: "1px solid var(--c-border)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Toggle (used in stop-actions sheet + layer menu)
   ────────────────────────────────────────────────────────────── */

export function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 36, height: 20, borderRadius: 999,
      background: on ? "var(--c-accent)" : "var(--c-border-strong)",
      position: "relative", transition: "background 0.15s ease",
    }}>
      <div style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: 999, background: "white",
        transition: "left 0.15s ease",
      }}/>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PointerEvent helper used by PlanSheet drag (re-exported)
   ────────────────────────────────────────────────────────────── */

export type SheetPointerEvent = ReactPointerEvent<HTMLDivElement>;
