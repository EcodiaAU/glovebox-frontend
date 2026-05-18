// src/components/nav/NavigationControls.tsx

import { useState, useEffect } from "react";
import { Volume2, VolumeX, Maximize2, Crosshair, Layers, Megaphone, X } from "lucide-react";
import { haptic } from "@/lib/native/haptics";

type Props = {
  visible: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOverview: () => void;
  onRecenter: () => void;
  onEnd: () => void;
  layerFilterActive?: boolean;
  onLayerToggle?: () => void;
  onReport?: () => void;
  reportOpen?: boolean;
  reportTray?: React.ReactNode;
  simple?: boolean;
};

/* ── Unified circular button - all styles inline ─────────────────── */

function NavBtn({
  icon,
  label,
  onClick,
  variant = "default",
  animClass,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "active" | "danger";
  animClass?: string;
}) {
  const isDefault = variant === "default";
  const isDanger = variant === "danger";
  const isActive = variant === "active";

  return (
    <button
      type="button"
      aria-label={label}
      className={animClass}
      onClick={() => { haptic.selection(); onClick(); }}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        background: isDanger
          ? "var(--brand-ochre)"
          : isActive
          ? "var(--brand-eucalypt)"
          : "transparent",
        color: isDefault
          ? "var(--roam-text, #1a1613)"
          : "var(--on-color, #faf6ef)",
        boxShadow: isDanger
          ? "0 2px 8px rgba(181,69,46,0.30)"
          : isActive
          ? "0 2px 8px rgba(45,110,64,0.30)"
          : "none",
        transition: "transform 0.12s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.88)"; }}
      onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
      onPointerCancel={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
    >
      {icon}
    </button>
  );
}

export function NavigationControls({
  visible,
  isMuted,
  onToggleMute,
  onOverview,
  onRecenter,
  onEnd,
  layerFilterActive,
  onLayerToggle,
  onReport,
  reportOpen,
  reportTray,
  simple,
}: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), 4000);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  if (!visible) return null;

  let idx = 0;

  // Position: sits below the HUD card, right-aligned.
  // The four non-destructive controls (layers, mute, overview, recenter, report)
  // group inside a single roam-control-group capsule so they read as one
  // control surface — not 4-6 disconnected circles floating on the map.
  // The End-nav button sits OUTSIDE the group as a danger primary so the
  // visual weight matches its destructive intent.
  return (
    <div className="roam-nav-controls" style={{
      position: "absolute",
      top: "calc(env(safe-area-inset-top, 0px) + 120px)",
      right: 12,
      zIndex: 40,
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}>
      <div className="roam-control-group">
        {onLayerToggle && (
          <NavBtn
            animClass={`nav-ctrl-enter-${++idx}`}
            icon={<Layers size={17} strokeWidth={2.2} />}
            label="Map layers"
            onClick={onLayerToggle}
            variant={layerFilterActive ? "active" : "default"}
          />
        )}

        <NavBtn
          animClass={`nav-ctrl-enter-${++idx}`}
          icon={isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          label={isMuted ? "Unmute voice" : "Mute voice"}
          onClick={onToggleMute}
          variant={!isMuted ? "active" : "default"}
        />

        <NavBtn
          animClass={`nav-ctrl-enter-${++idx}`}
          icon={<Maximize2 size={17} />}
          label="Route overview"
          onClick={onOverview}
        />

        <NavBtn
          animClass={`nav-ctrl-enter-${++idx}`}
          icon={<Crosshair size={17} />}
          label="Recenter"
          onClick={onRecenter}
        />

        {!simple && onReport && (
          <div style={{ position: "relative" }} className={`nav-ctrl-enter-${++idx}`}>
            <NavBtn
              icon={reportOpen ? <X size={17} /> : <Megaphone size={17} />}
              label="Report road condition"
              onClick={onReport}
              variant={reportOpen ? "active" : "default"}
            />
            {reportTray && (
              <div style={{ position: "absolute", top: 0, right: 56, zIndex: 50 }}>
                {reportTray}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }} className={`nav-ctrl-enter-${++idx}`}>
        <NavBtn
          icon={<X size={17} />}
          label="End navigation"
          onClick={() => setConfirmEnd((v) => !v)}
          variant="danger"
        />

        <div style={{
          position: "absolute",
          top: 0,
          right: 50,
          opacity: confirmEnd ? 1 : 0,
          transform: confirmEnd ? "translateX(0) scale(1)" : "translateX(10px) scale(0.92)",
          pointerEvents: confirmEnd ? "auto" : "none",
          transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
          display: "flex",
          gap: 5,
          borderRadius: "var(--r-card)",
          padding: "4px",
          whiteSpace: "nowrap",
          background: "var(--nav-card-bg, #f0e9dc)",
          boxShadow: "var(--shadow-heavy)",
          border: "1px solid var(--roam-border)",
        }}>
          <button
            type="button"
            onClick={() => { haptic.medium(); setConfirmEnd(false); onEnd(); }}
            style={{
              padding: "10px 16px",
              minHeight: 44,
              border: "none",
              borderRadius: "var(--r-card)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 950,
              color: "var(--on-color, #faf6ef)",
              background: "var(--brand-ochre)",
              letterSpacing: "-0.1px",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            End nav
          </button>
          <button
            type="button"
            onClick={() => { haptic.selection(); setConfirmEnd(false); }}
            style={{
              padding: "10px 14px",
              minHeight: 44,
              border: "1px solid var(--roam-border-strong)",
              borderRadius: "var(--r-card)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 950,
              color: "var(--roam-text-muted)",
              background: "transparent",
              letterSpacing: "-0.1px",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
