// src/app/sos/ClientPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Capacitor } from "@capacitor/core";
import { haptic } from "@/lib/native/haptics";
import { toErrorMessage } from "@/lib/utils/errors";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useAuth } from "@/lib/supabase/auth";
import { listEmergencyContacts } from "@/lib/offline/emergencyStore";
import { emergencySyncOnce } from "@/lib/offline/emergencySync";
import { saveEmergencyContactLocalFirst, deleteEmergencyContactLocalFirst } from "@/lib/emergency/emergencyActions";

import type { EmergencyContactLocal } from "@/lib/types/emergency";
import { PhoneCall, MessageSquareText, Plus, Pencil, Trash2, Satellite, RefreshCw } from "lucide-react";
import { Icon, NetworkPill, PrimaryBtn, GhostBtn } from "@/components/glovebox-ui-v2/shared";

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `em_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function telHref(phone: string) {
  const trimmed = (phone ?? "").trim();
  const normalized = trimmed.replace(/[^\d+]/g, "");
  return `tel:${normalized}`;
}

function smsHref(phones: string[], body: string) {
  const normalizedPhones = (phones ?? [])
    .map((p) => (p ?? "").trim().replace(/[^\d+]/g, ""))
    .filter(Boolean);

  const to = normalizedPhones.join(",");
  return `sms:${to}?body=${encodeURIComponent(body ?? "")}`;
}

function fmt5(x: number) {
  return (Math.round(x * 1e5) / 1e5).toFixed(5);
}

function mapsLink(lat: number, lon: number) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lon}`)}`;
}

type GeoResult = { lat: number; lon: number; accuracy_m: number | null };

function isLocationGranted(perms: { location: string; coarseLocation: string }) {
  return perms.location === "granted" || perms.coarseLocation === "granted";
}

async function getPositionNative(timeoutMs = 120_000): Promise<GeoResult> {
  // 1. Try Native Capacitor Geolocation first
  try {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Mobile OS requires explicit permission checks before getting location
      let perms = await Geolocation.checkPermissions();
      if (!isLocationGranted(perms)) {
        perms = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      }
      if (!isLocationGranted(perms)) {
        throw new Error("Location permission denied. Please allow it in Settings → Glovebox → Location.");
      }

      return await new Promise<GeoResult>((resolve, reject) => {
        let settled = false;
        let watchId: string | null = null;

        const stop = () => {
          if (watchId != null) Geolocation.clearWatch({ id: watchId }).catch(() => {});
        };

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          stop();
          reject(new Error("Location timeout - move to open sky and retry."));
        }, timeoutMs);

        Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
          (pos, err) => {
            if (settled) return;

            if (err) {
              settled = true;
              clearTimeout(timer);
              stop();
              reject(new Error(err?.message || "Location error."));
              return;
            }

            if (pos) {
              settled = true;
              clearTimeout(timer);
              stop();
              resolve({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy_m: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
              });
            }
          }
        ).then((id) => {
          watchId = id;
          if (settled) stop();
        }).catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error("Failed to start location watch."));
          }
        });
      });
    }
  } catch (e: unknown) {
    // Bubble up explicit permission errors so the user knows they blocked it
    if (e instanceof Error && e.message?.includes("permission")) {
      throw e;
    }
    // Otherwise fall through to browser API
  }

  // 2. Fallback: Browser navigator.geolocation
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation not available on this device.");
  }

  return new Promise<GeoResult>((resolve, reject) => {
    let watchId: number | null = null;
    let settled = false;

    const stop = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stop();
      reject(new Error("Location timeout - move to open sky and retry."));
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stop();
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
        });
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stop();
        reject(new Error(e?.message || "Could not get location."));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );
  });
}

export default function EmergencyClientPage() {
  const { online: isOnline } = useNetworkStatus();
  const { user } = useAuth();

  const [items, setItems] = useState<EmergencyContactLocal[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState<null | "boot" | "save" | "delete" | "sync">(null);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gpsSecondsLeft, setGpsSecondsLeft] = useState(0);
  const [elapsedWait, setElapsedWait] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => items.find((x) => x.id === editingId) ?? null, [items, editingId]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  const didBootRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const locInFlightRef = useRef(false);

  const isLocating = locating && (lat == null || lon == null);

  useEffect(() => {
    if (!isLocating) {
      setElapsedWait(0);
      setGpsSecondsLeft(0);
      return;
    }

    const totalSecs = 120;
    setGpsSecondsLeft(totalSecs);
    setElapsedWait(0);

    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 1;
      setElapsedWait(elapsed);
      setGpsSecondsLeft(Math.max(0, totalSecs - elapsed));
    }, 1000);

    return () => clearInterval(id);
  }, [isLocating]);

  const refresh = useCallback(async () => {
    const next = await listEmergencyContacts();
    setItems(next);

    setSelectedIds((prev) => {
      const hasAnyPrev = Object.keys(prev || {}).length > 0;
      if (hasAnyPrev) {
        const still: Record<string, boolean> = {};
        for (const c of next) if (prev[c.id]) still[c.id] = true;
        return still;
      }
      const all: Record<string, boolean> = {};
      for (const c of next) all[c.id] = true;
      return all;
    });
  }, []);

  const runAutoSync = useCallback(async () => {
    if (!user || !isOnline) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setBusy((b) => (b ? b : "sync"));
    try {
      await emergencySyncOnce(user);
      await refresh();
    } catch (e: unknown) {
      setErr(toErrorMessage(e));
    } finally {
      syncInFlightRef.current = false;
      setBusy((b) => (b === "sync" ? null : b));
    }
  }, [user, isOnline, refresh]);

  const fetchLocationAuto = useCallback(async (force = false) => {
    // force=true allows the retry button to bypass the in-flight guard
    if (locInFlightRef.current && !force) return;
    locInFlightRef.current = true;
    setLocating(true);
    setErr(null);
    try {
      const p = await getPositionNative(120_000);
      setLat(p.lat);
      setLon(p.lon);
      setAccuracyM(p.accuracy_m);
    } catch (e: unknown) {
      setErr(toErrorMessage(e));
    } finally {
      locInFlightRef.current = false;
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (didBootRef.current) return;
      didBootRef.current = true;

      setBusy("boot");
      setErr(null);
      try {
        await refresh();
        if (cancelled) return;
        await runAutoSync();
      } catch (e: unknown) {
        setErr(toErrorMessage(e));
      } finally {
        if (!cancelled) setBusy(null);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [refresh, runAutoSync]);

  useEffect(() => {
    runAutoSync();
  }, [runAutoSync]);

  useEffect(() => {
    if (!user || !isOnline) return;
    const t = setInterval(() => runAutoSync(), 30_000);
    return () => clearInterval(t);
  }, [user, isOnline, runAutoSync]);

  useEffect(() => {
    fetchLocationAuto();
  }, [fetchLocationAuto]);

  useEffect(() => {
    const t = setInterval(() => {
      fetchLocationAuto();
    }, 20_000);
    return () => clearInterval(t);
  }, [fetchLocationAuto]);

  useEffect(() => {
    if (!editing) {
      setName("");
      setPhone("");
      setRelationship("");
      setNotes("");
      return;
    }
    setName(editing.name ?? "");
    setPhone(editing.phone ?? "");
    setRelationship(editing.relationship ?? "");
    setNotes(editing.notes ?? "");
  }, [editingId, editing]);

  const callEmergency = useCallback(() => {
    if (!confirm("Call 000 now?")) return;
    haptic.heavy();
    window.location.href = "tel:000";
  }, []);

  const toggleSelected = useCallback((id: string) => {
    haptic.selection();
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectedContacts = useMemo(() => {
    const map = selectedIds ?? {};
    return items.filter((c) => !!map[c.id]);
  }, [items, selectedIds]);

  const sendLocationToSelected = useCallback(async () => {
    if (selectedContacts.length === 0) {
      setErr("Select at least one contact.");
      haptic.error();
      return;
    }

    let useLat = lat;
    let useLon = lon;
    let acc = accuracyM;

    if (useLat == null || useLon == null) {
      setErr(null);
      setLocating(true);
      try {
        haptic.medium();
        const p = await getPositionNative(120_000);
        useLat = p.lat;
        useLon = p.lon;
        acc = p.accuracy_m;
        setLat(useLat);
        setLon(useLon);
        setAccuracyM(acc);
      } catch (e: unknown) {
        haptic.error();
        setErr(toErrorMessage(e));
        setLocating(false);
        return;
      }
      setLocating(false);
    }

    const coords = `${fmt5(useLat!)}, ${fmt5(useLon!)}${acc ? ` (±${Math.round(acc)}m)` : ""}`;
    const link = mapsLink(useLat!, useLon!);
    const time = new Date().toLocaleString();

    const msg =
      `GLOVEBOX SAFETY: I need help.\n` +
      `Your coordinates are: ${coords}\n` +
      `Map: ${link}\n` +
      `Time: ${time}`;

    haptic.heavy();
    window.location.href = smsHref(selectedContacts.map((c) => c.phone), msg);
  }, [selectedContacts, lat, lon, accuracyM]);

  const startNew = useCallback(() => {
    haptic.selection();
    setErr(null);
    setEditingId("__new__");
    setName("");
    setPhone("");
    setRelationship("");
    setNotes("");
  }, []);

  const cancelEdit = useCallback(() => {
    haptic.selection();
    setErr(null);
    setEditingId(null);
  }, []);

  const save = useCallback(async () => {
    setErr(null);
    haptic.medium();

    const id = editingId && editingId !== "__new__" ? editingId : randomId();
    const now = nowIso();
    const contact: EmergencyContactLocal = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || null,
      notes: notes.trim() || null,
      updated_at: now,
      _local_updated_at: now,
    };

    // Snapshot for rollback
    const prevItems = items;

    // Optimistic: update list and close editor immediately
    setItems((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = contact;
        return next;
      }
      return [...prev, contact];
    });
    setEditingId(null);
    haptic.success();

    // Persist in background - revert on failure
    try {
      await saveEmergencyContactLocalFirst({ user, isOnline, contact });
      runAutoSync();
    } catch (e: unknown) {
      // Revert
      setItems(prevItems);
      haptic.error();
      setErr(toErrorMessage(e));
    }
  }, [editingId, name, phone, relationship, notes, user, isOnline, items, runAutoSync]);

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("Delete this contact?")) return;
      setErr(null);
      haptic.heavy();

      // Snapshot for rollback
      const prevItems = items;

      // Optimistic: remove from list immediately
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
      haptic.success();

      // Persist in background - revert on failure
      try {
        await deleteEmergencyContactLocalFirst({ user, isOnline, id });
        runAutoSync();
      } catch (e: unknown) {
        // Revert
        setItems(prevItems);
        haptic.error();
        setErr(toErrorMessage(e));
      }
    },
    [user, isOnline, items, editingId, runAutoSync],
  );

  const selectedCount = selectedContacts.length;

  let waitMessage = "Acquiring GPS lock...";
  if (elapsedWait > 5) waitMessage = "Searching satellites. Ensure a clear view of the sky...";
  if (elapsedWait > 15) waitMessage = "Offline GPS cold lock (can take up to 2 mins)...";

  return (
    <div className="page sos-page" style={{ background: "var(--c-bg)", position: "relative", height: "100%" }}>
      {/* Inner scroll inherits the .sos-page padding from globals.css
          (safe-area-top + 8px). The previous duplicate top padding here
          stacked on top of that and pushed the first card well down. */}
      <div className="scroll-y sos-scroll" style={{ flex: 1, padding: "0 0 110px", height: "100%" }}>
        {err ? (
          <div style={{
            background: "var(--c-error-bg)", color: "var(--c-error-text)",
            padding: "10px 12px", borderRadius: 12, marginBottom: 12, fontSize: 13,
          }}>{err}</div>
        ) : null}

        {/* HEADER */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
        }}>
          <div>
            <div className="t-mono" style={{
              fontSize: 11, color: "var(--c-danger)", fontWeight: 700,
              letterSpacing: 1, textTransform: "uppercase",
            }}>SOS</div>
            <div style={{
              fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
              fontStyle: "italic",
              fontWeight: 400, fontSize: 26, letterSpacing: "-0.005em", lineHeight: 1.15,
              color: "var(--c-text)",
            }}>Help and location.</div>
          </div>
          <NetworkPill state={isOnline ? "online" : "offline"} compact />
        </div>

        {/* LOCATION CARD (real coords, no fake map) */}
        <div style={{
          borderRadius: 18, overflow: "hidden",
          border: "1px solid var(--c-border)",
          background: "var(--c-surface)",
          boxShadow: "var(--sh-card)",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: 999,
                background: lat != null && lon != null ? "rgba(77,184,240,0.18)" : "rgba(0,0,0,0.04)",
                animation: lat != null && lon != null ? "ping-ring 2s ease-out infinite" : "none",
              }}/>
              <div style={{
                position: "absolute", inset: 12, borderRadius: 999,
                background: lat != null && lon != null ? "var(--c-info)" : "var(--c-text-muted)",
                border: "3px solid var(--c-surface)",
              }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-mono" style={{
                fontSize: 10, color: "var(--c-text-muted)",
                textTransform: "uppercase", letterSpacing: 0.5,
              }}>Current location</div>
              <div className="t-mono" style={{
                fontSize: 16, fontWeight: 700, color: "var(--c-text)",
                marginTop: 2, letterSpacing: -0.2, lineHeight: 1.2,
                wordBreak: "break-word",
              }}>
                {lat != null && lon != null ? `${fmt5(lat)}, ${fmt5(lon)}` : (isLocating ? "Locating..." : "Location unavailable")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                {accuracyM != null && (
                  <span className="t-mono" style={{ fontSize: 12, color: "var(--c-success)", fontWeight: 600 }}>
                    ± {Math.round(accuracyM)} m
                  </span>
                )}
                {isLocating && (
                  <span className="t-mono" style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                    {String(Math.floor(gpsSecondsLeft / 60)).padStart(2, "0")}:{String(gpsSecondsLeft % 60).padStart(2, "0")}
                  </span>
                )}
                {!isLocating && lat != null && lon != null && (
                  <span className="t-mono" style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                    Updated just now
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <PrimaryBtn
              style={{ flex: 1 }}
              onClick={() => { haptic.medium(); fetchLocationAuto(true); }}
            >
              <Icon name="target" size={16} stroke={2.2}/> Update location
            </PrimaryBtn>
            {lat != null && lon != null && (
              <GhostBtn onClick={() => window.open(mapsLink(lat, lon), "_blank")}>
                <Icon name="map" size={16}/> Maps
              </GhostBtn>
            )}
          </div>

          {isLocating && (
            <div className="t-mono" style={{
              marginTop: 10, padding: "8px 10px", borderRadius: 10,
              background: "var(--c-surface-muted)",
              fontSize: 11, color: "var(--c-text-muted)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Icon name="sync" size={12} stroke={2} style={{ animation: "spin-360 1.4s linear infinite" }}/>
              {waitMessage}
            </div>
          )}
        </div>

        {/* 000 + MESSAGE-CONTACTS row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginTop: 16 }}>
          <button onClick={callEmergency} style={{
            minHeight: 88, borderRadius: 18,
            background: "var(--c-danger)", color: "white",
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px",
            boxShadow: "var(--sh-card)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.18,
              background: "radial-gradient(circle at 80% 20%, white, transparent 60%)",
            }}/>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <Icon name="sos" size={28} stroke={2.4}/>
            </div>
            <div style={{ textAlign: "left", position: "relative", minWidth: 0, flex: 1 }}>
              <div className="t-display" style={{
                fontWeight: 700, fontSize: 32, lineHeight: 1, letterSpacing: -0.5,
              }}>000</div>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4, lineHeight: 1.25, wordBreak: "break-word" }}>
                Police &middot; Fire &middot; Ambulance
              </div>
            </div>
          </button>

          <button
            onClick={sendLocationToSelected}
            disabled={items.length === 0}
            style={{
              minHeight: 88, borderRadius: 18,
              background: items.length === 0 ? "var(--c-surface-muted)" : "var(--c-surface)",
              color: items.length === 0 ? "var(--c-text-muted)" : "var(--c-text)",
              border: "1px solid var(--c-border)",
              display: "flex", flexDirection: "column",
              alignItems: "flex-start", justifyContent: "center",
              padding: "12px 14px", gap: 4, boxShadow: "var(--sh-card)",
              opacity: items.length === 0 ? 0.6 : 1,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--c-info-tint)", color: "var(--c-info)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="msg" size={18} stroke={2.4}/>
            </div>
            <div className="t-display" style={{
              fontWeight: 700, fontSize: 16, letterSpacing: -0.2, marginTop: 4,
            }}>
              {selectedCount > 0 ? `Msg ${selectedCount}` : "Msg"}
            </div>
            <div className="t-mono" style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
              {items.length === 0 ? "add a contact" : "send location"}
            </div>
          </button>
        </div>

        {/* SPEED DIAL HEADING + ADD */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 22, marginBottom: 10,
        }}>
          <div style={{
            fontFamily: '"Spectral", "Iowan Old Style", Garamond, serif',
            fontStyle: "italic",
            fontWeight: 400, fontSize: 20, color: "var(--c-text)",
          }}>Speed dial.</div>
          <button onClick={startNew} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--c-accent)", fontSize: 13, fontWeight: 700,
            padding: "4px 8px",
          }}>
            <Icon name="plus" size={14} stroke={2.4}/> Add contact
          </button>
        </div>

        {/* INLINE EDITOR (real flow: __new__ + existing edit).
             Smooth expand/collapse via grid-template-rows 0fr -> 1fr trick -
             animates auto-height without measuring. The card content is
             always in the DOM (collapses to 0 height when closed) so the
             page above doesn't jolt back when the user taps Cancel/Save.
             (Tate 2026-05-28: "doesnt have a nice animation for the add
             contact card which is really jarring + when you click cancel
             or save on the contact card then it jolts back".) */}
        <div style={{
          display: "grid",
          gridTemplateRows: editingId ? "1fr" : "0fr",
          opacity: editingId ? 1 : 0,
          marginBottom: editingId ? 12 : 0,
          transition: "grid-template-rows 280ms cubic-bezier(0.32, 0, 0.34, 1), opacity 220ms ease, margin-bottom 280ms cubic-bezier(0.32, 0, 0.34, 1)",
        }}>
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div style={{
              padding: 12, borderRadius: 16,
              background: "var(--c-surface)", border: "1.5px solid var(--c-accent)",
              boxShadow: "var(--sh-card)",
            }}>
              <div style={{
                fontWeight: 700, fontSize: 15, marginBottom: 8,
                color: "var(--c-text)",
              }}>
                {editingId === "__new__" ? "Add contact" : "Edit contact"}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Mum)" style={sosInputStyle()}/>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (e.g. +61 412 …)" inputMode="tel" style={{ ...sosInputStyle(), fontFamily: "var(--font-mono)" }}/>
              <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Relationship (optional)" style={sosInputStyle()}/>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" style={{ ...sosInputStyle(), resize: "none", minHeight: 56 }}/>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={cancelEdit} style={{
                  flex: 1, height: 44, borderRadius: 10,
                  background: "var(--c-surface-muted)", color: "var(--c-text)",
                  fontWeight: 600, fontSize: 14,
                }}>Cancel</button>
                {editingId && editingId !== "__new__" && (
                  <button onClick={() => remove(editingId)} disabled={busy === "delete"} style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: "var(--c-error-bg)", color: "var(--c-error-text)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Icon name="trash" size={16}/></button>
                )}
                <button onClick={save} disabled={busy === "save" || !name.trim() || !phone.trim()} style={{
                  flex: 1, height: 44, borderRadius: 10,
                  background: "var(--c-accent)", color: "white",
                  fontWeight: 700, fontSize: 14,
                  opacity: !name.trim() || !phone.trim() ? 0.55 : 1,
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTACTS LIST */}
        {items.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "24px 0", fontSize: 13,
            color: "var(--c-text-muted)",
          }}>
            No contacts saved. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((c) => {
              const sel = !!selectedIds[c.id];
              return (
                <div key={c.id} style={{
                  padding: "10px 12px", borderRadius: 16,
                  background: "var(--c-surface)",
                  border: sel ? "1.5px solid var(--c-accent)" : "1px solid var(--c-border)",
                  boxShadow: "var(--sh-card)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <button
                    onClick={() => toggleSelected(c.id)}
                    aria-pressed={sel}
                    title={sel ? "Selected" : "Tap to select"}
                    style={{
                      width: 44, height: 44, borderRadius: 999,
                      background: sel ? "var(--c-accent)" : "var(--c-surface-muted)",
                      color: sel ? "white" : "var(--c-text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {sel ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10.5l4 4 8-8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <Icon name="user" size={20}/>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14, lineHeight: 1.2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{c.name}</div>
                    <div className="t-mono" style={{
                      fontSize: 11, color: "var(--c-text-muted)", lineHeight: 1.3,
                      overflow: "hidden", wordBreak: "break-word",
                    }}>
                      {c.phone}{c.relationship ? ` · ${c.relationship}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!confirm(`Call ${c.name} (${c.phone})?`)) return;
                      haptic.heavy();
                      window.location.href = telHref(c.phone);
                    }}
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "var(--c-success)", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  ><Icon name="phone" size={18} stroke={2.2}/></button>
                  <button
                    onClick={() => {
                      if (lat == null || lon == null) {
                        setErr("Location unavailable right now.");
                        haptic.error();
                        return;
                      }
                      const coords = `${fmt5(lat)}, ${fmt5(lon)}${accuracyM ? ` (±${Math.round(accuracyM)}m)` : ""}`;
                      const link = mapsLink(lat, lon);
                      const time = new Date().toLocaleString();
                      const msg =
                        `GLOVEBOX SAFETY: I need help.\n` +
                        `Your coordinates are: ${coords}\n` +
                        `Map: ${link}\n` +
                        `Time: ${time}`;
                      haptic.heavy();
                      window.location.href = smsHref([c.phone], msg);
                    }}
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "var(--c-info-tint)", color: "var(--c-info)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  ><Icon name="msg" size={18} stroke={2.2}/></button>
                  <button
                    onClick={() => { haptic.selection(); setEditingId(c.id); }}
                    style={{ width: 32, height: 48, color: "var(--c-text-muted)" }}
                  ><Icon name="dots" size={16}/></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function sosInputStyle(): React.CSSProperties {
  return {
    width: "100%", minHeight: 44, borderRadius: 10,
    background: "var(--c-surface-muted)", border: "1px solid var(--c-border)",
    padding: "0 12px", fontSize: 15, fontFamily: "var(--font-body)",
    color: "var(--c-text)", marginBottom: 8, outline: "none",
  };
}
