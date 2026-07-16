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
// POI (e.g. a Locals merchant) and always offers "Open in Glovebox".
//
// That button emits the canonical UNIVERSAL LINK, built by @ecodia/glovebox-link:
//
//     https://glovebox.ecodia.au/live?toLat=..&toLng=..&toName=..
//
// On a device with Glovebox installed, iOS hands that straight to the native app
// (the AASA at /.well-known/apple-app-site-association claims /live), and the app
// builds a real trip from the traveller's location, makes it the ACTIVE plan, and
// by doing so puts it on the CarPlay head unit. On a device without Glovebox, the
// very same URL opens this web app at /live. One URL, both audiences.
//
// This comment used to claim the button "deep links the full app with the trip
// preloaded". That was false: the app carried no associated-domains entitlement
// and the AASA claimed only /auth/callback, so the link was a plain web
// navigation that always landed in Safari. It is true as of the handoff build.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gloveboxDirectionsURL, GLOVEBOX_ORIGIN } from "@ecodia/glovebox-link";
import { TripMap } from "@/components/trip/TripMap";
import { placesApi } from "@/lib/api/places";
import { navApi } from "@/lib/api/nav";
import type { PlaceItem } from "@/lib/types/places";
import type { BBox4 } from "@/lib/types/geo";
import type { NavPack } from "@/lib/types/navigation";
import type { GloveboxPosition } from "@/lib/native/geolocation";

const CATEGORY_CHIPS = ["", "cafe", "food", "fuel", "camp", "lookout", "toilets", "shop"];
// Brand accent = the design-system named token (--brand-ochre, theme-aware).
// The canonical brand-ground literal is the fallback so this public, iframed
// surface never renders an unthemed (empty-var) button in the first frame
// before ThemeProvider stamps data-theme onto <html>.
const GB_ACCENT = "var(--brand-ochre, #A8431F)";

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// The "Open in Glovebox" href. Built by the canonical contract package rather
// than by hand, so this button and every other sender in the fleet (locals-web,
// locals-ios, and whatever adopts it next) emit a byte-identical URL.
//
// It MUST be absolute. It used to return a relative `/live?...`, and a relative
// href can never be resolved as a universal link: iOS matches an https URL
// against the AASA's domain, so a same-origin relative navigation just stays in
// the browser. Absolute is what makes this open the app.
function openInGloveboxUrl(args: {
  toLat: number;
  toLng: number;
  toName: string;
  fromLat?: number;
  fromLng?: number;
}): string {
  return gloveboxDirectionsURL(args);
}

// MAP mode's button is NOT a handoff: it carries no destination, so there is no
// trip to hand over, only a place to look at. It stays a plain web link, and the
// AASA deliberately claims /live only when toLat + toLng are present, so this URL
// opens the web app rather than being swallowed by the native one.
function openMapInGloveboxUrl(args: { lat: number; lng: number }): string {
  const u = new URLSearchParams({ lat: String(args.lat), lng: String(args.lng) });
  return `${GLOVEBOX_ORIGIN}/live?${u.toString()}`;
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
        background: GB_ACCENT,
        color: "#fff",
        font: "600 13px var(--ff-body)",
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
        font: "500 13px var(--ff-body)",
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
            style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: "0 2px 10px rgba(0,0,0,0.10)", font: "500 14px var(--ff-body)", outline: "none" }}
          />
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 999, border: "none", background: GB_ACCENT, color: "#fff", font: "600 14px var(--ff-body)", boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}>
            Search
          </button>
        </form>
        <div style={{ pointerEvents: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORY_CHIPS.map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => { setQuery(c); void runSearch(c); }}
              style={{ padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.10)", background: query === c ? GB_ACCENT : "rgba(255,255,255,0.92)", color: query === c ? "#fff" : "#333", font: "500 12px var(--ff-body)", cursor: "pointer" }}
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
            <div style={{ font: "400 11px var(--ff-body)", color: "#6b6b5e", marginTop: 2 }}>
              {status === "loading" ? "Loading places…" : status === "error" ? "Places unavailable right now" : `${places.length} place${places.length === 1 ? "" : "s"} · Glovebox`}
            </div>
          </div>
          <OpenInGlovebox href={openMapInGloveboxUrl({ lat, lng })} />
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
    // Pre-route view sits tight on the destination (~3km each way) so the
    // embed only pulls a small tile set on open instead of a ~55km-wide area
    // it would immediately throw away when the route arrives and refits. Cuts
    // initial tile load ~40x (area scales with the square) and shrinks the
    // camera move once OSRM returns.
    const d = 0.03;
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
            <div style={{ font: "400 11px var(--ff-body)", color: "#6b6b5e" }}>Directions to</div>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toName}</div>
            <div style={{ font: "400 12px var(--ff-body)", color: "#6b6b5e", marginTop: 2 }}>
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
                style={{ padding: "9px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#2c2c22", font: "600 13px var(--ff-body)", cursor: "pointer" }}
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
