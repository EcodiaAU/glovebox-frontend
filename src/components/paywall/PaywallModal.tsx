import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/native/haptics";
import {
    isNativePlatform,
    purchaseFriend,
    restorePurchases,
} from "@/lib/paywall/friendEntitlement";

// Friend is bought in Friend. Glovebox web points at it and never quotes a price:
// the store SKU and the Stripe plan are priced per channel and Glovebox is not the
// authority on either. friend.ecodia.au shows the live plans.
const FRIEND_URL = "https://friend.ecodia.au";
import { ChevronDown } from "lucide-react";

// The Friend upsell. It sells ONE thing: the co-pilot.
//
// Everything Glovebox does to get you there is free (Tate 2026-07-13):
// offline maps, routing, turn-by-turn, fuel range, SOS, trip planning, offline
// packs, as many trips as you like. So none of that belongs in this list. The
// paid thing is Friend, and Friend is the same Friend in every Ecodia app.
// This is a voluntary upsell; it never blocks anyone from planning a trip.

type Props = {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
};

const FEATURES: { label: string; sub: string }[] = [
  { label: "Your co-pilot on the road", sub: "Ask anything as you drive. Friend knows the trip you are on." },
  { label: "Stops worth pulling over for", sub: "Fuel, food, camps and sights on the road ahead, not a generic list." },
  { label: "It remembers you", sub: "Your Friend carries what it learns from one trip to the next." },
  { label: "One Friend, everywhere", sub: "The same Friend across every Ecodia app you use." },
];

const HERO_COPY = {
  heading: <>Bring a Friend<br />on the drive.</>,
  body: "The road is free: maps, routing, offline packs, as many trips as you want. Friend is the co-pilot who rides along, and it is the same Friend across everything Ecodia.",
};

type AnimState = "entering" | "open" | "exiting" | "closed";

export function PaywallModal({ open, onClose, onUnlocked }: Props) {
  const router = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anim, setAnim] = useState<AnimState>("closed");
  const isNative = isNativePlatform();
  const sheetRef = useRef<HTMLDivElement>(null);
  const featureRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Drive enter/exit animation
  useEffect(() => {
    if (open && (anim === "closed" || anim === "exiting")) {
      setAnim("entering");
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnim("open"));
      });
      return () => cancelAnimationFrame(raf);
    }
    if (!open && anim === "open") {
      setAnim("closed");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (anim === "exiting") return;
    haptic.light();
    setAnim("exiting");
    setTimeout(() => {
      setAnim("closed");
      onClose();
    }, 340);
  }, [onClose, anim]);

  // Lock scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) { setError(null); setBuying(false); setRestoring(false); setCanScroll(false); }
  }, [open]);

  // Detect whether the feature list is scrollable and update fade hint
  useEffect(() => {
    const el = featureRef.current;
    if (!el || !open) return;
    const check = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setCanScroll(remaining > 4);
    };
    // Initial check after layout settles
    const raf = requestAnimationFrame(check);
    el.addEventListener("scroll", check, { passive: true });
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", check); };
  }, [open, anim]);

  const handlePurchase = useCallback(async () => {
    haptic.medium();
    setError(null);

    if (isNative) {
      // iOS / Android - RevenueCat native sheet. No session gate on native
      // per Tate's 2026-05-28 device-driven entitlement reframe: StoreKit
      // owns the Apple-ID purchase, the device unlocks regardless of which
      // (or no) Supabase user is signed in, and the upsert in friendEntitlement
      // will write the account backup if a session exists. Web sells nothing
      // here: it links out to friend.ecodia.au, and the entitlement returns
      // via the Friend perk push (see the WEB branch below).
      setBuying(true);
      try {
        const result = await purchaseFriend();
        if (result.success) {
          haptic.success();
          onUnlocked();
        } else if (result.error !== "cancelled") {
          setError(result.error ?? "Purchase failed.");
        }
      } finally {
        setBuying(false);
      }
      return;
    }

    // WEB. Glovebox does not sell Friend, here or anywhere.
    //
    // This used to redirect to /stripe/checkout, which opens a Checkout Session on
    // the Glovebox STRIPE_PRICE_ID. That price is a ONE-TIME AUD 19.99 charge on a
    // legacy Glovebox product, sold under copy promising "a $19.99/month
    // auto-renewing subscription" to Friend, and it wrote a Glovebox-scoped
    // user_entitlements row rather than a Friend subscription. Wrong money, wrong
    // promise, wrong entitlement, and a Friend that worked in Glovebox and nowhere
    // else. Friend's real product is a separate Stripe product entirely.
    //
    // So the web sends people to Friend, which sells Friend, and the subscription
    // comes back to Glovebox through the Friend perk push (pushGloveboxPerk ->
    // /friend/entitlement). Commission-free, one subscription, every Ecodia app.
    //
    // Web MAY link out; the two natives may not (Apple 3.1.1(a) outside the US
    // storefront). That asymmetry is deliberate and is why this is the one surface
    // carrying the call to action.
    window.location.href = FRIEND_URL;
  }, [isNative, onUnlocked]);

  const handleRestore = useCallback(async () => {
    haptic.light();
    // No session gate - device-driven model (Tate 2026-05-28). StoreKit
    // restoreCompletedTransactions works against the Apple-ID regardless
    // of Supabase session; if a session is present, the upsert in friendEntitlement
    // will write the account backup, otherwise the device's local cache
    // is sufficient.
    setRestoring(true);
    setError(null);
    try {
      const result = await restorePurchases();
      if (result.success) {
        haptic.success();
        onUnlocked();
      } else {
        setError(result.error ?? "No previous purchase found.");
      }
    } finally {
      setRestoring(false);
    }
  }, [onUnlocked]);

  if (!mounted || anim === "closed") return null;

  const busy = buying || restoring;
  const isVisible = anim === "open";
  const isExiting = anim === "exiting";

  return createPortal(
    <div
      className="glovebox-modal-backdrop"
      data-glovebox-modal="paywall"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10, 8, 6, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        opacity: isVisible || anim === "entering" ? 1 : 0,
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Sheet */}
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          /* maxHeight governs visible content; the 120px overshoot buffer lives
             outside this via negative margin so it doesn't eat into content. */
          maxHeight: "calc(100dvh - 32px)",
          background: "var(--surface-card, #f4efe6)",
          borderRadius: "28px 28px 0 0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          /* Overshoot buffer: extend 120px below to fill the gap during
             spring bounce, then pull it back with negative margin so it
             doesn't affect layout height or maxHeight accounting. */
          boxShadow: "0 120px 0 0 var(--surface-card, #f4efe6)",
          transform: isVisible ? "translateY(0)" : "translateY(100%)",
          transition: isExiting
            ? "transform 0.34s cubic-bezier(0.4, 0, 1, 1)"
            : "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Hero band - solid burnt orange + cream, editorial italic
            heading. Borrows the marketing palette without the chrome:
            no gradient, no decorative rings, no all-caps badge pill. */}
        <div
          style={{
            background: "#A8431F",
            color: "#E8DFC9",
            padding: "32px 28px 28px",
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{
              position: "absolute", top: 14, right: 14,
              border: "none", margin: 0, padding: 0,
              cursor: "pointer",
              width: 36, height: 36, borderRadius: "50%",
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(232,223,201,0.8)",
              boxSizing: "border-box",
            }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
              <path d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Quiet section label - reading beat, not badge pill */}
          <div style={{
            fontFamily: "var(--ff-display)",
            fontSize: 12.5,
            letterSpacing: "0.08em",
            color: "rgba(232,223,201,0.55)",
            textTransform: "lowercase",
            marginBottom: 10,
          }}>
            your friend on the road
          </div>

          <h1 style={{
            margin: "0 0 10px",
            fontFamily: "var(--ff-display)",
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.18,
            letterSpacing: "-0.014em",
            color: "#E8DFC9",
          }}>
            {HERO_COPY.heading}
          </h1>
          <p style={{
            margin: 0,
            fontFamily: "var(--ff-display)",
            fontSize: 15, fontWeight: 400,
            color: "rgba(232,223,201,0.78)",
            lineHeight: 1.5,
          }}>
            {HERO_COPY.body}
          </p>
        </div>

        {/* Feature list - quieter rows, ochre dot instead of icon
            square, less weight on the labels. Keeps the scan pattern
            (label + sub) so the value props still land. */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div
            ref={featureRef}
            style={{ padding: "22px 28px 12px", overflowY: "auto", height: "100%", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"], overscrollBehaviorX: "contain" }}
          >
            <div style={{
              fontFamily: "var(--ff-display)",
              fontSize: 12.5,
              letterSpacing: "0.08em",
              color: "var(--glovebox-text-muted)",
              textTransform: "lowercase",
              marginBottom: 8,
            }}>
              what friend does
            </div>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex", alignItems: "baseline", gap: 14,
                  padding: "10px 0",
                }}
              >
                <span style={{
                  width: 6, height: 6, flexShrink: 0,
                  borderRadius: "50%",
                  background: "var(--glovebox-accent)",
                  alignSelf: "center",
                }} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--glovebox-text)", marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--glovebox-text-muted)", lineHeight: 1.45 }}>
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Scroll hint - gradient fade + bouncing chevron */}
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: 48,
              background: "linear-gradient(to top, var(--surface-card, #f4efe6) 20%, transparent 100%)",
              pointerEvents: "none",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              paddingBottom: 4,
              opacity: canScroll ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          >
            <ChevronDown
              size={18}
              strokeWidth={2.5}
              style={{
                color: "var(--brand-ochre)",
                opacity: 0.55,
                animation: "glovebox-bounce-hint 1.4s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        {/* Price + CTA - lighter price weight, solid burnt-orange
            button instead of gradient + shadow. */}
        <div style={{ padding: "16px 28px 20px", flexShrink: 0 }}>
          {isNative && (
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10,
            marginBottom: 14,
            justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--ff-display)",
              fontSize: 34,
              fontWeight: 400,
              color: "var(--glovebox-text)",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}>
              $19.99
            </span>
            <span style={{
              fontFamily: "var(--ff-display)",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--glovebox-text-muted)",
            }}>
              per month. cancel anytime.
            </span>
          </div>
          )}

          <button
            type="button"
            onClick={handlePurchase}
            disabled={busy}
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
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
              letterSpacing: "0.01em",
              boxShadow: "none",
              transition: "opacity 0.15s",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            {buying && isNative
              ? "Processing…"
              : isNative
                ? "Get Friend · $19.99/mo"
                : "Get Friend →"}
          </button>

          {/* Auto-renewal disclosure (App Store / Play Billing requirement for
              auto-renewable subscriptions). Shown on native only; web bills
              nothing itself and sends people to friend.ecodia.au. */}
          {isNative && (
            <p style={{
              margin: "10px 2px 0",
              fontSize: 10.5,
              lineHeight: 1.4,
              color: "var(--glovebox-text-muted, #7a7067)",
              textAlign: "center",
              opacity: 0.85,
            }}>
              Friend is a $19.99/month auto-renewing subscription.
              Payment is charged to your store account and renews monthly until cancelled at least
              24 hours before the end of the period. Manage or cancel in your store account settings.
            </p>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: "var(--r-card)",
              background: "var(--bg-error, #fae5e2)",
              color: "var(--text-error, #922018)",
              fontSize: 13, fontWeight: 600,
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* Restore + sign in + legal */}
          <div style={{
            marginTop: 12,
            display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap",
          }}>
            {isNative && (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={busy}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    color: "var(--glovebox-text-muted, #7a7067)",
                    opacity: busy ? 0.4 : 0.8,
                  }}
                >
                  {restoring ? "Restoring…" : "Restore purchase"}
                </button>
                <span style={{ color: "var(--glovebox-border-strong)", fontSize: 12 }}>·</span>
              </>
            )}
            <>
              <button
                type="button"
                onClick={() => { haptic.light(); router("/login?next=/trip"); onClose(); }}
                disabled={busy}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  color: "var(--glovebox-text-muted, #7a7067)",
                  opacity: busy ? 0.4 : 0.8,
                }}
              >
                Sign in
              </button>
              <span style={{ color: "var(--glovebox-border-strong)", fontSize: 12 }}>·</span>
            </>
            <a
              href="/privacy"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--glovebox-text-muted, #7a7067)", opacity: 0.8 }}
            >
              Privacy
            </a>
            <a
              href="/terms"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--glovebox-text-muted, #7a7067)", opacity: 0.8 }}
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
