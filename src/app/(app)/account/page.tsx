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
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleSignOut = useCallback(async () => {
    haptic.medium();
    await signOut();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);

  // Full local reset: unregister the service worker, drop every cache, and
  // delete the offline database, then hard-reload a clean shell from the
  // network. This is the in-app equivalent of "clear site data" - the only
  // recovery an installed-PWA / WebView user can actually reach if a stale
  // cache or a bad offline record ever wedges the app.
  const handleReset = useCallback(async () => {
    haptic.medium();
    setResetting(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("indexedDB" in window) {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("glovebox_offline");
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        });
      }
    } catch {
      // best-effort: reload regardless so the user is never stuck mid-reset
    } finally {
      window.location.reload();
    }
  }, []);

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
      // Account and all data are gone and the local session is torn down.
      // Land on an explicit "deleted" state rather than silently bouncing to
      // login, so the user has confirmation the erasure happened.
      haptic.success();
      setDeleting(false);
      setDeleted(true);
    }
  }, [confirmDelete, deleteAccount]);

  const email = user?.email ?? session?.user?.email ?? null;

  if (deleted) {
    return (
      <div
        className="ed"
        style={{ position: "absolute", inset: 0, overflowY: "auto" }}
      >
        <div
          className="ed-column"
          style={{
            minHeight: "100%",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "clamp(20px, 8vh, 80px)",
          }}
        >
          <h1 className="ed-heading" style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>
            <em>Account deleted.</em>
          </h1>
          <p style={{
            margin: "10px 0 0",
            fontSize: 14.5,
            color: "var(--glovebox-text-muted)",
            lineHeight: 1.55,
            maxWidth: 460,
          }}>
            Your Glovebox account and all of its data have been permanently
            erased. If you had an App Store or Google Play subscription, remember
            to cancel it in your device settings so you are not billed again.
          </p>
          <button
            type="button"
            onClick={() => { haptic.light(); navigate("/login", { replace: true }); }}
            className="ed-action"
            style={{ marginTop: 22, fontSize: 16 }}
          >
            <em>Return to start.</em>
          </button>
        </div>
      </div>
    );
  }

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
      <div className="ed-column ed-column-settings" style={{ paddingTop: "clamp(20px, 4vh, 40px)" }}>
        {/* Back + heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => { haptic.light(); navigate(-1); }}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "var(--glovebox-text-muted)",
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
              fontFamily: "var(--ff-display)",
              fontSize: 16,
              color: "var(--glovebox-text)",
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
          <p className="ed-label">troubleshooting</p>
          <p style={{
            margin: "6px 0 8px",
            fontSize: 13.5,
            color: "var(--glovebox-text-muted)",
            lineHeight: 1.5,
          }}>
            If the app looks out of date, gets stuck, or fails to load properly,
            reset it. This clears the offline cache and stored data on this
            device and reloads a fresh copy. Your account and anything saved to
            your account are not affected.
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="ed-action"
            style={{ marginTop: 2, fontSize: 16, opacity: resetting ? 0.6 : 1 }}
          >
            <em>{resetting ? "Resetting..." : "Reset app & clear cache."}</em>
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
            margin: "6px 0 10px",
            fontSize: 13.5,
            color: "var(--glovebox-text-muted)",
            lineHeight: 1.5,
          }}>
            Permanently delete your account and all associated data including trips,
            saved places, emergency contacts, plans, and entitlement history. This
            cannot be undone.
          </p>

          <p style={{
            margin: "0 0 10px",
            fontSize: 13,
            color: "var(--glovebox-text-muted)",
            lineHeight: 1.5,
          }}>
            Deleting your account does not cancel any App Store or Google Play
            subscription. Manage that separately in your device settings.
          </p>

          <p style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "var(--glovebox-text-muted)",
            lineHeight: 1.5,
          }}>
            If you connected your Friend, your Friend account and its memory are
            managed separately at{" "}
            <a
              href="https://friend.ecodia.au"
              target="_blank"
              rel="noreferrer"
              className="ed-textlink"
              style={{ display: "inline" }}
            >
              friend.ecodia.au
            </a>
            . Deleting your Glovebox account here removes only your Glovebox data
            and unlinks your Friend from this app.
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
                border: "1px solid var(--glovebox-danger)",
                background: "transparent",
                color: "var(--glovebox-danger)",
                fontFamily: "var(--ff-display)",
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
                    border: "1px solid var(--glovebox-border)",
                    background: "transparent",
                    color: "var(--glovebox-text)",
                    fontFamily: "var(--ff-display)",
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
                    background: "var(--glovebox-danger)",
                    color: "var(--on-color)",
                    fontFamily: "var(--ff-display)",
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
