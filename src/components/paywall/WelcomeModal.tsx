import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/native/haptics";
import { useSheetPullToDismiss } from "@/lib/hooks/useSheetPullToDismiss";
import { GloveboxMark } from "@/components/brand/GloveboxMark";

type Props = {
  open: boolean;
  /** Trip 2 warning: "this is your last free trip" */
  lastFreeTrip?: boolean;
  onClose: () => void;
};

export function WelcomeModal({ open, lastFreeTrip = false, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Apple-style pull-to-dismiss: drag from the top of the sheet (handle
  // strip) OR drag down from the scroll body when it's at the top.
  const { sheetRef, scrollRef, handleRef } = useSheetPullToDismiss(onClose);

  if (!mounted || !open) return null;

  const handleStart = () => {
    haptic.medium();
    onClose();
  };

  return createPortal(
    <div
      className="roam-modal-backdrop"
      data-roam-modal="welcome"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10, 8, 6, 0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={sheetRef}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface-card, #f4efe6)",
          borderRadius: "28px 28px 0 0",
          overflow: "hidden",
          paddingBottom: "var(--bottom-nav-height, calc(80px + env(safe-area-inset-bottom, 0px)))",
          transition: "transform 0.28s cubic-bezier(0.34,1.12,0.64,1)",
          willChange: "transform",
        }}
      >
        {/* Scroll container - the modal content rarely scrolls but
            wrapping it lets at-top pull-to-dismiss work consistently. */}
        <div ref={scrollRef} style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-bottom, 0px))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch" as const,
          overscrollBehavior: "contain",
          touchAction: "pan-y",
        }}>
        {/* Hero - solid burnt-orange + cream editorial. It is the topmost
            element so the ochre bleeds to the very top of the modal (the
            sheet's overflow:hidden + rounded top corners clip it). The
            pull-to-dismiss handle is the grab zone, overlaid on the ochre
            in cream. */}
        <div
          ref={handleRef}
          style={{
            background: "#A8431F",
            color: "#E8DFC9",
            padding: "26px 28px 32px",
            textAlign: "left",
            position: "relative",
            overflow: "hidden",
            touchAction: "none",
            cursor: "grab",
          }}
        >
          {/* Grabber on the ochre */}
          <div style={{
            position: "absolute", top: 8, left: 0, right: 0,
            display: "flex", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{ width: 36, height: 5, borderRadius: 999, background: "rgba(232,223,201,0.45)" }} />
          </div>

          <div style={{ marginBottom: 16, marginTop: 8, color: "#E8DFC9" }}>
            <GloveboxMark size={40} />
          </div>

          <h1 style={{
            margin: "0 0 10px",
            fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
            fontStyle: "italic",
            fontSize: 30, fontWeight: 400,
            color: "#E8DFC9",
            lineHeight: 1.18,
            letterSpacing: "-0.014em",
          }}>
            {lastFreeTrip
              ? "Make this one count."
              : "Welcome to Glovebox."}
          </h1>

          <p style={{
            margin: 0,
            fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
            fontStyle: "italic",
            fontSize: 15, fontWeight: 400,
            color: "rgba(232,223,201,0.78)",
            lineHeight: 1.5,
          }}>
            {lastFreeTrip
              ? "This is your last free trip. Explore every feature: offline maps, the AI guide, turn-by-turn nav. If you love it, Glovebox Untethered is $19.99, one-time."
              : "Two free trips inside. No card needed."}
          </p>
        </div>

        {/* Bullets - quiet ochre dots, no per-row dividers */}
        {!lastFreeTrip && (
          <div style={{ padding: "22px 28px 4px" }}>
            <div style={{
              fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
              fontStyle: "italic",
              fontSize: 12.5,
              letterSpacing: "0.08em",
              color: "var(--roam-text-muted)",
              textTransform: "lowercase",
              marginBottom: 8,
            }}>
              what's inside
            </div>
            {[
              "Beautiful offline maps that work without signal.",
              "Turn-by-turn navigation with voice guidance.",
              "Fuel range alerts so you never run dry in the outback.",
              "AI co-pilot for fuel stops, hazards and local knowledge.",
            ].map((text) => (
              <div key={text} style={{
                display: "flex", alignItems: "baseline", gap: 14,
                padding: "8px 0",
              }}>
                <span style={{
                  width: 6, height: 6, flexShrink: 0,
                  borderRadius: "50%",
                  background: "var(--roam-accent)",
                  alignSelf: "center",
                }} aria-hidden="true" />
                <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--roam-text)", lineHeight: 1.45 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTA - solid burnt-orange, no gradient, no shadow */}
        <div style={{ padding: "22px 28px 24px" }}>
          <button
            type="button"
            onClick={handleStart}
            style={{
              width: "100%",
              background: "#A8431F",
              color: "#E8DFC9",
              border: "none",
              padding: "16px",
              minHeight: 52,
              borderRadius: 4,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              letterSpacing: "0.01em",
            }}
          >
            {lastFreeTrip ? "Plan my last free trip" : "Let's go"}
          </button>

          {!lastFreeTrip && (
            <p style={{
              margin: "14px 0 0",
              textAlign: "center",
              fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
              fontStyle: "italic",
              fontSize: 13, fontWeight: 400,
              color: "var(--roam-text-muted)",
              lineHeight: 1.5,
            }}>
              After 2 free trips, go Untethered for $19.99. One-time, no subscription.
            </p>
          )}
        </div>
        </div>{/* /scroll container */}
      </div>
    </div>,
    document.body,
  );
}
