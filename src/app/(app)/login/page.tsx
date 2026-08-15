// src/app/login/page.tsx

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/lib/supabase/auth";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { haptic } from "@/lib/native/haptics";
import "@/app/landing.css";

export default function LoginPage() {
  const {
    session,
    loading,
    isDemoMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithFriend,
  } = useAuth();

  const router = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const { deviceOnline } = useNetworkStatus();

  // After sign-in (real session or demo mode), redirect to /new
  useEffect(() => {
    if (loading) return;
    if (session || isDemoMode) router("/new", { replace: true });
  }, [loading, session, isDemoMode, router]);

  const handleFriend = useCallback(async () => {
    haptic.tap();
    setError(null);
    setBusy(true);
    const { error: err } = await signInWithFriend();
    if (err) { haptic.error(); setError(err.message); }
    // On success the browser leaves for the Friend IdP; keep busy until then.
    setBusy(false);
  }, [signInWithFriend]);

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
        // Keyboard avoidance is owned by globals.css scoped to
        // .keyboard-open .login-scroll - it flips justify-content to
        // flex-start and adds padding-bottom = keyboard-h + 24px with
        // !important. The Capacitor Keyboard plugin (lib/native/keyboard.ts)
        // toggles the .keyboard-open class on documentElement.
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

        {/* Connect your Friend - the canonical Ecodia consumer identity.
            One account across every Ecodia app; federates this login into
            the shared Friend identity provider. Placed first as the primary
            path. Email/password + Apple + Google remain as alternates. */}
        <button
          type="button"
          onClick={handleFriend}
          disabled={busy || !deviceOnline}
          className="ed-btn friend-sso-btn"
          style={{
            opacity: busy ? 0.55 : 1,
            // Themed to the Glovebox app-icon background (#A8431F rust). The Friend
            // mark sits bare (no tile) in cream on the rust.
            background: "#A8431F",
            borderColor: "#A8431F",
            color: "#F5F1E6",
          }}
        >
          <FriendMark />
          <span>Connect your Friend</span>
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
      style={{ color: "var(--glovebox-accent)" }}
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

/* The Friend "10" mark - a vertical rounded bar (the "1") beside a filled circle
   (the "0"), drawn BARE (no tile) in cream directly on the rust button, larger so
   the line + circle read clearly. Canonical geometry (viewBox 288-448), matching
   the mark on Studio/Locals/Chambers. Self-contained inline SVG. */
function FriendMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="288 288 448 448"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="293" y="332" width="76" height="360" rx="38" fill="#F5F1E6" />
      <circle cx="584" cy="512" r="147" fill="#F5F1E6" />
    </svg>
  );
}
