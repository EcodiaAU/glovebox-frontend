// src/app/live/ClientPage.tsx
// Online-only "Go Now" trip - instant navigation without offline bundles.
// No IDB storage, no corridor, no bundle build. Just route + navigate.

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import type { Map as MLMap } from "maplibre-gl";

import { TripMap } from "@/components/trip/TripMap";
import { TripView, type TripEditorRebuildMode } from "@/components/trip/TripView";
import { LiveSkeleton } from "./LiveSkeleton";
import { PlaceSearchModal } from "@/components/trips/new/PlaceSearchModal";

// ── Active navigation components ──
import { NavigationHUD } from "@/components/nav/NavigationHUD";
import { NavigationBar } from "@/components/nav/NavigationBar";
import { NavigationControls } from "@/components/nav/NavigationControls";
import { OffRouteBanner } from "@/components/nav/OffRouteBanner";
import { StartNavigationButton } from "@/components/nav/StartNavigationButton";

// ── Hooks ──
import { useGeolocation } from "@/lib/native/geolocation";
import { useKeepAwake } from "@/lib/native/keepAwake";
import { useActiveNavigation } from "@/lib/hooks/useActiveNavigation";
import { useMapNavigationMode } from "@/lib/hooks/useMapNavigationMode";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useCarPlayBridgeSync } from "@/lib/native/carPlay";

import { haptic } from "@/lib/native/haptics";
import { navApi } from "@/lib/api/nav";

import type { NavPack, TrafficOverlay, HazardOverlay } from "@/lib/types/navigation";
import type { TripStop } from "@/lib/types/trip";

import { Radio, WifiOff, MapPin, Search, LocateFixed } from "lucide-react";

/* ── Constants ────────────────────────────────────────────────────────── */

const LIVE_NAVPACK_KEY = "glovebox_live_navpack";
// Poll overlays every 5 minutes (see trip/ClientPage.tsx for the same bump rationale).
const OVERLAY_POLL_INTERVAL_MS = 300_000;

/* ── Session helpers ─────────────────────────────────────────────────── */

function loadLiveNavPack(): NavPack | null {
  try {
    const raw = sessionStorage.getItem(LIVE_NAVPACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NavPack;
  } catch {
    return null;
  }
}

function _clearLiveNavPack(): void {
  try { sessionStorage.removeItem(LIVE_NAVPACK_KEY); } catch {}
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function LiveTripClientPage() {
  const router = useNavigate();

  // Native hooks
  const geo = useGeolocation({ autoStart: true, highAccuracy: true });
  useKeepAwake({ auto: true });
  const { online: isOnline, deviceOnline } = useNetworkStatus();

  // Stable ID for this live session (not persisted)
  // eslint-disable-next-line react-hooks/purity -- stable session ID, only set once on mount
  const livePlanId = useRef(`live_${Date.now().toString(36)}`);

  // Core state
  const [navpack, setNavpack] = useState<NavPack | null>(null);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Destination parsed from the URL (?toLat&toLng&toName). Kept in state so the
  // origin-recovery UI can rebuild the route from a manually chosen start point
  // when device geolocation is denied or unavailable.
  const [pendingDest, setPendingDest] = useState<{ toLat: number; toLng: number; toName: string } | null>(null);
  // True when we have a destination but no origin (geolocation denied/unavailable).
  // Drives the recovery card instead of a dead-end message.
  const [needsOrigin, setNeedsOrigin] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);

  // Overlay state (polled live, never persisted)
  const [traffic, setTraffic] = useState<TrafficOverlay | null>(null);
  const [hazards, setHazards] = useState<HazardOverlay | null>(null);
  // Honest degraded signal: the live traffic + hazard polls both failed, so the
  // map is showing the route only. Surfaced as a small chip rather than a silent
  // no-data map. Distinct from the global "No Server" chip (health-probe based):
  // this tracks the actual /live overlay polls.
  const [overlaysDegraded, setOverlaysDegraded] = useState(false);

  // UI state
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // MapLibre instance ref
  const mapInstanceRef = useRef<MLMap | null>(null);

  // Active navigation
  const activeNav = useActiveNavigation(navpack);

  // CarPlay bridge: minimal sync on /live (navpack + position only;
  // /trip is the page that owns the richer hazards+fuel+vehicle state).
  useCarPlayBridgeSync({
    navpack,
    navStatus: activeNav.nav.status,
    lastPosition: activeNav.lastPosition,
  });

  // Map navigation mode
  const effectiveBbox = navpack?.primary?.bbox ?? null;
  const mapNavMode = useMapNavigationMode({
    mapRef: mapInstanceRef,
    position: activeNav.isActive ? (activeNav.lastPosition ?? geo.position) : null,
    active: activeNav.isActive,
    bbox: effectiveBbox,
  });

  // Bottom sheet drag state
  const sheetRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const dragData = useRef({ startY: 0 });

  // Collapse sheet when entering navigation
  const [prevActive, setPrevActive] = useState(false);
  if (activeNav.isActive && !prevActive) {
    setOffsetY(0);
    setDragOffset(0);
    setPrevActive(true);
  } else if (!activeNav.isActive && prevActive) {
    setPrevActive(false);
  }

  // ── Route builder: origin -> pending destination ────────────────
  // Builds the online navpack. Pass an explicit dest during boot (before the
  // pendingDest state has settled); the recovery UI calls it with no dest so it
  // reads the stored pendingDest.
  const seedFrom = useCallback(
    (from: { lat: number; lng: number }, dest?: { toLat: number; toLng: number; toName: string }) => {
      const d = dest ?? pendingDest;
      if (!d) return;
      setNeedsOrigin(false);
      setOriginPickerOpen(false);
      setBootError(null);
      navApi
        .route({
          profile: "drive",
          stops: [
            { type: "start", name: "My location", lat: from.lat, lng: from.lng },
            { type: "end", name: d.toName, lat: d.toLat, lng: d.toLng },
          ],
        })
        .then((np) => { setNavpack(np); setBooted(true); })
        .catch(() => setBootError("Could not build the route. Glovebox may be offline right now."));
    },
    [pendingDest],
  );

  // Try device geolocation; on denial / unavailability fall back to the origin
  // recovery card instead of a dead-end. The page shell never depends on this.
  const tryGeolocate = useCallback(
    (dest?: { toLat: number; toLng: number; toName: string }) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setNeedsOrigin(true);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => seedFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude }, dest),
        () => setNeedsOrigin(true),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      );
    },
    [seedFrom],
  );

  // ── Boot: load NavPack from sessionStorage, else seed from the URL ──
  // We intentionally do NOT clear sessionStorage here - React StrictMode
  // double-fires effects, and clearing on the first mount would leave
  // the second mount with nothing. sessionStorage auto-clears on tab close.
  useEffect(() => {
    const pack = loadLiveNavPack();
    if (pack) {
      setNavpack(pack);
      setBooted(true);
      return;
    }
    // Deep-link seeding: /live?toLat&toLng&toName[&fromLat&fromLng]. Used by the
    // public /embed "Open in Glovebox" button so a business's site can hand off a
    // trip from the visitor's location to a destination POI (e.g. a Locals merchant).
    const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    // Null-safe coordinate parse. URLSearchParams.get returns null for a missing
    // key and Number(null) is 0 (a FINITE value), so a bare Number() treats an
    // ABSENT coordinate as 0 - routing to/from (0,0) in the Gulf of Guinea and
    // silently swallowing the geolocation + "no route data" paths. Guard the raw
    // string so a missing coord is NaN (not 0), which is what actually makes the
    // manual-origin recovery and the "no route data" state reachable.
    const coord = (v: string | null | undefined): number =>
      v != null && v.trim() !== "" ? Number(v) : NaN;
    const toLat = coord(sp?.get("toLat"));
    const toLng = coord(sp?.get("toLng"));
    if (sp && Number.isFinite(toLat) && Number.isFinite(toLng)) {
      const dest = { toLat, toLng, toName: sp.get("toName") ?? "Destination" };
      setPendingDest(dest);
      const fromLat = coord(sp.get("fromLat"));
      const fromLng = coord(sp.get("fromLng"));
      if (Number.isFinite(fromLat) && Number.isFinite(fromLng)) {
        seedFrom({ lat: fromLat, lng: fromLng }, dest);
      } else {
        tryGeolocate(dest);
      }
      return;
    }
    setBootError("No route data found");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Overlay polling ─────────────────────────────────────────────
  const pollOverlays = useCallback(async () => {
    if (!isOnline || !navpack?.primary?.bbox) return;
    const bbox = navpack.primary.bbox;
    const [t, h] = await Promise.allSettled([
      navApi.trafficPoll({ bbox, cache_seconds: 300 }),
      navApi.hazardsPoll({ bbox, cache_seconds: 300 }),
    ]);
    if (t.status === "fulfilled") setTraffic(t.value);
    if (h.status === "fulfilled") setHazards(h.value);
    // Honest degraded signal: when BOTH polls fail, live traffic + hazards are
    // unavailable (backend down / unreachable), so surface the on-map chip
    // rather than leaving a silent no-data map. A partial failure still carries
    // fresh data on one channel, so don't cry wolf.
    const bothFailed = t.status === "rejected" && h.status === "rejected";
    setOverlaysDegraded(bothFailed);
    if (bothFailed) {
      console.warn(
        "[Live] overlay poll failed:",
        (t as PromiseRejectedResult).reason,
        (h as PromiseRejectedResult).reason,
      );
    }
  }, [navpack, isOnline]);

  useEffect(() => {
    if (!booted || !navpack?.primary?.bbox) return;
    const initialPoll = setTimeout(pollOverlays, 0);
    overlayTimerRef.current = setInterval(pollOverlays, OVERLAY_POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialPoll);
      if (overlayTimerRef.current) {
        clearInterval(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
    };
  }, [booted, navpack, pollOverlays]);

  // ── Rebuild handler (online-only rerouting) ──────────────────────
  const handleRebuild = useCallback(async (args: { stops: TripStop[]; mode: TripEditorRebuildMode }) => {
    const result = await navApi.route({
      profile: navpack?.primary?.profile ?? "drive",
      stops: args.stops,
    });
    setNavpack(result);
  }, [navpack]);

  // ── Off-route reroute handler ────────────────────────────────────
  const handleOffRouteReroute = useCallback(async () => {
    if (!activeNav.lastPosition || !navpack) return;
    const currentPos = activeNav.lastPosition;
    const remainingStops: TripStop[] = [
      { id: "__reroute_origin", name: "Current Location", type: "start", lat: currentPos.lat, lng: currentPos.lng },
      ...navpack.req.stops.filter((s) => s.type !== "start"),
    ];
    try {
      const result = await navApi.route({
        profile: navpack.primary.profile,
        stops: remainingStops,
      });
      setNavpack(result);
      activeNav.applyReroute(result);
    } catch (e) {
      console.warn("[Live] reroute failed:", e);
    }
  }, [activeNav, navpack]);

  // ── Bottom sheet drag handlers ──────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    setIsDraggingState(true);
    dragData.current = { startY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !sheetRef.current) return;
    const totalDelta = e.clientY - dragData.current.startY;
    const sheetHeight = sheetRef.current.clientHeight;
    const maxUp = -(sheetHeight - 220);
    let proposedOffset = offsetY + totalDelta;
    if (proposedOffset < maxUp) proposedOffset = maxUp;
    if (proposedOffset > 0) proposedOffset = 0;
    setDragOffset(proposedOffset - offsetY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    setIsDraggingState(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    // Snap to the nearer of the two rest positions - peek (0) or fully open
    // (maxUp) - instead of leaving the sheet wherever the finger lifted. This
    // is the snap-on-release feel /trip has, rather than a free-floating drag.
    const settled = offsetY + dragOffset;
    const sheetHeight = sheetRef.current?.clientHeight ?? 0;
    const maxUp = -(sheetHeight - 220);
    const snapped = settled < maxUp / 2 ? maxUp : 0;
    setOffsetY(snapped);
    setDragOffset(0);
  };

  // ── Derived values ──────────────────────────────────────────────
  const effectiveStops = useMemo(() => navpack?.req?.stops ?? [], [navpack]);
  const effectiveGeom = navpack?.primary?.geometry ?? null;
  const effectivePosition = activeNav.isActive ? activeNav.lastPosition : geo.position;

  const peekBase = `calc(100% - 220px - var(--glovebox-safe-bottom, 0px))`;
  // During active turn-by-turn the NavigationHUD + NavigationBar are the live UI,
  // so the trip bottom-sheet fully hides. Previously it peeked 60px, leaving the
  // "Live Trip" header stacked under the NavigationBar as duplicated chrome (and
  // the peek was non-interactive here, since this transform ignores offsetY).
  const sheetTransform = activeNav.isActive
    ? `translateY(100%)`
    : `translateY(clamp(0px, calc(${peekBase} + ${offsetY + dragOffset}px), ${peekBase}))`;
  const sheetTransition = isDraggingState ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)";

  // ── Error / recovery / loading gates ────────────────────────────
  if (bootError) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", width: "100%", background: "var(--glovebox-bg)", color: "var(--glovebox-text)", padding: 32, textAlign: "center" }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 16, fontWeight: 950, color: "var(--glovebox-danger)", marginBottom: 12 }}>
            No route loaded
          </div>
          <div style={{ fontSize: 13, color: "var(--glovebox-text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
            {bootError}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
            {pendingDest && (
              <button
                type="button"
                className="trip-interactive"
                style={{ borderRadius: 999, minHeight: 44, padding: "0 20px", fontWeight: 900, background: "var(--glovebox-accent)", color: "var(--on-color)", boxShadow: "var(--shadow-button)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={() => { setBootError(null); tryGeolocate(); }}
              >
                <LocateFixed size={16} strokeWidth={2.5} /> Try again
              </button>
            )}
            <button
              type="button"
              className="trip-interactive"
              style={{ borderRadius: 999, minHeight: 44, padding: "0 20px", fontWeight: 900, background: pendingDest ? "transparent" : "var(--glovebox-accent)", color: pendingDest ? "var(--glovebox-text)" : "var(--on-color)", border: pendingDest ? "1px solid var(--glovebox-border-strong)" : "none", boxShadow: pendingDest ? "none" : "var(--shadow-button)" }}
              onClick={() => router("/new", { replace: true })}
            >
              Plan a Trip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Geolocation denied / unavailable, but we have a destination: offer a manual
  // origin instead of a dead-end. The page shell renders with no backend call.
  if (needsOrigin) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", width: "100%", background: "var(--glovebox-bg)", color: "var(--glovebox-text)", padding: 32, textAlign: "center" }}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-tint)", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--glovebox-accent)" }}>
            <MapPin size={26} strokeWidth={2.25} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8, letterSpacing: "-0.3px" }}>
            Where are you starting from?
          </div>
          <div style={{ fontSize: 13.5, color: "var(--glovebox-text-muted)", marginBottom: 22, lineHeight: 1.5 }}>
            We could not read your location. Pick a starting point and we will build the route
            {pendingDest ? <> to <strong style={{ color: "var(--glovebox-text)" }}>{pendingDest.toName}</strong></> : null}.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
            <button
              type="button"
              className="trip-interactive"
              onClick={() => { haptic.selection(); setOriginPickerOpen(true); }}
              style={{ borderRadius: 999, minHeight: 46, padding: "0 20px", fontWeight: 900, background: "var(--glovebox-accent)", color: "var(--on-color)", boxShadow: "var(--shadow-button)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Search size={16} strokeWidth={2.5} /> Choose a starting point
            </button>
            <button
              type="button"
              className="trip-interactive"
              onClick={() => { haptic.tap(); setNeedsOrigin(false); tryGeolocate(); }}
              style={{ borderRadius: 999, minHeight: 46, padding: "0 20px", fontWeight: 800, background: "transparent", color: "var(--glovebox-text)", border: "1px solid var(--glovebox-border-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <LocateFixed size={16} strokeWidth={2.5} /> Use my location
            </button>
            <button
              type="button"
              className="trip-interactive"
              onClick={() => router("/new", { replace: true })}
              style={{ background: "none", border: "none", color: "var(--glovebox-text-muted)", fontWeight: 700, fontSize: 13, padding: "8px 0", cursor: "pointer" }}
            >
              Plan a full trip instead
            </button>
          </div>
        </div>

        <PlaceSearchModal
          open={originPickerOpen}
          stopId="live-origin"
          mapCenter={pendingDest ? { lat: pendingDest.toLat, lng: pendingDest.toLng } : null}
          onClose={() => setOriginPickerOpen(false)}
          onPick={({ lat, lng }) => seedFrom({ lat, lng })}
        />
      </div>
    );
  }

  if (!booted || !navpack || !effectiveGeom || !effectiveBbox) {
    return <LiveSkeleton />;
  }

  // ── Ready ───────────────────────────────────────────────────────
  return (
    <div className="trip-app-container">
      {/* Map Layer */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <TripMap
          styleId="glovebox-basemap-hybrid"
          stops={effectiveStops}
          geometry={effectiveGeom}
          bbox={effectiveBbox}
          focusedStopId={focusedStopId}
          onStopPress={(id) => { haptic.selection(); setFocusedStopId(id); }}
          traffic={traffic}
          hazards={hazards}
          onTrafficEventPress={(_id) => { haptic.selection(); }}
          onHazardEventPress={(_id) => { haptic.selection(); }}
          userPosition={activeNav.isActive ? activeNav.lastPosition : geo.position}
          isOnline={isOnline}
          navigationMode={activeNav.isActive}
          mapInstanceRef={mapInstanceRef}
        />
      </div>

      {/* ── Degraded-data chip ──
          Honest, unobtrusive surface for when the live traffic + hazard polls
          fail: the route still renders, but overlays are stale/absent, so say
          so rather than showing a silent no-data map. Hidden during active
          turn-by-turn, where the NavigationHUD owns the top of the screen. */}
      {overlaysDegraded && !activeNav.isActive && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 52px)",
            left: 12,
            zIndex: 30,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            borderRadius: 999,
            background: "var(--glovebox-surface)",
            color: "var(--glovebox-text-muted)",
            border: "1px solid var(--glovebox-border-strong)",
            boxShadow: "var(--shadow-fab)",
            fontSize: 11.5,
            fontWeight: 800,
            maxWidth: "calc(100% - 24px)",
          }}
        >
          <WifiOff size={13} strokeWidth={2.5} style={{ flexShrink: 0, color: "var(--glovebox-warn)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deviceOnline ? "Can't reach Glovebox · route only" : "Offline · route only"}
          </span>
        </div>
      )}

      {/* ── Active Navigation Overlays ── */}
      <NavigationHUD
        nav={activeNav.nav}
        visible={activeNav.isActive && activeNav.nav.status !== "off_route"}
      />
      <OffRouteBanner
        visible={activeNav.nav.status === "off_route"}
        distFromRoute_m={activeNav.nav.distFromRoute_m}
        hasCorridorGraph={false}
        onReroute={handleOffRouteReroute}
      />
      <NavigationControls
        visible={activeNav.isActive}
        isMuted={activeNav.isMuted}
        onToggleMute={activeNav.toggleMute}
        onOverview={mapNavMode.showOverview}
        onRecenter={mapNavMode.recenter}
        onEnd={activeNav.stop}
      />
      <NavigationBar
        nav={activeNav.nav}
        fuelTracking={null}
        visible={activeNav.isActive}
        onTap={() => {
          if (sheetRef.current) {
            const h = sheetRef.current.clientHeight;
            setOffsetY(-(h - 300));
            setTimeout(() => setOffsetY(0), 8000);
          }
        }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="trip-bottom-sheet"
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "calc(100% - 80px)",
          zIndex: 20,
          transform: sheetTransform,
          transition: sheetTransition,
          willChange: "transform",
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            padding: "16px 20px 6px",
            touchAction: "none",
            cursor: "grab",
          }}
        >
          <div className="trip-drag-handle" />
        </div>

        {/* Header */}
        <div style={{ padding: "0 20px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 20, fontWeight: 950, margin: 0,
                  display: "flex", alignItems: "center", gap: 10,
                  color: "var(--glovebox-text)", letterSpacing: "-0.3px",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Live Trip
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 999,
                  background: "var(--accent-tint)", color: "var(--glovebox-success)",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                  textTransform: "uppercase", flexShrink: 0,
                  border: "1px solid var(--glovebox-border-strong)",
                }}>
                  <Radio size={10} strokeWidth={3} />
                  Live
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--glovebox-text-muted)", marginTop: 2 }}>
                Online only &middot; not saved to device
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: "hidden", touchAction: "pan-y" }}>
          <div
            className="glovebox-scroll"
            style={{
              height: "100%",
              overflowY: "auto",
              padding: "0 20px calc(var(--bottom-nav-height) + 20px)",
            }}
          >
            {/* Start Navigation button */}
            {!activeNav.isActive && navpack && (
              <div style={{ marginBottom: 16 }}>
                <StartNavigationButton
                  onStart={activeNav.start}
                  disabled={!navpack?.primary?.legs?.some((l) => l.steps && l.steps.length > 0)}
                />
                {!navpack?.primary?.legs?.some((l) => l.steps && l.steps.length > 0) && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "var(--glovebox-text-muted)", textAlign: "center" }}>
                    Turn-by-turn data not available.
                  </div>
                )}
              </div>
            )}

            <TripView
              planId={livePlanId.current}
              navpack={navpack}
              corridor={null}
              places={null}
              traffic={traffic}
              hazards={hazards}
              focusedStopId={focusedStopId}
              onFocusStop={setFocusedStopId}
              focusedPlaceId={null}
              onFocusPlace={() => {}}
              onRebuildRequested={handleRebuild}
              highlightedAlertId={null}
              onHighlightAlert={() => {}}
              userPosition={effectivePosition}
              fuelAnalysis={null}
              onOpenFuelSettings={() => {}}
              offlineRouted={false}
              isOnline={isOnline}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
