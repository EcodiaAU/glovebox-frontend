// src/app/(app)/embed/ClientPage.tsx
//
// PUBLIC, login-free, chrome-light embed of the REAL Glovebox map for iframing
// on another site (the Ecosphere connector). It renders the actual `TripMap`
// component - the same MapLibre basemap (glovebox-basemap-vector-bright), the
// same `/places/search` data - with no trip, no nav HUD, no tabs. Driven by URL
// params so a business can frame their own area:
//   /embed?lat=-26.65&lng=153.09&zoom=11&q=cafe&title=Sunshine%20Coast
//
// Online-only (no offline bundle, like /live). No auth: the map + POIs are public.

import { useCallback, useEffect, useMemo, useState } from "react";
import { TripMap } from "@/components/trip/TripMap";
import { placesApi } from "@/lib/api/places";
import type { PlaceItem } from "@/lib/types/places";
import type { BBox4 } from "@/lib/types/geo";

const CATEGORY_CHIPS = ["", "cafe", "food", "fuel", "camp", "lookout", "toilets", "shop"];

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function EmbedClientPage() {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const lat = num(params.get("lat"), -26.65);
  const lng = num(params.get("lng"), 153.09);
  const title = params.get("title") ?? "Nearby places";
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // A ~30km box around the centre keeps the framing local + gives TripMap a bbox.
  const bbox: BBox4 = useMemo(() => {
    const d = 0.3;
    return { minLng: lng - d, minLat: lat - d, maxLng: lng + d, maxLat: lat + d };
  }, [lat, lng]);

  const runSearch = useCallback(
    async (q: string) => {
      setStatus("loading");
      try {
        const pack = await placesApi.search({
          center: { lat, lng },
          radius_m: 30_000,
          query: q || null,
          limit: 60,
        });
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
      <TripMap
        styleId="glovebox-basemap-vector-bright"
        stops={[]}
        geometry=""
        bbox={bbox}
        suggestions={places}
        isOnline
      />

      {/* Search + category chips */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          zIndex: 500,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
          style={{ pointerEvents: "auto", display: "flex", gap: 8, maxWidth: 460 }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this area"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
              font: "500 14px system-ui",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: "#b3541e",
              color: "#fff",
              font: "600 14px system-ui",
              boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
            }}
          >
            Search
          </button>
        </form>
        <div style={{ pointerEvents: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORY_CHIPS.map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => {
                setQuery(c);
                void runSearch(c);
              }}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.10)",
                background: query === c ? "#b3541e" : "rgba(255,255,255,0.92)",
                color: query === c ? "#fff" : "#333",
                font: "500 12px system-ui",
                cursor: "pointer",
              }}
            >
              {c || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Title / count chip */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 500,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(4px)",
          padding: "8px 12px",
          borderRadius: 10,
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          font: "500 13px system-ui",
          color: "#2c2c22",
          maxWidth: 280,
        }}
      >
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ font: "400 11px system-ui", color: "#6b6b5e", marginTop: 2 }}>
          {status === "loading"
            ? "Loading places…"
            : status === "error"
              ? "Places unavailable right now"
              : `${places.length} place${places.length === 1 ? "" : "s"} · Glovebox`}
        </div>
      </div>
    </div>
  );
}
