import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GloveboxMark } from "@/components/brand/GloveboxMark";

/** First-launch adult confirmation flag. We persist ONLY this boolean, never
 *  the date of birth the visitor typed. Whole-app 18+ gate (Tate 2026-07-14). */
export const KEY_CONFIRMED_ADULT = "glovebox_confirmed_adult";

/** True once the visitor has confirmed they are 18 or older on this device.
 *  Wrapped so private-mode storage errors read as "not yet confirmed" rather
 *  than throwing at app boot. */
export function hasConfirmedAdult(): boolean {
  try {
    return localStorage.getItem(KEY_CONFIRMED_ADULT) === "1";
  } catch {
    return false;
  }
}

/** Ported from coexist sign-up.tsx calculateAge(): whole years between the
 *  date of birth and today, rolling the year back if the birthday has not
 *  landed yet this year. */
function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

type Props = {
  onConfirm: () => void;
};

export function AgeGate({ onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dob, setDob] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Lock the page behind the gate: no background scroll while it is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!mounted) return null;

  const maxDob = new Date().toISOString().split("T")[0];

  const handleContinue = () => {
    if (!dob) return;
    const age = calculateAge(dob);
    if (age >= 18) {
      try {
        localStorage.setItem(KEY_CONFIRMED_ADULT, "1");
      } catch {
        /* private mode - proceed for the session without persisting */
      }
      onConfirm();
    } else {
      setBlocked(true);
    }
  };

  return createPortal(
    <div
      className="glovebox-modal-backdrop"
      data-glovebox-modal="age-gate"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--glovebox-bg, #f4efe6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface-card, #ffffff)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 18px 48px rgba(10, 8, 6, 0.18)",
        }}
      >
        {/* Hero - solid burnt-orange + cream, mirrors the welcome sheet. */}
        <div
          style={{
            background: "#A8431F",
            color: "#E8DFC9",
            padding: "28px 28px 30px",
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: 16, color: "#E8DFC9" }}>
            <GloveboxMark size={40} />
          </div>
          <h1
            id="age-gate-title"
            style={{
              margin: 0,
              fontFamily: "var(--ff-display)",
              fontSize: 28,
              fontWeight: 400,
              color: "#E8DFC9",
              lineHeight: 1.2,
              letterSpacing: "-0.014em",
            }}
          >
            Are you 18 or older?
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 28px" }}>
          <p
            style={{
              margin: "0 0 20px",
              fontFamily: "var(--ff-display)",
              fontSize: 15,
              fontWeight: 400,
              color: "var(--glovebox-text-muted)",
              lineHeight: 1.55,
            }}
          >
            Glovebox is a navigation app intended for adult, licensed drivers.
            Please confirm your date of birth to continue.
          </p>

          <label
            htmlFor="age-gate-dob"
            style={{
              display: "block",
              fontFamily: "var(--ff-display)",
              fontSize: 12.5,
              letterSpacing: "0.08em",
              textTransform: "lowercase",
              color: "var(--glovebox-text-muted)",
              marginBottom: 8,
            }}
          >
            date of birth
          </label>
          <input
            id="age-gate-dob"
            type="date"
            value={dob}
            max={maxDob}
            onChange={(e) => { setDob(e.target.value); setBlocked(false); }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              minHeight: 52,
              borderRadius: 8,
              border: "1px solid var(--glovebox-border, rgba(10,8,6,0.16))",
              background: "var(--glovebox-bg, #f4efe6)",
              color: "var(--glovebox-text)",
              fontSize: 16,
              fontFamily: "inherit",
              WebkitAppearance: "none",
              appearance: "none",
            }}
          />

          {blocked && (
            <p
              role="alert"
              style={{
                margin: "14px 0 0",
                fontSize: 14,
                fontWeight: 500,
                color: "#A8431F",
                lineHeight: 1.5,
              }}
            >
              You must be 18 or older to use Glovebox.
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!dob}
            style={{
              width: "100%",
              marginTop: 22,
              background: "#A8431F",
              color: "#E8DFC9",
              border: "none",
              padding: "16px",
              minHeight: 52,
              borderRadius: 4,
              fontSize: 15,
              fontWeight: 600,
              cursor: dob ? "pointer" : "not-allowed",
              opacity: dob ? 1 : 0.55,
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              letterSpacing: "0.01em",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
