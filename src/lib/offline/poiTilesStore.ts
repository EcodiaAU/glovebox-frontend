// src/lib/offline/poiTilesStore.ts
//
// Region-keyed offline POI cache. UNLIKE packsStore (which caches POIs inside a
// single trip's PlacesPack), this store is keyed by a coarse lat/lng grid TILE,
// independent of any trip. It is what lets the standalone /places view work
// offline for near-me and browse-anywhere: every /places/search result is split
// into the tiles its items geographically fall in and upserted there, so panning
// or re-opening later reads straight from the covering tiles with no reception.
//
// Cache policy (v1, deliberately simple): coarse tile key (rounded lat/lng grid)
// holding the items in that tile, the union of categories fetched for it, and a
// fetched-at timestamp. Offline-first: a query reads the covering tiles
// immediately; when online the caller refreshes from /places/search and upserts.
// No expiry (POI data is slow-moving); a "refresh" re-queries. The tile count is
// bounded (oldest evicted) so it cannot grow without limit.

import { idbGet, idbGetAll, idbPut, idbDel, idbStores } from "./idb";
import type { PlaceCategory, PlaceItem } from "@/lib/types/places";
import type { NavCoord, BBox4 } from "@/lib/types/geo";

// Coarse grid: 0.5 degrees of latitude is about 55 km, comfortably larger than a
// typical near-me radius, so a near-me query touches only a handful of tiles.
const GRID_DEG = 0.5;

// Keep at most this many tiles cached. At ~55 km per tile this is a very large
// footprint (roughly the whole east coast), far more than a single user browses,
// while still bounding IndexedDB growth.
const MAX_TILES = 400;

export type PoiTileRow = {
  /** Tile key: `${gx}:${gy}` where gx/gy are the floored grid indices. */
  k: string;
  gx: number;
  gy: number;
  /** South-west corner of the tile (for debugging / display). */
  tile_lat: number;
  tile_lng: number;
  items: PlaceItem[];
  /** Union of categories that have been fetched into this tile. */
  categories: PlaceCategory[];
  /** ms epoch of the most recent refresh that touched this tile. */
  fetched_at: number;
};

function gridIndex(deg: number): number {
  return Math.floor(deg / GRID_DEG);
}

function tileKeyFromIndices(gx: number, gy: number): string {
  return `${gx}:${gy}`;
}

/** Tile key for a single coordinate (gx = lng grid, gy = lat grid). */
export function tileKeyFor(lat: number, lng: number): string {
  return tileKeyFromIndices(gridIndex(lng), gridIndex(lat));
}

/** Approx km per degree of latitude (constant); used to derive a bbox from a radius. */
const KM_PER_DEG_LAT = 111;

function bboxFromCenter(center: NavCoord, radiusM: number): BBox4 {
  const radKm = radiusM / 1000;
  const dLat = radKm / KM_PER_DEG_LAT;
  const cosLat = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  const dLng = radKm / (KM_PER_DEG_LAT * cosLat);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Enumerate the tile indices whose cells intersect the bbox. */
function tilesForBbox(bbox: BBox4): { gx: number; gy: number }[] {
  const gxMin = gridIndex(bbox.minLng);
  const gxMax = gridIndex(bbox.maxLng);
  const gyMin = gridIndex(bbox.minLat);
  const gyMax = gridIndex(bbox.maxLat);
  const out: { gx: number; gy: number }[] = [];
  for (let gx = gxMin; gx <= gxMax; gx++) {
    for (let gy = gyMin; gy <= gyMax; gy++) {
      out.push({ gx, gy });
    }
  }
  return out;
}

function mergeItems(existing: PlaceItem[], incoming: PlaceItem[]): PlaceItem[] {
  const byId = new Map<string, PlaceItem>();
  for (const it of existing) byId.set(it.id, it);
  // Incoming wins on conflict: it is the fresher payload.
  for (const it of incoming) byId.set(it.id, it);
  return Array.from(byId.values());
}

function mergeCategories(a: PlaceCategory[], b: PlaceCategory[]): PlaceCategory[] {
  return Array.from(new Set([...a, ...b]));
}

/**
 * Upsert a batch of POIs (typically one /places/search response) into the tile
 * cache. Items are split into the tiles they geographically fall in; each tile
 * merges the new items (dedup by id), unions the fetched categories, and stamps
 * fetched_at. Then the cache is pruned to MAX_TILES newest.
 */
export async function upsertPoiResults(
  items: PlaceItem[],
  categories: PlaceCategory[],
): Promise<void> {
  if (!items.length) return;

  // Group incoming items by their own tile.
  const groups = new Map<string, { gx: number; gy: number; items: PlaceItem[] }>();
  for (const it of items) {
    if (typeof it.lat !== "number" || typeof it.lng !== "number") continue;
    const gx = gridIndex(it.lng);
    const gy = gridIndex(it.lat);
    const key = tileKeyFromIndices(gx, gy);
    let g = groups.get(key);
    if (!g) {
      g = { gx, gy, items: [] };
      groups.set(key, g);
    }
    g.items.push(it);
  }

  const now = Date.now();
  for (const [key, g] of groups) {
    const prev = await idbGet<PoiTileRow>(idbStores.poiTiles, key);
    const row: PoiTileRow = {
      k: key,
      gx: g.gx,
      gy: g.gy,
      tile_lat: g.gy * GRID_DEG,
      tile_lng: g.gx * GRID_DEG,
      items: prev ? mergeItems(prev.items, g.items) : g.items,
      categories: mergeCategories(prev?.categories ?? [], categories),
      fetched_at: now,
    };
    await idbPut(idbStores.poiTiles, row);
  }

  await pruneTiles();
}

/** Read all cached items whose tiles intersect a bbox, merged + deduped. */
export async function getPoiItemsInBbox(bbox: BBox4): Promise<PlaceItem[]> {
  const wanted = tilesForBbox(bbox);
  const byId = new Map<string, PlaceItem>();
  for (const { gx, gy } of wanted) {
    const row = await idbGet<PoiTileRow>(idbStores.poiTiles, tileKeyFromIndices(gx, gy));
    if (!row) continue;
    for (const it of row.items) byId.set(it.id, it);
  }
  return Array.from(byId.values());
}

/** Read all cached items within radius of a center (offline-first near-me read). */
export async function getPoiItemsNear(center: NavCoord, radiusM: number): Promise<PlaceItem[]> {
  return getPoiItemsInBbox(bboxFromCenter(center, radiusM));
}

/** Newest fetched_at across the covering tiles, or null if none cached. */
export async function getNewestFetchedAtNear(
  center: NavCoord,
  radiusM: number,
): Promise<number | null> {
  const wanted = tilesForBbox(bboxFromCenter(center, radiusM));
  let newest: number | null = null;
  for (const { gx, gy } of wanted) {
    const row = await idbGet<PoiTileRow>(idbStores.poiTiles, tileKeyFromIndices(gx, gy));
    if (row && (newest === null || row.fetched_at > newest)) newest = row.fetched_at;
  }
  return newest;
}

/** Evict oldest tiles beyond MAX_TILES (by fetched_at ascending). */
export async function pruneTiles(): Promise<void> {
  const rows = await idbGetAll<PoiTileRow>(idbStores.poiTiles);
  if (rows.length <= MAX_TILES) return;
  rows.sort((a, b) => a.fetched_at - b.fetched_at); // oldest first
  const toEvict = rows.slice(0, rows.length - MAX_TILES);
  await Promise.all(toEvict.map((r) => idbDel(idbStores.poiTiles, r.k)));
}

/** Total cached tile count (diagnostics). */
export async function poiTileCount(): Promise<number> {
  const rows = await idbGetAll<PoiTileRow>(idbStores.poiTiles);
  return rows.length;
}
