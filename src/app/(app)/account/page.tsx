// src/app/(app)/account/page.tsx
//
// Account & Settings page.
// Google Play requires: sign-out, account deletion, and a link to
// request data deletion without deleting the account.

import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth";
import { haptic } from "@/lib/native/haptics";
import { AuthGate } from "@/components/auth/AuthGate";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import "@/app/landing.css";

export default function AccountPage() {
  return (
    <AuthGate>
      <AccountPageInner />
    </AuthGate>
  );
}

function AccountPageInner() {
  const { user, session, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    haptic.medium();
    await signOut();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      haptic.warning();
      setConfirmDelete(true);
      return;
    }
    haptic.medium();
    setDeleting(true);
    setError(null);
    const { error: err } = await deleteAccount();
    if (err) {
      haptic.error();
      setError(err);
      setDeleting(false);
      setConfirmDelete(false);
    } else {
      haptic.success();
      navigate("/login", { replace: true });
    }
  }, [confirmDelete, deleteAccount, navigate]);

  const email = user?.email ?? session?.user?.email ?? null;

  return (
    <div
      className="ed"
      style={{
        position: "absolute",
        inset: 0,
        bottom: "var(--bottom-nav-height, 80px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch" as const,
      }}
    >
      <div className="ed-column" style={{ paddingTop: "clamp(20px, 4vh, 40px)" }}>
        {/* Back + heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => { haptic.light(); navigate(-1); }}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "var(--roam-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              padding: 4,
            }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="ed-heading" style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>
            <em>Account.</em>
          </h1>
        </div>

        {email && (
          <div>
            <p className="ed-label">signed in as</p>
            <p style={{
              margin: "4px 0 0",
              fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
              fontStyle: "italic",
              fontSize: 16,
              color: "var(--roam-text)",
              wordBreak: "break-all",
            }}>
              {email}
            </p>
          </div>
        )}

        <div>
          <p className="ed-label">theme</p>
          <div style={{ marginTop: 6 }}>
            <ThemeToggle />
          </div>
        </div>

        <div>
          <p className="ed-label">session</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="ed-action"
            style={{ marginTop: 2, fontSize: 16 }}
          >
            <em>Sign out.</em>
          </button>
        </div>

        <div>
          <p className="ed-label">legal</p>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6, gap: 4 }}>
            {[
              { href: "/privacy", label: "Privacy policy" },
              { href: "/terms", label: "Terms and conditions" },
              { href: "/contact", label: "Contact and support" },
              { href: "/attributions", label: "Attributions" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="ed-textlink"
                style={{ display: "inline-block", padding: "6px 0", textAlign: "left" }}
              >
                <em>{label}.</em>
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="ed-label">account management</p>
          <p style={{
            margin: "6px 0 12px",
            fontSize: 13.5,
            color: "var(--roam-text-muted)",
            lineHeight: 1.5,
          }}>
            Permanently delete your account and all associated data including trips,
            saved places, emergency contacts, and plan history. This cannot be undone.
          </p>

          {error && (
            <p className="ed-notice ed-notice-err" style={{ textAlign: "left", marginBottom: 10 }}>
              <em>{error}</em>
            </p>
          )}

          {!confirmDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 2,
                border: "1px solid var(--roam-danger)",
                background: "transparent",
                color: "var(--roam-danger)",
                fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
                fontStyle: "italic",
                fontSize: 15,
                fontWeight: 400,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Delete my account
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="ed-notice ed-notice-err" style={{ textAlign: "left", fontSize: 13.5 }}>
                <em>Are you sure? This permanently deletes your account and every piece of data tied to it.</em>
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { haptic.light(); setConfirmDelete(false); }}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: 2,
                    border: "1px solid var(--roam-border)",
                    background: "transparent",
                    color: "var(--roam-text)",
                    fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
                    fontStyle: "italic",
                    fontSize: 15,
                    fontWeight: 400,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: 2,
                    border: "none",
                    background: "var(--roam-danger)",
                    color: "var(--on-color)",
                    fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
                    fontStyle: "italic",
                    fontSize: 15,
                    fontWeight: 400,
                    cursor: "pointer",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Yes, delete everything"}
                </button>
              </div>
            </div>
          )}

          <a
            href="/contact?category=data-request"
            className="ed-textlink"
            style={{ display: "inline-block", marginTop: 14, fontSize: 13 }}
          >
            <em>Request data deletion without deleting your account.</em>
          </a>
        </div>
      </div>

      <div style={{ height: 32, flexShrink: 0 }} />
    </div>
  );
}
