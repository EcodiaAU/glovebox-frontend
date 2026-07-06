// src/lib/guide/useFloatingGuide.ts
//
// Boots the SAME guide conversation the /guide route uses, for the floating
// chat mounted globally in AppLayout. createGuidePack fingerprints by
// plan + route/corridor + stops and restores the existing thread from IDB, so
// the floating chat and the full /guide screen converge on one guideKey and one
// thread: it is genuinely the same conversation, just reachable from anywhere.
//
// Kept deliberately lean (no overlay-driven driverState) so the FAB is cheap to
// mount everywhere; the full /guide route remains the rich surface.

import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentPlanId, getOfflinePlan, type OfflinePlanRecord } from "@/lib/offline/plansStore";
import { getAllPacks, hasCorePacks } from "@/lib/offline/packsStore";
import { unpackAndStoreBundle } from "@/lib/offline/unpackBundle";
import { createGuidePack, guideSendMessage } from "@/lib/guide/guideEngine";
import { computeTripProgress } from "@/lib/guide/tripProgress";
import { useGeolocation } from "@/lib/native/geolocation";
import { guideApi } from "@/lib/api/guide";
import { toErrorMessage } from "@/lib/utils/errors";

import type { GuidePack, GuideContext, TripProgress } from "@/lib/types/guide";
import type { TripStop } from "@/lib/types/trip";
import type { PlaceItem } from "@/lib/types/places";

export type FloatingGuideState = {
  /** Resolved Friend name, or null before load / when not connected. */
  friendName: string | null;
  /** True once a plan + guide pack are booted and messages can be sent. */
  ready: boolean;
  booting: boolean;
  /** No current trip selected - chat cannot ground in a trip yet. */
  noPlan: boolean;
  planLabel: string | null;
  pack: GuidePack | null;
  busy: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
};

/**
 * @param open  Only boots on first open, so the FAB itself is free everywhere.
 */
export function useFloatingGuide(open: boolean): FloatingGuideState {
  const geo = useGeolocation({ autoStart: open, highAccuracy: true });

  const [friendName, setFriendName] = useState<string | null>(null);
  const [plan, setPlan] = useState<OfflinePlanRecord | null>(null);
  const [guideKey, setGuideKey] = useState<string | null>(null);
  const [pack, setPack] = useState<GuidePack | null>(null);
  const [context, setContext] = useState<GuideContext | null>(null);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [navpackStops, setNavpackStops] = useState<TripStop[]>([]);
  const [tripProgress, setTripProgress] = useState<TripProgress | null>(null);

  const [booting, setBooting] = useState(false);
  const [noPlan, setNoPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootedRef = useRef(false);
  const sendInFlight = useRef(false);

  // Resolve the Friend name once (independent of the trip boot). Anonymous or
  // non-connected users resolve to null -> the header shows "Friend".
  useEffect(() => {
    if (!open || friendName !== null) return;
    let cancelled = false;
    guideApi
      .friend()
      .then((r) => {
        if (!cancelled && r?.name) setFriendName(r.name);
      })
      .catch(() => {
        /* not connected / offline - neutral "Friend" is the fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [open, friendName]);

  // Boot the guide for the current trip, once, on first open.
  useEffect(() => {
    if (!open || bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;

    (async () => {
      setBooting(true);
      setError(null);
      try {
        const id = await getCurrentPlanId();
        if (cancelled) return;
        if (!id) {
          setNoPlan(true);
          return;
        }
        const rec = await getOfflinePlan(id);
        if (cancelled) return;
        if (!rec) {
          setNoPlan(true);
          return;
        }

        const has = await hasCorePacks(rec.plan_id);
        if (!has && rec.zip_blob) await unpackAndStoreBundle(rec);

        const packs = await getAllPacks(rec.plan_id);
        if (cancelled) return;

        const navpackLoaded = packs.navpack ?? null;
        const placesLoaded = packs.places ?? null;
        const stops = (navpackLoaded?.req?.stops ?? rec.preview?.stops ?? []) as TripStop[];
        if (stops.length === 0) {
          setNoPlan(true);
          return;
        }

        const { guideKey: gk, pack: gp, context: gc } = await createGuidePack({
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
        if (cancelled) return;

        setPlan(rec);
        setPlaces(placesLoaded?.items ?? []);
        setNavpackStops(stops);
        setGuideKey(gk);
        setPack(gp);
        setContext(gc);
      } catch (e: unknown) {
        if (!cancelled) setError(toErrorMessage(e));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Keep trip progress fresh from GPS while the chat is open.
  useEffect(() => {
    if (!geo.position || !plan || navpackStops.length === 0) return;
    setTripProgress((prev) =>
      computeTripProgress({
        position: geo.position!,
        stops: navpackStops,
        navpack: null,
        prevProgress: prev,
      }),
    );
  }, [geo.position, plan, navpackStops]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !guideKey || !pack || !context) return;
      if (sendInFlight.current) return;
      sendInFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        let latestProgress = tripProgress;
        if (geo.position && navpackStops.length > 0) {
          latestProgress = computeTripProgress({
            position: geo.position,
            stops: navpackStops,
            navpack: null,
            prevProgress: tripProgress,
          });
          setTripProgress(latestProgress);
        }
        const freshContext: GuideContext = { ...context, progress: latestProgress };
        const res = await guideSendMessage({
          planId: plan?.plan_id ?? null,
          guideKey,
          pack,
          context: freshContext,
          userText: body,
          preferredCategories: [],
          maxSteps: 3,
          progress: latestProgress,
          corridorPlaces: places,
          onPackUpdate: (p) => setPack(p),
        });
        setPack(res.pack);
        setContext(freshContext);
      } catch (e: unknown) {
        setError(toErrorMessage(e));
      } finally {
        setBusy(false);
        sendInFlight.current = false;
      }
    },
    [guideKey, pack, context, tripProgress, geo.position, navpackStops, places, plan],
  );

  return {
    friendName,
    ready: !!(guideKey && pack && context),
    booting,
    noPlan,
    planLabel: plan?.label ?? null,
    pack,
    busy,
    error,
    send,
  };
}
