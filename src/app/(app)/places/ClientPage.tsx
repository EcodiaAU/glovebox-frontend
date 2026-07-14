// src/app/(app)/places/ClientPage.tsx
//
// Standalone Places view. UNLIKE the in-trip Places tab (fed a trip PlacesPack),
// this route is reachable from the app shell with NO trip: it opens to near-me by
// default (browser/Capacitor geolocation), reads the region-keyed offline POI
// cache first, then refreshes from /places/search when online. Trip is a filter
// elsewhere; here Places stands on its own, the way outback place discovery has
// to (no reception, no route loaded, need the nearest water now).
//
// Offline-first order on every load:
//   1. read the covering tiles from the region cache and render immediately;
//   2. if online, refresh from placesApi.search and upsert the cache;
//   3. if the network / backend is unavailable, keep the cached results and say so.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, RefreshCw, Search, MapPin, Loader2, WifiOff } from "lucide-react";

import { PlaceSearchPanel } from "@/components/places/PlaceSearchPanel";
import { usePlaceDetail } from "@/lib/context/PlaceDetailContext";
import { placesApi } from "@/lib/api/places";
import { getCurrentPosition } from "@/lib/native/geolocation";
import { haptic } from "@/lib/native/haptics";
import {
  getPoiItemsNear,
  getNewestFetchedAtNear,
  upsertPoiResults,
} from "@/lib/offline/poiTilesStore";
import type { NavCoord } from "@/lib/types/geo";
import type { PlaceItem, PlacesPack } from "@/lib/types/places";

const NEAR_ME_RADIUS_M = 50_000; // 50 km near-me default
const RESULT_LIMIT = 200;

type LoadState = "locating" | "loading" | "ready" | "denied";

function makePack(items: PlaceItem[], provider: string): PlacesPack {
  return {
    places_key: `standalone:${provider}`,
    req: null,
    items,
    provider,
    created_at: new Date().toISOString(),
    algo_version: "standalone-v1",
  };
}

function fmtWhen(ts: number | null): string | null {
  if (!ts) return null;
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} d ago`;
}

export default function PlacesClientPage() {
  const navigate = useNavigate();
  const { openPlace } = usePlaceDetail();

  const [state, setState] = useState<LoadState>("locating");
  const [center, setCenter] = useState<NavCoord | null>(null);
  const [pack, setPack] = useState<PlacesPack | null>(null);
  const [label, setLabel] = useState("Near you");
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const reqIdRef = useRef(0);

  // ── Load POIs for a center: cache-first, then live refresh ──────────
  const loadForCenter = useCallback(async (c: NavCoord, displayLabel: string) => {
    const reqId = ++reqIdRef.current;
    setState((s) => (s === "denied" ? "loading" : s));
    setLabel(displayLabel);

    // 1. Offline-first: show whatever is cached for this area immediately.
    let hadCache = false;
    try {
      const cached = await getPoiItemsNear(c, NEAR_ME_RADIUS_M);
      const at = await getNewestFetchedAtNear(c, NEAR_ME_RADIUS_M);
      if (reqIdRef.current !== reqId) return;
      if (cached.length) {
        hadCache = true;
        setPack(makePack(cached, "cache"));
        setCachedAt(at);
        setState("ready");
      }
    } catch {
      // cache read failure is non-fatal; fall through to the live fetch
    }

    // 2. Online refresh. If offline or the backend is unavailable, keep cache.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
      if (!hadCache) {
        if (reqIdRef.current === reqId) {
          setPack(makePack([], "cache"));
          setState("ready");
        }
      }
      return;
    }

    if (!hadCache) setState("loading");
    try {
      const res = await placesApi.search({
        center: c,
        radius_m: NEAR_ME_RADIUS_M,
        limit: RESULT_LIMIT,
      });
      if (reqIdRef.current !== reqId) return;
      const items = res.items ?? [];
      setPack(makePack(items, "live"));
      setOffline(false);
      setCachedAt(Date.now());
      setState("ready");
      // Persist into the region cache for offline reuse (fire-and-forget).
      void upsertPoiResults(items, res.req?.categories ?? []).catch(() => {});
    } catch {
      // Backend down (the P0 GCP-billing outage 503s here) or a transient
      // network error: keep the cached results and flag the degraded state.
      if (reqIdRef.current !== reqId) return;
      setOffline(true);
      if (!hadCache) {
        setPack(makePack([], "cache"));
        setState("ready");
      }
    }
  }, []);

  // ── On mount: locate, then load near-me ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await getCurrentPosition();
        if (cancelled) return;
        const c = { lat: pos.lat, lng: pos.lng };
        setCenter(c);
        await loadForCenter(c, "Near you");
      } catch {
        // Geolocation denied / unavailable: fall back to the search box.
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadForCenter]);

  // ── Refresh the current center ──────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (!center || refreshing) return;
    haptic.selection();
    setRefreshing(true);
    await loadForCenter(center, label);
    setRefreshing(false);
  }, [center, label, refreshing, loadForCenter]);

  // ── Search a place/town to recenter (browse anywhere) ───────────────
  const onSubmitSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q || searching) return;
      haptic.selection();
      setSearching(true);
      const reqId = ++reqIdRef.current;
      try {
        const res = await placesApi.search({ query: q, limit: RESULT_LIMIT });
        if (reqIdRef.current !== reqId) return;
        const items = res.items ?? [];
        if (items.length) {
          const c = { lat: items[0].lat, lng: items[0].lng };
          setCenter(c);
          setLabel(q);
          setPack(makePack(items, "live"));
          setOffline(false);
          setCachedAt(Date.now());
          setState("ready");
          void upsertPoiResults(items, res.req?.categories ?? []).catch(() => {});
        } else {
          setPack(makePack([], "live"));
          setState("ready");
        }
      } catch {
        if (reqIdRef.current === reqId) setOffline(true);
      } finally {
        if (reqIdRef.current === reqId) setSearching(false);
      }
    },
    [query, searching],
  );

  const showSearchBox = state === "denied";
  const cachedWhen = fmtWhen(cachedAt);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--glovebox-bg, #fff)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(env(safe-area-inset-top, 0px) + 10px) 16px 8px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => { haptic.selection(); navigate("/trip"); }}
          aria-label="Back"
          style={iconBtnStyle}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--glovebox-text)", lineHeight: 1.1 }}>
            Places
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--glovebox-text-muted)",
              marginTop: 2,
            }}
          >
            <MapPin size={11} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </span>
            {offline && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--glovebox-danger, #c0392b)" }}>
                <WifiOff size={11} /> offline
              </span>
            )}
            {!offline && cachedWhen && <span>· {cachedWhen}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!center || refreshing}
          aria-label="Refresh places"
          style={{ ...iconBtnStyle, opacity: !center || refreshing ? 0.5 : 1 }}
        >
          {refreshing ? (
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <RefreshCw size={18} />
          )}
        </button>
      </div>

      {/* ── Offline / backend-down notice ───────────────────────── */}
      {offline && (
        <div
          style={{
            margin: "0 16px 8px",
            padding: "8px 12px",
            borderRadius: "var(--r-card)",
            background: "var(--glovebox-surface, #f4f4f4)",
            color: "var(--glovebox-text-muted)",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <WifiOff size={13} />
          {pack && pack.items.length > 0
            ? "Showing saved places for this area. Reconnect to refresh."
            : "No connection and no saved places for this area yet."}
        </div>
      )}

      {/* ── Locate-denied search fallback ───────────────────────── */}
      {showSearchBox && (
        <form onSubmit={onSubmitSearch} style={{ padding: "0 16px 8px", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--glovebox-surface-hover, #eee)",
              borderRadius: "var(--r-card)",
              padding: "10px 12px",
            }}
          >
            <Search size={16} style={{ color: "var(--glovebox-text-muted)", flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search a town or place…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--glovebox-text)",
              }}
              aria-label="Search a town or place"
            />
            {searching && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          </div>
          <div style={{ fontSize: 12, color: "var(--glovebox-text-muted)", marginTop: 6, fontWeight: 500 }}>
            Location is off, so we can't show what's near you. Search a place to browse it.
          </div>
        </form>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      {state === "locating" || state === "loading" ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "var(--glovebox-text-muted)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          {state === "locating" ? "Finding you…" : "Loading places…"}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <PlaceSearchPanel
            places={pack}
            userPosition={center ? { lat: center.lat, lng: center.lng } : undefined}
            onSelectPlace={(p) => openPlace(p)}
            maxHeight="100%"
          />
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  background: "var(--glovebox-surface, rgba(0,0,0,0.05))",
  color: "var(--glovebox-text)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
