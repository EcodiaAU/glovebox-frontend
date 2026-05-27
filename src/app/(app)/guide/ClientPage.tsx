// src/app/guide/ClientPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { haptic } from "@/lib/native/haptics";
import { toErrorMessage } from "@/lib/utils/errors";
import { useGeolocation } from "@/lib/native/geolocation";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { getCurrentPlanId, getOfflinePlan, type OfflinePlanRecord } from "@/lib/offline/plansStore";
import { getAllPacks, hasCorePacks } from "@/lib/offline/packsStore";
import { unpackAndStoreBundle } from "@/lib/offline/unpackBundle";

import type { NavPack, CorridorGraphPack, TrafficOverlay, HazardOverlay } from "@/lib/types/navigation";
import type { PlacesPack, PlaceItem } from "@/lib/types/places";
import type { OfflineBundleManifest } from "@/lib/types/bundle";
import type { GuidePack, GuideContext, TripProgress } from "@/lib/types/guide";
import type {
    WeatherOverlay,
    FloodOverlay,
    CoverageOverlay,
    WildlifeOverlay,
    RestAreaOverlay,
    RouteIntelligenceScore,
    FuelOverlay,
} from "@/lib/types/overlays";
import type { TripStop } from "@/lib/types/trip";

import { createGuidePack, guideSendMessage } from "@/lib/guide/guideEngine";
import { computeTripProgress } from "@/lib/guide/tripProgress";
import { addPlaceToTrip } from "@/lib/guide/addToTrip";
import { usePlaceDetail } from "@/lib/context/PlaceDetailContext";

import { GuideView, type GuideTabBarProps } from "@/components/trip/GuideView";

import { Satellite, AlertTriangle } from "lucide-react";
import { NetworkPill, AccountBtn } from "@/components/roam-ui-v2/shared";
import { GloveboxMark } from "@/components/brand/GloveboxMark";
import { GuideSkeleton } from "./GuideSkeleton";

import type { GuideBootstrap } from "@/lib/guide/guideEngine";

// ──────────────────────────────────────────────────────────────
// Driver state builder
// ──────────────────────────────────────────────────────────────

/**
 * Build a driverState snapshot from available data for Guide AI context.
 * This gives the AI situational awareness: fuel, fatigue, speed, night, temperature.
 */
function buildDriverState(
  weather: WeatherOverlay | null,
  fuel: FuelOverlay | null,
  navpack: NavPack | null,
  progress: TripProgress | null,
): GuideBootstrap["driverState"] {
  if (!progress) return null;

  // Find weather at the user's current position
  let nearestWeather: WeatherOverlay["points"][number] | null = null;
  if (weather?.points?.length) {
    let bestDist = Infinity;
    for (const p of weather.points) {
      const d = Math.abs(p.km_along - progress.km_from_start);
      if (d < bestDist) { bestDist = d; nearestWeather = p; }
    }
  }

  // Estimate ETA
  const totalDist = navpack?.primary?.distance_m ?? 0;
  const totalDur = navpack?.primary?.duration_s ?? 0;
  const remainKm = progress.km_remaining;
  const plannedSpeed = totalDist > 0 ? totalDist / totalDur : 25; // m/s
  const remainSec = (remainKm * 1000) / (plannedSpeed || 25);
  const eta = new Date(Date.now() + remainSec * 1000);
  const etaIso = eta.toISOString();

  // Night arrival: does ETA fall outside daylight?
  let nightArrival = false;
  if (weather?.points?.length) {
    const lastPt = weather.points[weather.points.length - 1];
    if (lastPt.sunset_iso) {
      try { nightArrival = eta > new Date(lastPt.sunset_iso); } catch {}
    }
  }

  return {
    temperature_c: nearestWeather?.temperature_c,
    is_night: nearestWeather ? nearestWeather.is_daylight === false : undefined,
    eta_iso: etaIso,
    night_arrival: nightArrival,
    speed_ratio: undefined, // not available in guide page (no active nav)
    fatigue_level: undefined,
    hours_since_rest: undefined,
    fuel_pressure: undefined,
    km_to_next_fuel: undefined,
  };
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export default function GuideClientPage(props: {
  initialPlanId: string | null;
  initialFocusPlaceId: string | null;
}) {
  const router = useNavigate();
  const [sp] = useSearchParams();
  const { online: isOnline } = useNetworkStatus();
  const { registerNavigateHandler } = usePlaceDetail();


  const planIdFromUrl = sp.get("plan_id");
  const focusFromUrl = sp.get("focus_place_id");
  const askAboutFromUrl = sp.get("ask_about");

  const desiredPlanId = useMemo(
    () => props.initialPlanId ?? planIdFromUrl ?? null,
    [props.initialPlanId, planIdFromUrl],
  );
  const desiredFocusPlaceId = useMemo(
    () => props.initialFocusPlaceId ?? focusFromUrl ?? null,
    [props.initialFocusPlaceId, focusFromUrl],
  );

  // ── Geolocation ──────────────────────────────────────────────
  const geo = useGeolocation({ autoStart: true, highAccuracy: true });

  // ── Data state ───────────────────────────────────────────────
  const [plan, setPlan] = useState<OfflinePlanRecord | null>(null);
  const [navpack, setNavpack] = useState<NavPack | null>(null);
  const [corridor, setCorridor] = useState<CorridorGraphPack | null>(null);
  const [places, setPlaces] = useState<PlacesPack | null>(null);
  const [_traffic, setTraffic] = useState<TrafficOverlay | null>(null);
  const [_hazards, setHazards] = useState<HazardOverlay | null>(null);
  const [_manifest, setManifest] = useState<OfflineBundleManifest | null>(null);
  const [weather, setWeather] = useState<WeatherOverlay | null>(null);
  const [flood, setFlood] = useState<FloodOverlay | null>(null);
  const [coverage, setCoverage] = useState<CoverageOverlay | null>(null);
  const [wildlife, setWildlife] = useState<WildlifeOverlay | null>(null);
  const [restAreas, setRestAreas] = useState<RestAreaOverlay | null>(null);
  const [routeScore, setRouteScore] = useState<RouteIntelligenceScore | null>(null);
  const [fuelOverlay, setFuelOverlay] = useState<FuelOverlay | null>(null);

  const [focusedPlaceId, setFocusedPlaceId] = useState<string | null>(desiredFocusPlaceId);

  // ── Trip progress ────────────────────────────────────────────
  const [tripProgress, setTripProgress] = useState<TripProgress | null>(null);

  // ── Guide state ──────────────────────────────────────────────
  const [guideKey, setGuideKey] = useState<string | null>(null);
  const [guidePack, setGuidePack] = useState<GuidePack | null>(null);
  const [guideContext, setGuideContext] = useState<GuideContext | null>(null);

  const [busy, setBusy] = useState<null | "boot" | "chat" | "add">(null);
  const [err, setErr] = useState<string | null>(null);

  // Hoisted tab bar state from GuideView
  const [guideTabBar, setGuideTabBar] = useState<GuideTabBarProps | null>(null);
  const handleTabBarRender = useCallback((props: GuideTabBarProps) => {
    setGuideTabBar((prev) =>
      prev?.activeTab === props.activeTab && prev?.discoveredCount === props.discoveredCount
        ? prev
        : props
    );
  }, []);

  useEffect(() => setFocusedPlaceId(desiredFocusPlaceId), [desiredFocusPlaceId]);

  // ── Boot packs from IDB, create guide pack, and kick off greeting ──
  const didGreetRef = useRef(false);
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBusy("boot");
      setErr(null);
      try {
        const id = desiredPlanId ?? (await getCurrentPlanId());
        if (cancelled) return;
        if (!id) {
          setErr("No trip selected. Go back and pick a plan first.");
          return;
        }

        const rec = await getOfflinePlan(id);
        if (cancelled) return;
        if (!rec) {
          setErr("Trip data not found. The plan may have been deleted.");
          return;
        }

        const has = await hasCorePacks(rec.plan_id);
        if (!has && rec.zip_blob) await unpackAndStoreBundle(rec);
        // Minimal plans (navpack-only, no zip) skip unpacking - packs are
        // populated progressively by backgroundEnrich on the trip page.

        const packs = await getAllPacks(rec.plan_id);
        if (cancelled) return;

        const navpackLoaded = packs.navpack ?? null;
        const corridorLoaded = packs.corridor ?? null;
        const placesLoaded = packs.places ?? null;
        const trafficLoaded = packs.traffic ?? null;
        const hazardsLoaded = packs.hazards ?? null;
        const manifestLoaded = packs.manifest ?? null;
        const weatherLoaded = packs.weather ?? null;
        const floodLoaded = packs.flood ?? null;
        const coverageLoaded = packs.coverage ?? null;
        const wildlifeLoaded = packs.wildlife ?? null;
        const restAreasLoaded = packs.rest_areas ?? null;
        const routeScoreLoaded = packs.route_score ?? null;
        const fuelOverlayLoaded = packs.fuel ?? null;

        setPlan(rec);
        setNavpack(navpackLoaded);
        setCorridor(corridorLoaded);
        setPlaces(placesLoaded);
        setTraffic(trafficLoaded);
        setHazards(hazardsLoaded);
        setManifest(manifestLoaded);
        setWeather(weatherLoaded);
        setFlood(floodLoaded);
        setCoverage(coverageLoaded);
        setWildlife(wildlifeLoaded);
        setRestAreas(restAreasLoaded);
        setRouteScore(routeScoreLoaded);
        setFuelOverlay(fuelOverlayLoaded);

        // ── Bootstrap guide pack immediately (no extra render cycle) ──
        const stops = (navpackLoaded?.req?.stops ?? rec.preview?.stops ?? []) as TripStop[];
        if (stops.length === 0) return;

        const { guideKey: gk, pack, context } = await createGuidePack({
          planId: rec.plan_id,
          label: rec.label ?? null,
          stops,
          navpack: navpackLoaded,
          corridor: corridorLoaded,
          places: placesLoaded,
          traffic: trafficLoaded,
          hazards: hazardsLoaded,
          manifest: manifestLoaded,
          weather: weatherLoaded,
          flood: floodLoaded,
          coverage: coverageLoaded,
          wildlife: wildlifeLoaded,
          rest_areas: restAreasLoaded,
          route_score: routeScoreLoaded,
          fuel: fuelOverlayLoaded,
          progress: null,
          driverState: buildDriverState(weatherLoaded, fuelOverlayLoaded, navpackLoaded, null),
          tripPrefs: rec.trip_prefs ?? null,
        });

        if (cancelled) return;

        setGuideKey(gk);
        setGuidePack(pack);
        setGuideContext(context);

        // ── Auto-greeting if thread is empty ──────────────────────
        if (pack.thread.length > 0 || didGreetRef.current) return;
        didGreetRef.current = true;

        const origin = stops[0]?.name ?? "your starting point";
        const dest = stops[stops.length - 1]?.name ?? "your destination";
        const totalKm = navpackLoaded?.primary?.distance_m
          ? Math.round(navpackLoaded.primary.distance_m / 1000)
          : null;

        const greetingPrompt = totalKm
          ? `[SYSTEM: The user just opened the guide for their trip from ${origin} to ${dest} (${totalKm}km). Give them a warm welcome - mention highlights or heads-ups you know about this route from your own knowledge. Then search for more interesting stops, current conditions, or anything useful. Reply immediately with what you know, and use tools to find more - you can do both at once.]`
          : `[SYSTEM: The user just opened the guide for their trip from ${origin} to ${dest}. Give them a warm welcome with what you know about this route, and search for interesting things along the way. Reply and search at the same time.]`;

        setBusy("chat");
        try {
          const corridorPlaces: PlaceItem[] = placesLoaded?.items ?? [];
          const res = await guideSendMessage({
            planId: rec.plan_id,
            guideKey: gk,
            pack,
            context,
            userText: greetingPrompt,
            preferredCategories: [],
            maxSteps: 1,
            progress: null,
            corridorPlaces,
            onPackUpdate: (p) => { if (!cancelled) setGuidePack(p); },
          });
          if (!cancelled) setGuidePack(res.pack);
        } catch {
          // Non-critical - guide still works without greeting
        } finally {
          if (!cancelled) setBusy(null);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(toErrorMessage(e));
      } finally {
        if (!cancelled) setBusy((b) => (b === "boot" ? null : b));
      }
    }

    boot();
    return () => {
      cancelled = true;
      // Don't reset didGreetRef here. If the effect re-runs (e.g. strict
      // mode double-mount, or a ref-changing re-render that drops us into
      // the deps), the greeting would fire twice. The ref guards across
      // the component's lifetime; we only reset if the plan_id changes.
    };
  }, [desiredPlanId]);

  // ── Compute trip progress when position updates ──────────────
  useEffect(() => {
    if (!geo.position || !plan) return;

    const stops = (navpack?.req?.stops ?? plan.preview?.stops ?? []) as TripStop[];
    if (stops.length === 0) return;

    const progress = computeTripProgress({
      position: geo.position,
      stops,
      navpack,
      prevProgress: tripProgress,
    });

    setTripProgress(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, plan, navpack]);

  // ── Handlers ─────────────────────────────────────────────────

  const sendInFlightRef = useRef(false);
  const handleSendMessage = useCallback(
    async (text: string, preferredCategories: string[]) => {
      if (!guideKey || !guidePack || !guideContext) return;
      // Hard guard: if a send is already in flight, don't race it. The UI
      // also blocks this in handleAsk, but callers (auto-ask, onPackUpdate
      // resubmits) could bypass that.
      if (sendInFlightRef.current) return;
      sendInFlightRef.current = true;

      setBusy("chat");
      setErr(null);
      try {
        // Recompute progress right before sending for freshest position
        let latestProgress = tripProgress;
        if (geo.position && plan) {
          const stops = (navpack?.req?.stops ?? plan.preview?.stops ?? []) as TripStop[];
          if (stops.length > 0) {
            latestProgress = computeTripProgress({
              position: geo.position,
              stops,
              navpack,
              prevProgress: tripProgress,
            });
            setTripProgress(latestProgress);
          }
        }

        // Update context with latest progress + live driver state
        const freshContext: GuideContext = {
          ...guideContext,
          progress: latestProgress,
          driver_state: buildDriverState(weather, fuelOverlay, navpack, latestProgress),
        };

        // CRITICAL: Pass corridor places so the intent mapper can pre-filter them
        const corridorPlaces: PlaceItem[] = places?.items ?? [];

        const res = await guideSendMessage({
          planId: plan?.plan_id ?? null,
          guideKey,
          pack: guidePack,
          context: freshContext,
          userText: text,
          preferredCategories,
          maxSteps: 3,
          progress: latestProgress,
          corridorPlaces,
          onPackUpdate: (p) => setGuidePack(p),
        });

        setGuidePack(res.pack);
        setGuideContext(freshContext);
        return res.assistantText;
      } catch (e: unknown) {
        setErr(toErrorMessage(e));
        throw e;
      } finally {
        setBusy(null);
        sendInFlightRef.current = false;
      }
    },
    [guideKey, guidePack, guideContext, tripProgress, geo.position, plan, navpack, places],
  );

  const handleAddStop = useCallback(
    async (place: PlaceItem) => {
      if (!plan || !navpack) return;
      setErr(null);
      haptic.medium();
      // Fire in background so the GuideView Add button can flip to "Added"
      // immediately. We don't navigate away anymore. The user stays on
      // Guide so they can add more places, and the trip updates under
      // them via IDB/sync.
      try {
        await addPlaceToTrip({
          plan,
          place,
          navpack,
          corridor,
          profile: navpack.req.profile ?? "drive",
          mode: "auto",
        });
        haptic.success();
      } catch (e: unknown) {
        haptic.error();
        setErr(toErrorMessage(e));
        // Rethrow so GuideView's optimistic state can roll back.
        throw e;
      }
    },
    [plan, navpack, corridor],
  );

  // Register "Add to trip" as the navigate handler for PlaceDetailSheet while on this page
  useEffect(() => {
    registerNavigateHandler((placeId, lat, lng, name) => {
      // Only id/lat/lng/name are used by addPlaceToTrip; category is not needed
      handleAddStop({ id: placeId, lat, lng, name, category: "attraction" } as PlaceItem);
    });
    return () => registerNavigateHandler(null);
  }, [handleAddStop, registerNavigateHandler]);

  const handleShowOnMap = useCallback(
    (placeId: string, lat: number, lng: number) => {
      haptic.medium();
      if (!plan) return;
      // Look up place name from places pack or guide discoveries for the popup fallback
      const placeFromPack = places?.items?.find((x) => x.id === placeId);
      const placeFromGuide = guidePack?.discovered_places?.find((x) => x.id === placeId);
      const placeName = placeFromPack?.name ?? placeFromGuide?.name ?? null;
      const nameParam = placeName ? `&focus_place_name=${encodeURIComponent(placeName)}` : "";
      router(
        `/trip?plan_id=${encodeURIComponent(plan.plan_id)}&focus_place_id=${encodeURIComponent(placeId)}&focus_lat=${lat}&focus_lng=${lng}${nameParam}`,
        { replace: true },
      );
    },
    [plan, places, guidePack, router],
  );

  // ── Render ───────────────────────────────────────────────────

  const headerTitle = plan?.label ?? "Guide";

  if (!plan) {
    if (err) {
      return (
        <div
          style={{
            height: "100%",
            background: "var(--roam-bg)",
            color: "var(--roam-text)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 16,
            textAlign: "center",
          }}
        >
          <AlertTriangle size={32} style={{ color: "var(--text-warn)" }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>{err}</p>
          <button
            onClick={() => router("/trip")}
            style={{
              padding: "10px 24px",
              borderRadius: 999,
              background: "var(--roam-accent)",
              color: "var(--on-color)",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            Back to Trip
          </button>
        </div>
      );
    }
    return <GuideSkeleton />;
  }

  return (
    <div
      style={{
        height: "100%",
        background: "var(--roam-bg)",
        color: "var(--roam-text)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER (prototype 2-row layout) ───────────────────── */}
      <div style={{
        flexShrink: 0,
        zIndex: 50,
        padding: "calc(env(safe-area-inset-top, 0px) + 20px) 16px 12px",
        background: "var(--c-bg)",
      }}>
        {/* Row 1: title + network + account */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
        }}>
          <div style={{
            fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: "-0.005em",
            color: "var(--roam-text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: "60%",
          }}>{headerTitle}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NetworkPill state={isOnline ? "online" : "offline"} compact/>
            <AccountBtn onClick={() => { haptic.light(); router("/account"); }}/>
          </div>
        </div>

        {/* Row 2: text-tab pair with a hairline underline on active.
            Softer than the filled segmented control - readable as a
            reading beat rather than a button cluster. */}
        {guideTabBar && (
          <div style={{
            display: "flex", gap: 24, paddingTop: 4,
            borderBottom: "1px solid var(--roam-border)",
          }}>
            {([
              { key: "chat" as const, label: "Chat", badge: null },
              { key: "discoveries" as const, label: "Found", badge: guideTabBar.discoveredCount > 0 ? guideTabBar.discoveredCount : null },
            ]).map((tab) => {
              const active = guideTabBar.activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { haptic.selection(); guideTabBar.setActiveTab(tab.key); }}
                  style={{
                    minHeight: 40,
                    background: "transparent",
                    color: active ? "var(--roam-text)" : "var(--roam-text-muted)",
                    fontWeight: active ? 600 : 500,
                    fontSize: 14,
                    letterSpacing: "0.01em",
                    display: "inline-flex", alignItems: "center", gap: 8,
                    border: "none",
                    borderBottom: active
                      ? "1.5px solid var(--roam-accent)"
                      : "1.5px solid transparent",
                    paddingBottom: 8,
                    marginBottom: -1,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                  {tab.badge != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: "0 6px", minWidth: 18, height: 18,
                      borderRadius: 999,
                      background: active ? "var(--roam-accent)" : "var(--roam-surface-hover)",
                      color: active ? "var(--on-color)" : "var(--roam-text-muted)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Editorial progress strip - hairline bar + quiet caption, no
          bordered card, no gradient fill, no marker dots that ride the
          line. The marker dots and full schematic live on /trip. */}
      {tripProgress && tripProgress.total_km > 0 && (
        <div style={{
          margin: "10px 16px 0",
          flexShrink: 0,
        }}>
          <div style={{
            position: "relative", height: 2, borderRadius: 1,
            background: "var(--roam-border)", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${Math.min(100, (tripProgress.km_from_start / tripProgress.total_km) * 100)}%`,
              background: "var(--roam-accent)",
              transition: "width 0.5s ease-out",
            }}/>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 6,
            fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
            fontStyle: "italic",
            fontSize: 12,
            color: "var(--roam-text-muted)",
          }}>
            <span>{Math.round(tripProgress.km_from_start)} km done.</span>
            <span>{Math.round(tripProgress.km_remaining)} km to go.</span>
          </div>
        </div>
      )}

      {/* GPS status as quiet italic text, no pill, no chrome. */}
      {(geo.loading || geo.error) && (
        <div style={{
          margin: "8px 16px 0", flexShrink: 0,
          fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
          fontStyle: "italic",
          fontSize: 13,
          color: geo.error ? "var(--roam-warn)" : "var(--roam-text-muted)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          {geo.loading ? <Satellite size={13}/> : <AlertTriangle size={13}/>}
          {geo.loading ? "Getting GPS fix." : geo.error}
        </div>
      )}

      {err ? (
        <p style={{
          margin: "12px 16px 0",
          fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--roam-danger)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14}/>
          {err}
        </p>
      ) : null}

      {/* ── Editorial intro - shown until guide has messages ───── */}
      {guidePack && guidePack.thread.length === 0 && busy === "chat" && (
        <div
          style={{
            padding: "20px 16px 8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ color: "var(--roam-accent)" }}>
            <GloveboxMark size={36} />
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(22px, 3vw, 28px)",
              lineHeight: 1.18,
              color: "var(--roam-text)",
              letterSpacing: "-0.005em",
            }}
          >
            Your guide.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--roam-text-muted)",
              lineHeight: 1.5,
              maxWidth: "44ch",
            }}
          >
            Preparing route intel, points of interest, and conditions for
            your trip.
          </p>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: "0 16px",
        }}
      >
        <GuideView
          focusedPlaceId={focusedPlaceId}
          onFocusPlace={setFocusedPlaceId}
          isOnline={isOnline}
          guideReady={!!(guideKey && guidePack && guideContext)}
          guidePack={guidePack}
          tripProgress={tripProgress}
          onSendMessage={handleSendMessage}
          chatBusy={busy === "chat"}
          onAddStop={handleAddStop}
          onShowOnMap={handleShowOnMap}
          initialTab={askAboutFromUrl && !isOnline ? "discoveries" : "chat"}
          autoAskMessage={askAboutFromUrl && isOnline ? decodeURIComponent(askAboutFromUrl) : null}
          renderTabBar={handleTabBarRender}
        />
      </div>
    </div>
  );
}
