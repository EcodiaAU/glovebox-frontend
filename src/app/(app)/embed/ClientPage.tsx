// src/app/(app)/embed/ClientPage.tsx
//
// PUBLIC, login-free, embeddable Glovebox surface (iframed by the Ecosphere
// connector / a business's own site). It is the REAL app: the actual TripMap,
// the glovebox basemap, live /places/search POIs, and keyless /nav/route.
//
// Two modes, both driven by URL params:
//   MAP        /embed?lat=-26.65&lng=153.09&zoom=11&q=cafe&title=Sunshine%20Coast
//   DIRECTIONS /embed?mode=directions&toLat=-26.53&toLng=153.09&toName=Coolum%20Surf%20Club
//
// Directions mode routes from the visitor's browser location to the destination
// POI (e.g. a Locals merchant) and always offers "Open in Glovebox", which deep
// links the full app with the trip preloaded (/live?toLat&toLng&toName).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TripMap } from "@/components/trip/TripMap";
import { placesApi } from "@/lib/api/places";
import { navApi } from "@/lib/api/nav";
import type { PlaceItem } from "@/lib/types/places";
import type { BBox4 } from "@/lib/types/geo";
import type { NavPack } from "@/lib/types/navigation";
import type { GloveboxPosition } from "@/lib/native/geolocation";

const CATEGORY_CHIPS = ["", "cafe", "food", "fuel", "camp", "lookout", "toilets", "shop"];
const GB_ORANGE = "#b3541e";

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function openInGloveboxUrl(params: Record<string, string | number>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) u.set(k, String(v));
  return `/live?${u.toString()}`;
}

export default function EmbedClientPage() {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const mode = params.get("mode") === "directions" ? "directions" : "map";

  if (mode === "directions") return <DirectionsEmbed params={params} />;
  return <MapEmbed params={params} />;
}

/* ───────────────────────────── shared bits ──────────────────────────────── */

function OpenInGlovebox({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        borderRadius: 999,
        background: GB_ORANGE,
        color: "#fff",
        font: "600 13px system-ui",
        textDecoration: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
      }}
    >
      Open in Glovebox
    </a>
  );
}

function Panel({ children, side = "bottom-left" }: { children: React.ReactNode; side?: "bottom-left" | "bottom" }) {
  const pos: React.CSSProperties =
    side === "bottom"
      ? { left: 12, right: 12, bottom: 12, margin: "0 auto", maxWidth: 520 }
      : { left: 12, bottom: 12, maxWidth: 320 };
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 500,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(4px)",
        padding: "10px 14px",
        borderRadius: 12,
        boxShadow: "0 2px 14px rgba(0,0,0,0.14)",
        font: "500 13px system-ui",
        color: "#2c2c22",
        ...pos,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────── MAP mode ───────────────────────────────── */

function MapEmbed({ params }: { params: URLSearchParams }) {
  const lat = num(params.get("lat"), -26.65);
  const lng = num(params.get("lng"), 153.09);
  const title = params.get("title") ?? "Nearby places";
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const bbox: BBox4 = useMemo(() => {
    const d = 0.3;
    return { minLng: lng - d, minLat: lat - d, maxLng: lng + d, maxLat: lat + d };
  }, [lat, lng]);

  const runSearch = useCallback(
    async (q: string) => {
      setStatus("loading");
      try {
        const pack = await placesApi.search({ center: { lat, lng }, radius_m: 30_000, query: q || null, limit: 60 });
        setPlaces(pack.items ?? []);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [lat, lng],
  );

  useEffect(() => {
    void runSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <TripMap styleId="glovebox-basemap-vector-bright" stops={[]} geometry="" bbox={bbox} suggestions={places} isOnline />

      <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 500, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); void runSearch(query); }}
          style={{ pointerEvents: "auto", display: "flex", gap: 8, maxWidth: 460 }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this area"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: "0 2px 10px rgba(0,0,0,0.10)", font: "500 14px system-ui", outline: "none" }}
          />
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 999, border: "none", background: GB_ORANGE, color: "#fff", font: "600 14px system-ui", boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}>
            Search
          </button>
        </form>
        <div style={{ pointerEvents: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORY_CHIPS.map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => { setQuery(c); void runSearch(c); }}
              style={{ padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.10)", background: query === c ? GB_ORANGE : "rgba(255,255,255,0.92)", color: query === c ? "#fff" : "#333", font: "500 12px system-ui", cursor: "pointer" }}
            >
              {c || "All"}
            </button>
          ))}
        </div>
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{title}</div>
            <div style={{ font: "400 11px system-ui", color: "#6b6b5e", marginTop: 2 }}>
              {status === "loading" ? "Loading places…" : status === "error" ? "Places unavailable right now" : `${places.length} place${places.length === 1 ? "" : "s"} · Glovebox`}
            </div>
          </div>
          <OpenInGlovebox href={openInGloveboxUrl({ lat, lng })} />
        </div>
      </Panel>
    </div>
  );
}

/* ──────────────────────────── DIRECTIONS mode ───────────────────────────── */

function DirectionsEmbed({ params }: { params: URLSearchParams }) {
  const toLat = num(params.get("toLat"), -26.5314);
  const toLng = num(params.get("toLng"), 153.0924);
  const toName = params.get("toName") ?? "Destination";

  const [me, setMe] = useState<GloveboxPosition | null>(null);
  const [navpack, setNavpack] = useState<NavPack | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "routing" | "ready" | "denied" | "error">("idle");
  const askedRef = useRef(false);

  const getDirections = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe({ lat: from.lat, lng: from.lng, accuracy: pos.coords.accuracy, altitude: null, altitudeAccuracy: null, heading: pos.coords.heading ?? null, speed: pos.coords.speed ?? null, timestamp: Date.now() });
        setStatus("routing");
        try {
          const pack = await navApi.route({
            profile: "drive",
            stops: [
              { type: "start", name: "My location", lat: from.lat, lng: from.lng },
              { type: "end", name: toName, lat: toLat, lng: toLng },
            ],
          });
          setNavpack(pack);
          setStatus("ready");
        } catch {
          setStatus("error");
        }
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, [toLat, toLng, toName]);

  // Auto-ask once on load.
  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    getDirections();
  }, [getDirections]);

  const bbox: BBox4 = useMemo(() => {
    if (navpack?.primary?.bbox) return navpack.primary.bbox;
    const d = 0.25;
    return { minLng: toLng - d, minLat: toLat - d, maxLng: toLng + d, maxLat: toLat + d };
  }, [navpack, toLat, toLng]);

  const stops = useMemo(
    () => (me ? [{ type: "start" as const, name: "My location", lat: me.lat, lng: me.lng }, { type: "end" as const, name: toName, lat: toLat, lng: toLng }] : [{ type: "end" as const, name: toName, lat: toLat, lng: toLng }]),
    [me, toLat, toLng, toName],
  );

  const distanceKm = navpack ? Math.round(navpack.primary.distance_m / 100) / 10 : null;
  const minutes = navpack ? Math.round(navpack.primary.duration_s / 60) : null;
  const deepLink = openInGloveboxUrl({ toLat, toLng, toName, ...(me ? { fromLat: me.lat, fromLng: me.lng } : {}) });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <TripMap
        styleId="glovebox-basemap-vector-bright"
        stops={stops}
        geometry={navpack?.primary?.geometry ?? ""}
        bbox={bbox}
        userPosition={me}
        isOnline
        hideLayerToggle
      />

      <Panel side="bottom">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ font: "400 11px system-ui", color: "#6b6b5e" }}>Directions to</div>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toName}</div>
            <div style={{ font: "400 12px system-ui", color: "#6b6b5e", marginTop: 2 }}>
              {status === "ready" && distanceKm !== null
                ? `${distanceKm} km · ${minutes} min drive · Glovebox`
                : status === "locating"
                  ? "Finding your location…"
                  : status === "routing"
                    ? "Routing…"
                    : status === "denied"
                      ? "Allow location, or open in Glovebox"
                      : status === "error"
                        ? "Could not route. Open in Glovebox."
                        : "Get directions from your location"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status !== "ready" ? (
              <button
                type="button"
                onClick={getDirections}
                style={{ padding: "9px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#2c2c22", font: "600 13px system-ui", cursor: "pointer" }}
              >
                Get directions
              </button>
            ) : null}
            <OpenInGlovebox href={deepLink} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
