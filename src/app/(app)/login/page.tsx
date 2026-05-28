// src/app/login/page.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/lib/supabase/auth";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { haptic } from "@/lib/native/haptics";
import "@/app/landing.css";

export default function LoginPage() {
  const {
    session,
    loading,
    isDemoMode,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithAppleNative,
  } = useAuth();

  const router = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Apple Sign-In is iOS-only: @capacitor-community/apple-sign-in has no Android
  // bridge implementation, so on Android any tap throws "plugin is not implemented
  // on android". Gate the button on platform === 'ios' so Android users only see
  // sign-in methods that actually work (Google + email/password). Apple HIG also
  // requires Sign in with Apple to appear only on Apple platforms.
  const isIOS = useMemo(() => Capacitor.getPlatform() === "ios", []);
  const { deviceOnline } = useNetworkStatus();

  // After sign-in (real session or demo mode), redirect to /new
  useEffect(() => {
    if (loading) return;
    if (session || isDemoMode) router("/new", { replace: true });
  }, [loading, session, isDemoMode, router]);

  const handleGoogle = useCallback(async () => {
    haptic.tap();
    setError(null);
    setBusy(true);
    const { error: err } = await signInWithGoogle();
    if (err) { haptic.error(); setError(err.message); }
    setBusy(false);
  }, [signInWithGoogle]);

  const handleApple = useCallback(async () => {
    haptic.tap();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await signInWithAppleNative();
      if (err) {
        haptic.error();
        setError(err.message);
      }
      // success -> session updates -> redirect effect fires
    } catch (e: unknown) {
      haptic.error();
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Apple Sign-In failed. Please try again or use another sign-in method.");
    } finally {
      setBusy(false);
    }
  }, [signInWithAppleNative]);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSignupSuccess(false);

      const e1 = email.trim();
      if (!e1 || !password) {
        setError("Email and password are required");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      haptic.tap();
      setBusy(true);
      try {
        if (mode === "login") {
          const { error: err } = await signInWithEmail(e1, password);
          if (err) { haptic.error(); setError(err.message); }
        } else {
          const { error: err } = await signUpWithEmail(e1, password);
          if (err) { haptic.error(); setError(err.message); }
          else { haptic.success(); setSignupSuccess(true); }
        }
      } finally {
        setBusy(false);
      }
    },
    [email, password, mode, signInWithEmail, signUpWithEmail],
  );

  if (loading) {
    return (
      <div className="ed ed-page">
        <span className="ed-notice">
          <em>Loading.</em>
        </span>
      </div>
    );
  }

  const headingText =
    mode === "login" ? "Sign in." : "Make an account.";
  const submitLabel =
    busy ? "..." : mode === "login" ? "Sign in." : "Create account.";
  const toggleLabel =
    mode === "login"
      ? "Don't have an account? Sign up."
      : "Already have an account? Sign in.";

  return (
    <div
      className="ed login-scroll"
      style={{
        position: "absolute",
        inset: 0,
        bottom: "var(--bottom-nav-height, 80px)",
        WebkitOverflowScrolling: "touch" as const,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "env(safe-area-inset-top, 24px) 20px max(24px, env(safe-area-inset-bottom, 24px))",
        // Auto-scroll only kicks in when content actually overflows
        // (short mobile viewport with on-screen keyboard). On desktop
        // the column fits the viewport via the tighter editorial rhythm.
        overflowY: "auto",
      }}
    >
      <div className="ed-column" style={{ paddingTop: "clamp(32px, 6vh, 80px)", gap: 14, alignItems: "stretch" }}>
        {/* Header block: mark + heading + lede, all flush-left as one unit
            so the column reads as a single editorial column rather than a
            scatter of centred fragments. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
          <div className="ed-mark" style={{ justifyContent: "flex-start", marginBottom: 8 }}>
            <GloveboxMark />
          </div>
          <h1 className="ed-heading">
            <em>{headingText}</em>
          </h1>
          <p className="ed-lede" style={{ textAlign: "left" }}>
            <em>Offline navigation for the outback.</em>
          </p>
        </div>

        {!deviceOnline && (
          <p className="ed-notice ed-notice-err" style={{ textAlign: "left" }}>
            <em>You&apos;re offline. Sign-in needs a connection.</em>
          </p>
        )}

        {/* Apple Sign-In (iOS-only). Apple HIG mandates the official
            button presentation; do NOT edit the styling without
            re-checking review compliance. */}
        {isIOS && (
          <button
            type="button"
            onClick={handleApple}
            disabled={busy}
            className="apple-sso-btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              minHeight: 52,
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              fontSize: 16,
              fontWeight: 600,
              opacity: busy ? 0.55 : 1,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
              letterSpacing: "-0.01em",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
            }}
          >
            <AppleMark />
            <span style={{ lineHeight: 1, transform: "translateY(0.5px)" }}>
              Sign in with Apple
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="ed-btn"
          style={{ opacity: busy ? 0.55 : 1 }}
        >
          <GoogleG />
          <span>Continue with Google</span>
        </button>

        <p className="ed-label">or with email</p>

        <form onSubmit={handleEmailSubmit} className="ed-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            inputMode="email"
            className="ed-input"
            disabled={busy}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="ed-input"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="ed-action"
            style={{ opacity: busy ? 0.55 : 1, alignSelf: "flex-start" }}
          >
            <em>{submitLabel}</em>
          </button>
        </form>

        {error && (
          <p className="ed-notice ed-notice-err" style={{ textAlign: "left" }}>
            <em>{error}</em>
          </p>
        )}

        {signupSuccess && (
          <p className="ed-notice" style={{ textAlign: "left" }}>
            <em>Check your email for a confirmation link, then sign in.</em>
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            haptic.selection();
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setSignupSuccess(false);
          }}
          className="ed-textlink"
          style={{ textAlign: "left", alignSelf: "flex-start" }}
          disabled={busy}
        >
          <em>{toggleLabel}</em>
        </button>
      </div>

      {/* Legal links - quiet dotted-underline row, marketing voice. */}
      <div className="ed-row" style={{ marginTop: 16, paddingBottom: 8, justifyContent: "center" }}>
        {[
          { href: "/contact", label: "Contact" },
          { href: "/terms", label: "Terms" },
          { href: "/privacy", label: "Privacy" },
          { href: "/attributions", label: "Attributions" },
        ].map(({ href, label }, i, arr) => (
          <span
            key={href}
            style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}
          >
            <a href={href} className="ed-link-dotted">
              {label}
            </a>
            {i < arr.length - 1 && (
              <span className="ed-sep" aria-hidden="true">.</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/* The Glovebox mark from the app icon, lifted off its ochre block so it
   reads as a sun cresting a horizon line against whatever background the
   page is on. Stroke/fill use currentColor so it inherits page text. */
function GloveboxMark() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Glovebox"
      style={{ color: "var(--roam-accent)" }}
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

function AppleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.48 2.22-1.26 3.06-.81.87-2.14 1.55-3.31 1.46-.15-1.1.43-2.27 1.19-3.07.84-.89 2.24-1.54 3.38-1.45ZM20.39 17.13c-.54 1.24-.8 1.8-1.5 2.9-.98 1.52-2.36 3.41-4.06 3.43-1.51.02-1.9-.99-3.96-.98-2.06.01-2.49 1.0-4 .98-1.7-.02-3-1.73-3.98-3.25-2.74-4.24-3.03-9.22-1.34-11.82 1.2-1.86 3.1-2.96 4.89-2.96 1.83 0 2.98 1.0 4.49 1.0 1.47 0 2.36-1.0 4.47-1.0 1.6 0 3.3.87 4.5 2.36-3.95 2.16-3.31 7.78.49 9.34Z"
      />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
