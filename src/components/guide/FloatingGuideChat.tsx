// src/components/guide/FloatingGuideChat.tsx
//
// The unified floating Friend chat for Glovebox. Mounted globally in AppLayout
// so the person's Friend (with trip tools) is reachable from anywhere, not just
// the /guide route. Drives the SAME guideEngine turn loop (via useFloatingGuide)
// so it is one conversation across the app.
//
// Motion is the canonical unified-floating-chat spring from
// docs/friend-persona-and-floating-chat-unification-spec.md (Chambers is the
// reference): FAB scale spring 420/26, scrim blur fade 0.18, panel y-spring
// 380/34 with AnimatePresence exit. Reduced-motion gated. The FriendMark tile is
// the one invariant visual signature of the self across every Ecodia surface.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Send } from "lucide-react";

import { haptic } from "@/lib/native/haptics";
import { useFloatingGuide } from "@/lib/guide/useFloatingGuide";
import type { GuideAction, GuideMsg } from "@/lib/types/guide";

/* Canonical Friend mark - identical across Studio, Friend, Locals, Chambers and
   Glovebox. Black rounded-square badge carrying the cream Friend "10" logo.
   Self-contained inline SVG, fixed colours, so it renders the same everywhere. */
function FriendMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="48" height="48" rx="12" fill="#0B0B0B" />
      <rect x="13.2" y="15.2" width="3.8" height="17.6" rx="1.9" fill="#F5F1E6" />
      <circle cx="27.6" cy="24" r="7.1" fill="#F5F1E6" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--glovebox-text-muted)",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

function ActionPill({ action }: { action: GuideAction }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    border: "1px solid var(--glovebox-border)",
    background: "var(--glovebox-bg)",
    color: "var(--glovebox-text)",
    textDecoration: "none",
    cursor: "pointer",
  };
  if (action.type === "web" && action.url) {
    return (
      <a href={action.url} target="_blank" rel="noreferrer noopener" style={base} onClick={() => haptic.light()}>
        {action.label}
      </a>
    );
  }
  if (action.type === "call" && action.tel) {
    return (
      <a href={`tel:${action.tel}`} style={base} onClick={() => haptic.light()}>
        {action.label}
      </a>
    );
  }
  // map / save: open the full guide for the trip so the rich place flow (add to
  // trip, show on map) is where it belongs. Never a dead placeholder.
  return (
    <a href="/guide" style={base} onClick={() => haptic.light()}>
      {action.label}
    </a>
  );
}

function Bubble({ msg }: { msg: GuideMsg }) {
  const isUser = msg.role === "user";
  const actions = (msg.actions ?? []).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 6 }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 14px",
          borderRadius: 18,
          fontSize: 14.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: isUser ? "var(--glovebox-accent)" : "var(--glovebox-surface)",
          color: isUser ? "var(--on-color)" : "var(--glovebox-text)",
          borderBottomRightRadius: isUser ? 6 : 18,
          borderBottomLeftRadius: isUser ? 18 : 6,
        }}
      >
        {msg.content}
      </div>
      {!isUser && actions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "90%" }}>
          {actions.map((a, i) => (
            <ActionPill key={i} action={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FloatingGuideChat() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const guide = useFloatingGuide(open);
  const name = guide.friendName ?? "Friend";

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messages = guide.pack?.thread ?? [];

  // Auto-scroll to newest on message / busy change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, guide.busy, open]);

  const springFab = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 26 };
  const springPanel = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 34 };
  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  function submit() {
    const t = draft.trim();
    if (!t || guide.busy || !guide.ready) return;
    haptic.medium();
    setDraft("");
    void guide.send(t);
  }

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.94 }}
            transition={springFab}
            onClick={() => {
              haptic.medium();
              setOpen(true);
            }}
            aria-label={`Chat with ${name}`}
            style={{
              position: "fixed",
              bottom: "calc(var(--bottom-nav-height) + 16px)",
              right: 20,
              zIndex: 120,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px 8px 8px",
              borderRadius: 999,
              background: "var(--glovebox-surface)",
              border: "1px solid var(--glovebox-border)",
              boxShadow: "var(--shadow-heavy)",
              color: "var(--glovebox-text)",
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <FriendMark size={30} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{name}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Scrim + Panel ───────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 130,
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={springPanel}
              role="dialog"
              aria-label={`Chat with ${name}`}
              style={{
                position: "fixed",
                zIndex: 140,
                background: "var(--glovebox-bg)",
                color: "var(--glovebox-text)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "var(--shadow-heavy)",
                overflow: "hidden",
                ...(isDesktop
                  ? {
                      right: 20,
                      bottom: 20,
                      width: 400,
                      maxHeight: "74vh",
                      borderRadius: 20,
                      border: "1px solid var(--glovebox-border)",
                    }
                  : {
                      left: 0,
                      right: 0,
                      bottom: 0,
                      maxHeight: "88vh",
                      borderTopLeftRadius: 22,
                      borderTopRightRadius: 22,
                      paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    }),
              }}
            >
              {/* Header */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 12px 14px 16px",
                  borderBottom: "1px solid var(--glovebox-border)",
                }}
              >
                <FriendMark size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--glovebox-text-muted)" }}>
                    here with you in Glovebox
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptic.light();
                    setOpen(false);
                  }}
                  aria-label="Close chat"
                  style={{
                    width: 44,
                    height: 44,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    border: "none",
                    color: "var(--glovebox-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {messages.length === 0 && !guide.busy && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderBottomLeftRadius: 6,
                        fontSize: 14.5,
                        lineHeight: 1.45,
                        background: "var(--glovebox-surface)",
                        color: "var(--glovebox-text)",
                      }}
                    >
                      {guide.noPlan
                        ? "Open a trip and I can see your route, stops, fuel, weather and what is nearby. Ask me anything in the meantime."
                        : guide.booting
                          ? "One sec, catching up on your trip."
                          : `Hey, it's ${name}. Ask me anything about the road ahead.`}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <Bubble key={i} msg={m} />
                ))}
                {guide.busy && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderBottomLeftRadius: 6,
                        background: "var(--glovebox-surface)",
                      }}
                    >
                      <TypingDots />
                    </div>
                  </div>
                )}
                {guide.error && (
                  <div style={{ fontSize: 12.5, color: "var(--glovebox-danger)", textAlign: "center" }}>
                    {guide.error}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                  padding: "10px 12px 12px",
                  borderTop: "1px solid var(--glovebox-border)",
                }}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={guide.ready || guide.noPlan ? `Message ${name}` : "Loading your trip."}
                  rows={1}
                  style={{
                    flex: 1,
                    resize: "none",
                    maxHeight: 120,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid var(--glovebox-border)",
                    background: "var(--glovebox-surface)",
                    color: "var(--glovebox-text)",
                    fontSize: 14.5,
                    lineHeight: 1.4,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim() || guide.busy || !guide.ready}
                  aria-label="Send"
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 14,
                    border: "none",
                    background: !draft.trim() || guide.busy || !guide.ready ? "var(--glovebox-border)" : "var(--glovebox-accent)",
                    color: "var(--on-color)",
                    cursor: !draft.trim() || guide.busy || !guide.ready ? "default" : "pointer",
                    transition: "background 150ms",
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingGuideChat;
