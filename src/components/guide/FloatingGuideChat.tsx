// src/components/guide/FloatingGuideChat.tsx
//
// The unified floating Friend chat for Glovebox. As of 2026-07-07 this is a thin
// adapter over the shared @ecodia/friend-chat component (Tate spec): the exact
// same invariant FAB (black circle, cream bar, white dot) and chat design across
// every Ecodia app. Glovebox passes only its own context:
//   - the trip-grounded guideEngine turn loop via useGloveboxFriend().ask
//   - connect-to-buy: not-linked people get the nudge routing into the Friend SSO
//     (signInWithFriend), linked people chat with full trip grounding
//   - its web/call/map/save action pills, drawn under replies via renderExtra
//   - the Glovebox accent + a FAB offset that clears the bottom tab bar
//
// Mounted once at AppLayout scope (which already excludes the marketing landing
// and auth surfaces), so no route-hiding is needed here.

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { FriendChat } from "@ecodia/friend-chat";
import "@ecodia/friend-chat/styles.css";

import { haptic } from "@/lib/native/haptics";
import { useAuth } from "@/lib/supabase/auth";
import { useGloveboxFriend } from "@/lib/guide/useFriendChat";
import { isUnlocked, onAuthReadyForGate } from "@/lib/paywall/friendEntitlement";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import type { GuideAction } from "@/lib/types/guide";

const EXAMPLES = [
  "Where should I stop for lunch?",
  "Any good fuel stops coming up?",
  "What is worth seeing near my next stop?",
];

/* Web/call/map/save pills under a Friend reply. Kept app-side (haptics, tel:,
   and routing the rich place flow to /guide) and fed to the shared component via
   its renderExtra render-prop, so the shared chat design never needs to know
   about Glovebox's actions. Never a dead placeholder: map/save open the full
   guide where add-to-trip and show-on-map belong. */
function ActionPill({ action }: { action: GuideAction }) {
  const base: CSSProperties = {
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
  return (
    <a href="/guide" style={base} onClick={() => haptic.light()}>
      {action.label}
    </a>
  );
}

function ActionPills({ actions }: { actions: GuideAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "90%", marginTop: 8 }}>
      {actions.map((a, i) => (
        <ActionPill key={i} action={a} />
      ))}
    </div>
  );
}

export function FloatingGuideChat() {
  const { connected, friendName, ask } = useGloveboxFriend();
  const { signInWithFriend } = useAuth();

  // The always-on guide is a Friend-plan (`friend` entitlement) feature. It also
  // needs a linked Friend to run (identity + trip grounding). So the chat is
  // fully usable only when BOTH hold: a linked Friend AND an active entitlement.
  //  - not connected            -> connect nudge routes into Friend SSO
  //  - connected, not entitled  -> connect nudge opens the native paywall
  //  - connected + entitled     -> full trip-grounded guide
  const [entitled, setEntitled] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void isUnlocked().then((u) => { if (!cancelled) setEntitled(u); }); };
    refresh();
    const unsub = onAuthReadyForGate(refresh);
    return () => { cancelled = true; unsub(); };
  }, []);

  const handleConnect = useCallback(() => {
    if (connected === true) {
      // Linked Friend but no entitlement yet -> present the native purchase sheet.
      haptic.medium();
      setPaywallOpen(true);
    } else {
      void signInWithFriend();
    }
  }, [connected, signInWithFriend]);

  return (
    <>
      <FriendChat
        app="Glovebox"
        connected={connected === true && entitled}
        friendName={friendName}
        ask={ask}
        onConnect={handleConnect}
        examples={EXAMPLES}
        emptyLine={`Hey, it's ${friendName}. Ask me anything about the road ahead.`}
        connectTitle="Unlock your road-trip guide"
        connectBody="Your always-on road guide comes with the Friend plan: it knows you and your trip, and points you to the right fuel, food, stops and sights on the road ahead. One Friend, across everything Ecodia."
        accent="#A8431F"
        onAccent="#FAF7F0"
        renderExtra={(extra) => <ActionPills actions={(extra as GuideAction[]) ?? []} />}
        // No bottom tab bar any more (Glovebox is one page), so the FAB sits on the
        // safe area rather than being lifted over a nav that is not there.
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" } as CSSProperties}
      />
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onUnlocked={() => { setEntitled(true); setPaywallOpen(false); }}
      />
    </>
  );
}

export default FloatingGuideChat;
