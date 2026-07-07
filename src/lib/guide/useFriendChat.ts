// src/lib/guide/useFriendChat.ts
//
// Glovebox's adapter onto the shared @ecodia/friend-chat component. The shared
// component owns the FAB, the panel and its own display thread; this hook feeds
// it Glovebox's context:
//   - `connected` + `friendName` resolved from GET /guide/friend (the person's
//     linked Ecodia Friend). Not linked -> the component shows the connect-to-buy
//     nudge that routes into signInWithFriend().
//   - `ask(message)` runs the SAME trip-grounded guideEngine turn loop the /guide
//     route uses (createGuidePack + guideSendMessage), so replies still see the
//     route, stops, fuel, weather and nearby places. The engine's thread is
//     threaded forward across turns via refs, so it stays one conversation.
//   - action pills (web/call/map/save) ride back as the opaque `extra` payload
//     the component draws via renderExtra; the plain reply text is `reply`.
//
// The trip guide pack boots lazily on the first ask (the FAB stays cheap to
// mount everywhere); if there is no current trip, ask returns a friendly nudge
// to open one rather than a dead composer.

import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentPlanId, getOfflinePlan, type OfflinePlanRecord } from "@/lib/offline/plansStore";
import { getAllPacks, hasCorePacks } from "@/lib/offline/packsStore";
import { unpackAndStoreBundle } from "@/lib/offline/unpackBundle";
import { createGuidePack, guideSendMessage } from "@/lib/guide/guideEngine";
import { computeTripProgress } from "@/lib/guide/tripProgress";
import { useGeolocation } from "@/lib/native/geolocation";
import { guideApi } from "@/lib/api/guide";
import { toErrorMessage } from "@/lib/utils/errors";

import type { FriendAskResult } from "@ecodia/friend-chat";
import type { GuidePack, GuideContext, TripProgress, GuideAction, GuideMsg } from "@/lib/types/guide";
import type { TripStop } from "@/lib/types/trip";
import type { PlaceItem } from "@/lib/types/places";

export type GloveboxFriendChat = {
  /** null while resolving; true = linked Friend (chat), false = connect-to-buy nudge. */
  connected: boolean | null;
  friendName: string;
  ask: (message: string) => Promise<FriendAskResult>;
};

const NO_TRIP_REPLY =
  "Open a trip and I can see your route, stops, fuel, weather and what is nearby. Pick a trip and ask me anything about the road ahead.";

export function useGloveboxFriend(): GloveboxFriendChat {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [friendName, setFriendName] = useState<string>("Friend");

  // GPS warms once we know the person is connected, so trip grounding has a fix
  // ready by the time they ask.
  const geo = useGeolocation({ autoStart: connected === true, highAccuracy: true });
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // Resolve the person's linked Friend once. Not connected / offline -> the
  // component shows the connect nudge.
  useEffect(() => {
    let cancelled = false;
    guideApi
      .friend()
      .then((r) => {
        if (cancelled) return;
        setConnected(!!r?.connected);
        if (r?.name) setFriendName(r.name);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy trip-guide boot state (mirrors useFloatingGuide, held in refs so ask can
  // thread the conversation forward without re-rendering the whole tree).
  const bootedRef = useRef(false);
  const planRef = useRef<OfflinePlanRecord | null>(null);
  const guideKeyRef = useRef<string | null>(null);
  const packRef = useRef<GuidePack | null>(null);
  const contextRef = useRef<GuideContext | null>(null);
  const placesRef = useRef<PlaceItem[]>([]);
  const stopsRef = useRef<TripStop[]>([]);
  const progressRef = useRef<TripProgress | null>(null);
  const sendInFlight = useRef(false);

  const ensureBooted = useCallback(async (): Promise<boolean> => {
    if (bootedRef.current) {
      return !!(guideKeyRef.current && packRef.current && contextRef.current);
    }
    bootedRef.current = true;

    const id = await getCurrentPlanId();
    if (!id) return false;
    const rec = await getOfflinePlan(id);
    if (!rec) return false;

    const has = await hasCorePacks(rec.plan_id);
    if (!has && rec.zip_blob) await unpackAndStoreBundle(rec);

    const packs = await getAllPacks(rec.plan_id);
    const navpackLoaded = packs.navpack ?? null;
    const placesLoaded = packs.places ?? null;
    const stops = (navpackLoaded?.req?.stops ?? rec.preview?.stops ?? []) as TripStop[];
    if (stops.length === 0) return false;

    const { guideKey, pack, context } = await createGuidePack({
      planId: rec.plan_id,
      label: rec.label ?? null,
      stops,
      navpack: navpackLoaded,
      corridor: packs.corridor ?? null,
      places: placesLoaded,
      traffic: packs.traffic ?? null,
      hazards: packs.hazards ?? null,
      manifest: packs.manifest ?? null,
      weather: packs.weather ?? null,
      flood: packs.flood ?? null,
      coverage: packs.coverage ?? null,
      wildlife: packs.wildlife ?? null,
      rest_areas: packs.rest_areas ?? null,
      route_score: packs.route_score ?? null,
      fuel: packs.fuel ?? null,
      progress: null,
      driverState: null,
      tripPrefs: rec.trip_prefs ?? null,
    });

    planRef.current = rec;
    placesRef.current = placesLoaded?.items ?? [];
    stopsRef.current = stops;
    guideKeyRef.current = guideKey;
    packRef.current = pack;
    contextRef.current = context;
    return true;
  }, []);

  const ask = useCallback(
    async (message: string): Promise<FriendAskResult> => {
      const body = message.trim();
      if (!body) return { friend_connected: true, friendName, reply: "" };
      if (sendInFlight.current) {
        return { friend_connected: true, friendName, reply: "One moment - still on the last one." };
      }
      sendInFlight.current = true;
      try {
        const ready = await ensureBooted();
        if (!ready || !guideKeyRef.current || !packRef.current || !contextRef.current) {
          return { friend_connected: true, friendName, reply: NO_TRIP_REPLY };
        }

        // Freshen trip progress from GPS for this turn.
        let latestProgress = progressRef.current;
        const pos = geoRef.current.position;
        if (pos && stopsRef.current.length > 0) {
          latestProgress = computeTripProgress({
            position: pos,
            stops: stopsRef.current,
            navpack: null,
            prevProgress: progressRef.current,
          });
          progressRef.current = latestProgress;
        }

        const freshContext: GuideContext = { ...contextRef.current, progress: latestProgress };
        const res = await guideSendMessage({
          planId: planRef.current?.plan_id ?? null,
          guideKey: guideKeyRef.current,
          pack: packRef.current,
          context: freshContext,
          userText: body,
          preferredCategories: [],
          maxSteps: 3,
          progress: latestProgress,
          corridorPlaces: placesRef.current,
          onPackUpdate: (p) => {
            packRef.current = p;
          },
        });
        packRef.current = res.pack;
        contextRef.current = freshContext;

        // The action pills live on the newest assistant message in the pack.
        const last = res.pack.thread[res.pack.thread.length - 1] as GuideMsg | undefined;
        const actions = (last?.role === "assistant" ? last.actions ?? [] : []).filter(Boolean) as GuideAction[];

        return {
          friend_connected: true,
          friendName,
          reply: res.assistantText || last?.content || "",
          extra: actions.length > 0 ? actions : undefined,
        };
      } catch (e: unknown) {
        return {
          friend_connected: true,
          friendName,
          reply: toErrorMessage(e) || `I could not reach ${friendName} just then. Try again in a moment.`,
        };
      } finally {
        sendInFlight.current = false;
      }
    },
    [ensureBooted, friendName],
  );

  return { connected, friendName, ask };
}
