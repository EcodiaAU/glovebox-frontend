// Auto-ported from prototype. Mock data; real services wire in v2.

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import {
  Icon, NetworkPill, AccountBtn, BottomSheet, RightDrawer, Modal,
  PrimaryBtn, GhostBtn, Toggle,
} from "./shared";
import { FauxMap, TRIP_ROUTE, POIs } from "./faux-map";

// trip.jsx — /trip page with planning + navigation modes.

// ─────────────────────────────────────────────────────────────
// Trip Screen
// ─────────────────────────────────────────────────────────────
export function TripScreen({ tweaks, setTweak }) {
  const mode = tweaks.tripMode; // 'planning' | 'navigation'
  const { stops, setStops, legs } = useStops();
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [placeSheet, setPlaceSheet] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [fuelSheet, setFuelSheet] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [stopAction, setStopAction] = useState(null);
  const [nextStopOpen, setNextStopOpen] = useState(false);

  const isNav = mode === 'navigation';

  // AI POIs to highlight on map in nav mode (matches NextStopCard)
  const navAiPois = isNav ? AI_POIS_FOR_NEXT_STOP.map(p => p.map) : [];

  return (
    <div className="page">
      {/* MAP (full-bleed) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <FauxMap
          width={402}
          height={874}
          style={tweaks.mapStyle}
          progress={isNav ? tweaks.navProgress : 0}
          showCar={isNav}
          showGloveboxers={tweaks.nearbyGloveboxers}
          clusterSize={tweaks.clusterSize}
          aiPois={navAiPois}
        />
      </div>

      {mode === 'planning' && (
        <PlanningOverlay
          tweaks={tweaks} setTweak={setTweak}
          stops={stops} setStops={setStops} legs={legs}
          onStopAction={setStopAction}
          onStyleOpen={() => setStylePickerOpen(true)}
          onPlaceTap={(p) => setPlaceSheet(p)}
          onSuggestions={() => setSuggestionsOpen(true)}
          onFuel={() => setFuelSheet(true)}
          onPlans={() => setPlansOpen(true)}
          onAI={() => setAiOpen(true)}
          onShare={() => setShareOpen(true)}
          onInvite={() => setInviteOpen(true)}
          onUpgrade={() => setPaywallOpen(true)}
          onStart={() => setTweak('tripMode', 'navigation')}
        />
      )}

      {mode === 'navigation' && (
        <NavigationOverlay
          tweaks={tweaks}
          setTweak={setTweak}
          nextStopOpen={nextStopOpen}
          setNextStopOpen={setNextStopOpen}
          onPlaceTap={(p) => setPlaceSheet(p)}
          onStyleOpen={() => setStylePickerOpen(true)}
          onReport={() => setReportOpen(true)}
          onLayers={() => setLayerMenuOpen(true)}
          layerMenuOpen={layerMenuOpen}
          closeLayerMenu={() => setLayerMenuOpen(false)}
        />
      )}

      {/* Map style picker (bottom sheet) */}
      <BottomSheet open={stylePickerOpen} onClose={() => setStylePickerOpen(false)} title="Map style">
        <MapStyleGrid value={tweaks.mapStyle} onChange={(v) => { setTweak('mapStyle', v); setStylePickerOpen(false); }}/>
      </BottomSheet>

      <PlaceDetailSheet place={placeSheet} onClose={() => setPlaceSheet(null)} />

      <BottomSheet open={suggestionsOpen} onClose={() => setSuggestionsOpen(false)} title="Suggestions along route">
        <SuggestionsContent onAdd={() => setSuggestionsOpen(false)}/>
      </BottomSheet>

      <BottomSheet open={fuelSheet} onClose={() => setFuelSheet(false)} title="Fuel plan">
        <FuelSheetContent state={tweaks.fuelState}/>
      </BottomSheet>

      <RightDrawer open={plansOpen} onClose={() => setPlansOpen(false)} title="Your plans">
        <PlansDrawerContent onClose={() => setPlansOpen(false)} />
      </RightDrawer>

      <Modal open={aiOpen} onClose={() => setAiOpen(false)}>
        <AIGeneratorModal onClose={() => setAiOpen(false)}/>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)}>
        <ShareTripModal onClose={() => setShareOpen(false)}/>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <InviteCodeModal onClose={() => setInviteOpen(false)}/>
      </Modal>

      <Modal open={paywallOpen} onClose={() => setPaywallOpen(false)}>
        <PaywallModal onClose={() => setPaywallOpen(false)}/>
      </Modal>

      {/* Quick-report 4x2 grid */}
      <BottomSheet open={reportOpen} onClose={() => setReportOpen(false)} title="Quick report">
        <QuickReportGrid onClose={() => setReportOpen(false)}/>
      </BottomSheet>

      {/* Per-stop quick action sheet */}
      <StopActionsSheet
        stop={stopAction}
        onClose={() => setStopAction(null)}
        onUpdate={(updated) => setStops(ss => ss.map(s => s.id === updated.id ? updated : s))}
        onRemove={() => setStops(ss => ss.filter(s => s.id !== stopAction.id))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLANNING OVERLAY — slim wrapper. All trip-card UI is now in trip-plan.jsx.
// ─────────────────────────────────────────────────────────────
export function PlanningOverlay({
  tweaks, setTweak, stops, setStops, legs, onStopAction,
  onStyleOpen, onSuggestions, onFuel,
  onPlans, onAI, onShare, onInvite, onUpgrade, onStart,
}) {
  return (
    <>
      <TopOverlayRow tweaks={tweaks}/>

      {/* Enrichment banner (subtle, below top row) */}
      {tweaks.enrichmentState !== 'done' && (
        <div style={{
          position: 'absolute', left: 16, right: 16, top: 96,
          zIndex: 12,
        }}>
          <EnrichmentBanner state={tweaks.enrichmentState}/>
        </div>
      )}

      <PlanRail onStyle={onStyleOpen} onAI={onAI} onPlans={onPlans} onShare={onShare}/>

      <PlanSheet
        tweaks={tweaks}
        setTweak={setTweak}
        stops={stops} setStops={setStops} legs={legs}
        onAction={onStopAction}
        onAddAt={() => onSuggestions()}
        onStart={onStart}
        onSuggestions={onSuggestions}
        onFuel={onFuel}
        onInvite={onInvite}
        onUpgrade={onUpgrade}
        onEditTitle={() => {}}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION OVERLAY (T-b-T)
// ─────────────────────────────────────────────────────────────
export function NavigationOverlay({ tweaks, setTweak, nextStopOpen, setNextStopOpen, onPlaceTap, onStyleOpen, onReport, onLayers, layerMenuOpen, closeLayerMenu }) {
  const [muted, setMuted] = useState(false);

  // dynamic maneuver based on progress
  const maneuver = useMemo(() => {
    const t = tweaks.navProgress;
    if (t < 0.30) return { icon: 'arrowUp', dist: '12.4 km', name: 'Birdsville Track', detail: 'Continue south' };
    if (t < 0.55) return { icon: 'turnRight', dist: '420 m', name: 'Cordillo Downs Rd', detail: 'Turn right onto', imminent: true };
    if (t < 0.78) return { icon: 'turnLeft', dist: '34 km', name: 'Strzelecki Track', detail: 'Then bear left' };
    return { icon: 'pin', dist: '6.8 km', name: 'Innamincka', detail: 'Arriving at destination' };
  }, [tweaks.navProgress]);

  const offRoute = tweaks.offRoute;
  const alertSev = tweaks.alertSev;

  return (
    <>
      {/* TOP: maneuver card (and off-route banner above when present) */}
      <div style={{ position: 'absolute', left: 12, right: 12, top: 56, zIndex: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {offRoute && <OffRouteBanner />}
        <ManeuverCard {...maneuver} />
        {alertSev !== 'none' && <AlertBanner sev={alertSev}/>}
      </div>

      {/* RIGHT SIDE: single grouped well containing pills + compass + controls */}
      <NavRail
        tweaks={tweaks}
        muted={muted}
        onMute={() => setMuted(m => !m)}
        onLayers={onLayers}
        layerMenuOpen={layerMenuOpen}
      />

      {/* layer menu shoots out to the LEFT of the rail, not above it (Tate's note) */}
      {layerMenuOpen && (
        <div style={{
          position: 'absolute', right: 80, top: 320, zIndex: 14,
          background: 'var(--c-surface)', borderRadius: 14,
          boxShadow: 'var(--sh-floating)', border: '1px solid var(--c-border)',
          padding: 6, width: 168,
        }}>
          {['Traffic','Hazards','Fuel prices','Travelers','POIs'].map((l, i) => (
            <div key={l} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 10px',
              borderBottom: i < 4 ? '1px solid var(--c-border)' : 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{l}</div>
              <Toggle on={i % 2 === 0}/>
            </div>
          ))}
        </div>
      )}

      {/* Fuel last-chance toast */}
      {tweaks.fuelState === 'critical' && <FuelLastChanceToast />}

      {/* QUICK-REPORT FAB — anchored above the closed stacked cards (cards open via popover, not by growing) */}
      <button onClick={onReport} aria-label="Report"
        style={{
          position: 'absolute', left: 16, bottom: 376, zIndex: 13,
          width: 56, height: 56, borderRadius: 999,
          background: 'var(--c-danger)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--sh-floating)',
        }}>
        <Icon name="warn" size={22} stroke={2.2}/>
      </button>

      {/* BOTTOM: NextStopCard + ProgressCard stacked flush above tab bar */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 82, zIndex: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NextStopCard
          open={nextStopOpen}
          onToggle={() => setNextStopOpen(o => !o)}
          onSkip={() => setNextStopOpen(false)}
          onView={() => onPlaceTap && onPlaceTap('cordillo')}
        />
        <ProgressCard tweaks={tweaks} setTweak={setTweak}/>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────
export function TerrainChip({ surface }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', height: 32, borderRadius: 999,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      boxShadow: 'var(--sh-card)', fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--c-accent)' }}/>
      <span style={{ color: 'var(--c-text)' }}>{surface}</span>
    </div>
  );
}

export function NearbyGloveboxersPill({ count = 0 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', height: 32, borderRadius: 999,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      boxShadow: 'var(--sh-card)', fontSize: 12, fontWeight: 700, color: count > 0 ? 'var(--c-info)' : 'var(--c-text-muted)',
    }}>
      <span style={{ position: 'relative', width: 10, height: 10 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: count > 0 ? 'var(--c-info)' : 'var(--c-text-muted)',
          animation: count > 0 ? 'pulse-soft 2s ease-in-out infinite' : 'none' }}/>
      </span>
      {count > 0 ? `${count} nearby` : 'No travelers'}
    </div>
  );
}

export function EnrichmentBanner({ state }) {
  const map = {
    setup:    { label: 'Setting up corridor', detail: '142 / 360 places', pct: 0.39 },
    loading:  { label: 'Caching tiles for offline', detail: 'Strzelecki bundle · 18 MB', pct: 0.72 },
    error:    { label: 'Some assets failed', detail: 'Retry in background', pct: null },
    done:     null,
  };
  const c = map[state];
  if (!c) return null;
  return (
    <div style={{
      background: 'var(--c-surface)', borderRadius: 14,
      boxShadow: 'var(--sh-card)', border: '1px solid var(--c-border)',
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 999,
        background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: state === 'error' ? 'none' : 'spin 2s linear infinite',
      }}>
        <Icon name={state === 'error' ? 'warn' : 'sync'} size={16} stroke={2}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
        <div className="t-mono t-muted" style={{ fontSize: 11 }}>{c.detail}</div>
      </div>
      {c.pct !== null && (
        <div style={{ width: 36, fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
          {Math.round(c.pct * 100)}%
        </div>
      )}
    </div>
  );
}

export function RoundBtn({ icon, label, onClick, accent = false, active = false }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{
        width: 48, height: 48, borderRadius: 14,
        background: accent ? 'var(--grad-cta)' : (active ? 'var(--c-accent-tint)' : 'var(--c-surface)'),
        color: accent ? 'white' : (active ? 'var(--c-accent)' : 'var(--c-text)'),
        border: accent ? 'none' : '1px solid var(--c-border)',
        boxShadow: 'var(--sh-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
      <Icon name={icon} size={20} stroke={2}/>
      {label && (
        <span style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4,
          whiteSpace: 'nowrap' }}>{label}</span>
      )}
    </button>
  );
}

export function Stat({ label, value, unit, mini }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="t-display" style={{
        fontWeight: 600, fontSize: mini ? 14 : 18, color: 'var(--c-text)',
        letterSpacing: -0.2, lineHeight: 1.1,
      }}>
        <span style={{ fontWeight: 700 }}>{value}</span>
        {unit && <span style={{ color: 'var(--c-text-muted)', fontWeight: 500, fontSize: 11, marginLeft: 3 }}>{unit}</span>}
      </div>
      <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
    </div>
  );
}

export function StopsList() {
  const stops = [
    { name: 'Birdsville',        time: '06:30', kind: 'start' },
    { name: 'Big Red Dune',      time: '07:15', kind: 'wp', fuel: false },
    { name: 'Cordillo Downs',    time: '11:40', kind: 'wp', fuel: false },
    { name: 'Cameron Corner',    time: '14:20', kind: 'wp', fuel: true  },
    { name: 'Innamincka',        time: '17:55', kind: 'end' },
  ];
  return (
    <div>
      {stops.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 8px', minHeight: 48,
        }}>
          <div style={{ width: 16, color: 'var(--c-text-muted)', cursor: 'grab' }}>
            <Icon name="drag" size={14} stroke={1.6}/>
          </div>
          {/* spine */}
          <div style={{ position: 'relative', width: 14, alignSelf: 'stretch', display: 'flex', justifyContent: 'center' }}>
            {i > 0 && <div style={{ position: 'absolute', top: 0, bottom: '50%', width: 2, background: 'var(--c-accent)' }}/>}
            {i < stops.length - 1 && <div style={{ position: 'absolute', top: '50%', bottom: 0, width: 2, background: 'var(--c-accent)' }}/>}
            <div style={{
              position: 'relative', zIndex: 2,
              width: s.kind === 'wp' ? 10 : 14, height: s.kind === 'wp' ? 10 : 14,
              borderRadius: 999,
              background: s.kind === 'start' ? 'var(--c-success)'
                       : s.kind === 'end'   ? 'var(--c-danger)'
                       : 'var(--c-surface)',
              border: s.kind === 'wp' ? '2.5px solid var(--c-accent)' : '2px solid var(--c-surface)',
              alignSelf: 'center',
            }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            <div className="t-mono t-muted" style={{ fontSize: 11 }}>
              {s.time}{s.fuel ? ' · fuel stop' : ''}
            </div>
          </div>
          <button style={{ width: 32, height: 32, color: 'var(--c-text-muted)' }} aria-label="Stop actions">
            <Icon name="dots" size={16}/>
          </button>
        </div>
      ))}
    </div>
  );
}

export function FuelSummary({ state = 'healthy', onClick }) {
  const tank = state === 'critical' ? 0.12 : state === 'warning' ? 0.32 : 0.74;
  const isExpanded = state !== 'healthy';
  const palette =
    state === 'critical' ? { bg: 'var(--c-error-bg)', fg: 'var(--c-error-text)', dot: 'var(--c-danger)' } :
    state === 'warning'  ? { bg: 'var(--c-warn-bg)',  fg: 'var(--c-warn-text)',  dot: 'var(--c-cat-solar)' } :
                           { bg: 'var(--c-surface-muted)', fg: 'var(--c-text)', dot: 'var(--c-success)' };
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left',
      background: palette.bg, borderRadius: 14,
      padding: isExpanded ? '12px 12px' : '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="fuel" size={18} stroke={2} style={{ color: palette.fg }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: palette.fg }}>
            {state === 'critical' ? 'Critical gap: 312 km on reserve'
             : state === 'warning' ? 'Watch Cordillo → Innamincka gap'
             : 'Fuel plan looks good'}
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
            Range 540 km · Reserve 80 km
          </div>
        </div>
        <Icon name="chev" size={16} stroke={2} style={{ color: palette.fg }}/>
      </div>
      {/* tank-range strip */}
      <div style={{ position: 'relative', height: 10, borderRadius: 5,
        background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${tank * 100}%`,
          background: state === 'critical' ? 'var(--c-danger)' : state === 'warning' ? 'var(--c-cat-solar)' : 'var(--c-success)',
        }}/>
        {/* station markers */}
        {[0.12, 0.34, 0.61, 0.88].map((p, i) => (
          <div key={i} style={{
            position: 'absolute', top: -2, bottom: -2, left: `${p * 100}%`, width: 2,
            background: 'var(--c-text)',
            opacity: 0.55,
            transform: 'translateX(-1px)',
          }}/>
        ))}
        {/* reserve marker */}
        <div style={{ position: 'absolute', top: -3, bottom: -3, left: `15%`, width: 1.5, background: 'var(--c-danger)' }}/>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Nav: maneuver, off-route, alert, progress, compass, fuel pill
// ─────────────────────────────────────────────────────────────
export function ManeuverCard({ icon, dist, name, detail, imminent }) {
  const accent = imminent ? 'var(--c-cat-solar)' : 'var(--c-accent)';
  return (
    <div style={{
      background: 'var(--c-nav-card)',
      borderRadius: 18, boxShadow: 'var(--sh-floating)',
      border: '1px solid var(--c-border)',
      padding: '14px 14px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: imminent ? 'var(--c-warn-bg)' : 'var(--c-accent-tint)',
        color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={36} stroke={2.4}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-display t-num" style={{ fontWeight: 700, fontSize: 28, color: accent, lineHeight: 1, letterSpacing: -0.5 }}>
          {dist}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-muted)', marginTop: 2 }}>{detail}</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--c-text)', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
      </div>
    </div>
  );
}

export function OffRouteBanner() {
  return (
    <div style={{
      background: 'var(--c-error-bg)', color: 'var(--c-error-text)',
      borderRadius: 14, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      border: '1px solid var(--c-border)',
    }}>
      <Icon name="warn" size={18} stroke={2.2}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Off route · 1.2 km from path</div>
        <div className="t-mono" style={{ fontSize: 11, opacity: 0.85 }}>Corridor cached · reroute available</div>
      </div>
      <button style={{
        height: 36, padding: '0 12px', borderRadius: 999,
        background: 'var(--c-danger)', color: 'white',
        fontWeight: 700, fontSize: 12,
      }}>
        Reroute
      </button>
    </div>
  );
}

export function AlertBanner({ sev }) {
  const map = {
    minor: { color: 'var(--c-sev-minor)', text: 'Rough corrugations 8 km ahead', icon: 'warn' },
    moderate: { color: 'var(--c-sev-moderate)', text: 'Sand drift on track · reduce speed', icon: 'wind' },
    major: { color: 'var(--c-sev-major)', text: 'Track closure 42 km · alternate via Birdsville', icon: 'closure' },
  };
  const c = map[sev];
  return (
    <div style={{
      background: 'var(--c-surface)', borderRadius: 14,
      borderLeft: `4px solid ${c.color}`,
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--sh-card)',
    }}>
      <Icon name={c.icon} size={18} style={{ color: c.color }}/>
      <div style={{ fontSize: 13, flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{sev.toUpperCase()} · 12 km ahead</div>
        <div className="t-muted" style={{ fontSize: 12 }}>{c.text}</div>
      </div>
    </div>
  );
}

export function ProgressCard({ tweaks, setTweak }) {
  const t = tweaks.navProgress;
  const km = Math.round(524 * (1 - t));
  const minutes = Math.round(462 * (1 - t));
  const hrs = Math.floor(minutes / 60), mm = minutes % 60;
  const eta = new Date();
  eta.setMinutes(eta.getMinutes() + minutes);
  const etaStr = `${eta.getHours().toString().padStart(2,'0')}:${eta.getMinutes().toString().padStart(2,'0')}`;
  return (
    <div style={{
      background: 'var(--c-nav-card)',
      borderRadius: 18,
      boxShadow: 'var(--sh-floating)',
      border: '1px solid var(--c-border)',
      padding: '12px 14px 10px',
    }}>
      {/* top row: ETA / dist / dur / speed */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="t-display t-num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-success)', lineHeight: 1 }}>{etaStr}</div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>ARRIVE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="t-display t-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>{km}<span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>km</span></div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>LEFT</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="t-display t-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>{hrs}<span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>h</span> {mm}<span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>m</span></div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>DURATION</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="t-display t-num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>72</div>
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>KM/H</div>
        </div>
      </div>

      {/* elevation strip */}
      <div style={{ marginTop: 10 }}>
        <ElevationStrip progress={t}/>
      </div>

      {/* bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 10px', borderRadius: 999,
          background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
          fontSize: 12, fontWeight: 700,
        }}>
          <Icon name="fuel" size={14} stroke={2.2}/>
          To next fuel · 184 km
        </button>
        <button onClick={() => { /* end navigation */ }} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 12px', borderRadius: 999,
          background: 'var(--c-error-bg)', color: 'var(--c-error-text)',
          fontSize: 12, fontWeight: 700,
        }} onClickCapture={() => {}}>
          <Icon name="x" size={14} stroke={2.4}/> End
        </button>
      </div>
    </div>
  );
}

export function ElevationStrip({ progress }) {
  // synthetic elevation profile
  const pts = [];
  const n = 60;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = 30 - 10*Math.sin(t * Math.PI * 2.4) + 8*Math.cos(t * Math.PI * 1.7) - 6*t;
    pts.push([t * 360, 30 + y * 0.6]);
  }
  const d = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  const fill = d + ` L 360 50 L 0 50 Z`;
  const px = progress * 360;
  return (
    <div style={{ height: 50, position: 'relative' }}>
      <svg width="100%" height="50" viewBox="0 0 360 50" preserveAspectRatio="none">
        <path d={fill} fill="var(--c-accent-tint)"/>
        <path d={d} stroke="var(--c-accent)" strokeWidth="1.5" fill="none"/>
        <line x1={px} x2={px} y1="0" y2="50" stroke="var(--c-text)" strokeWidth="1.2" strokeDasharray="2 2"/>
        <circle cx={px} cy="28" r="4" fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth="1.5"/>
      </svg>
      <div className="t-mono" style={{ position: 'absolute', top: 2, left: 0, fontSize: 9, color: 'var(--c-text-muted)' }}>312 m</div>
      <div className="t-mono" style={{ position: 'absolute', top: 2, right: 0, fontSize: 9, color: 'var(--c-text-muted)' }}>elev</div>
    </div>
  );
}

export function CompassHud() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 999,
      background: 'var(--c-surface)', boxShadow: 'var(--sh-card)',
      border: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 0,
    }}>
      <div className="t-display t-num" style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>164°</div>
      <div className="t-mono" style={{ fontSize: 9, color: 'var(--c-text-muted)' }}>SSE</div>
      {/* needle */}
      <svg width="40" height="6" viewBox="0 0 40 6" style={{ marginTop: 2 }}>
        <path d="M2 3 L18 0 L18 6 Z" fill="var(--c-danger)"/>
        <path d="M22 0 L38 3 L22 6 Z" fill="var(--c-text-muted)"/>
      </svg>
    </div>
  );
}

export function FuelPressurePill({ state }) {
  const color =
    state === 'critical' ? 'var(--c-danger)' :
    state === 'warning' ? 'var(--c-cat-solar)' :
    'var(--c-success)';
  const label =
    state === 'critical' ? '38 km' :
    state === 'warning'  ? '184 km' :
    '184 km';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 32, padding: '0 10px', borderRadius: 999,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      boxShadow: 'var(--sh-card)', color, fontWeight: 700, fontSize: 12,
    }}>
      <Icon name="fuel" size={14} stroke={2.2}/>
      <span style={{ color: 'var(--c-text)' }}>{label}</span>
    </div>
  );
}

export function FuelLastChanceToast() {
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, top: 280, zIndex: 13,
      background: 'var(--c-error-bg)', color: 'var(--c-error-text)',
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--sh-floating)',
      animation: 'slide-up 0.3s ease',
    }}>
      <Icon name="fuel" size={20} stroke={2.2}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Last chance for fuel · 4 km</div>
        <div className="t-mono" style={{ fontSize: 11 }}>Cameron Corner Store · open until 18:00</div>
      </div>
      <button style={{ width: 36, height: 36, color: 'inherit' }}><Icon name="x" size={16}/></button>
    </div>
  );
}

// Toggle component imported from ./shared (was duplicated locally in prototype)

// ─────────────────────────────────────────────────────────────
// Map style picker grid
// ─────────────────────────────────────────────────────────────
export function MapStyleGrid({ value, onChange }) {
  const styles = [
    { id: 'terrain',   label: 'Terrain'   },
    { id: 'satellite', label: 'Satellite' },
    { id: 'topo',      label: 'Topo'      },
    { id: 'street',    label: 'Street'    },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 8 }}>
      {styles.map(s => {
        const active = value === s.id;
        return (
          <button key={s.id} onClick={() => onChange(s.id)} style={{
            position: 'relative', height: 96, borderRadius: 14, overflow: 'hidden',
            border: active ? '2px solid var(--c-accent)' : '1px solid var(--c-border)',
            background: 'var(--c-surface-muted)',
            padding: 0, textAlign: 'left',
          }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <FauxMap width={200} height={94} style={s.id} clusterSize="small"/>
            </div>
            <div style={{
              position: 'absolute', left: 8, bottom: 8,
              padding: '2px 8px', borderRadius: 999,
              background: 'var(--c-surface)', fontSize: 12, fontWeight: 700,
            }}>{s.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Place detail sheet
// ─────────────────────────────────────────────────────────────
const PLACE_LIB = {
  cordillo: { name: 'Cordillo Downs Shearing Shed', cat: 'Heritage', amenities: ['Toilets','Camping','No fuel'], hours: 'Open 24h', contact: '+61 8 8675 8336', distance: '184 km ahead', km: 184 },
  cameron:  { name: 'Cameron Corner Store',       cat: 'Roadhouse', amenities: ['Fuel','Food','Toilets','Camping'], hours: 'Open · 07–18', contact: '+61 8 8091 3872', distance: '312 km ahead', km: 312 },
  innamincka:{name: 'Innamincka Trading Post',    cat: 'Roadhouse', amenities: ['Fuel','Food','Beds','Beer'], hours: 'Open · 07–19', contact: '+61 8 8675 9900', distance: '524 km ahead', km: 524 },
};

export function PlaceDetailSheet({ place, onClose }) {
  if (!place) return null;
  const p = PLACE_LIB[place] || PLACE_LIB.cameron;
  return (
    <BottomSheet open onClose={onClose} title={null}>
      {/* satellite preview */}
      <div style={{ position: 'relative', height: 140, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
        <FauxMap width={400} height={140} style="satellite" clusterSize="small"/>
        <div style={{ position: 'absolute', left: 10, bottom: 10,
          padding: '4px 10px', borderRadius: 999, background: 'var(--c-surface)', fontSize: 11, fontWeight: 700 }}>
          {p.distance}
        </div>
      </div>
      <div className="t-display" style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.3 }}>{p.name}</div>
      <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
        {p.cat} · {p.hours}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {p.amenities.map(a => (
          <div key={a} style={{
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--c-surface-muted)', color: 'var(--c-text)',
          }}>{a}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <PrimaryBtn style={{ flex: 1 }}>
          <Icon name="plus" size={16} stroke={2.2}/> Add to trip
        </PrimaryBtn>
        <GhostBtn>
          <Icon name="phone" size={16}/>
        </GhostBtn>
        <GhostBtn>
          <Icon name="share" size={16}/>
        </GhostBtn>
      </div>

      <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Contact</div>
        <div className="t-mono" style={{ fontSize: 13, fontWeight: 600 }}>{p.contact}</div>
      </div>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Trip suggestions panel content
// ─────────────────────────────────────────────────────────────
export function SuggestionsContent({ onAdd }) {
  const cats = [
    { id: 'fuel',    label: 'Fuel',     n: 4, color: 'var(--c-accent)' },
    { id: 'camp',    label: 'Camping',  n: 12, color: 'var(--c-success-dark)' },
    { id: 'water',   label: 'Water',    n: 3, color: 'var(--c-cat-water)' },
    { id: 'heritage',label: 'Heritage', n: 6, color: '#8a5a2b' },
    { id: 'lookout', label: 'Lookouts', n: 8, color: 'var(--c-info)' },
    { id: 'food',    label: 'Food',     n: 2, color: 'var(--c-cat-solar)' },
  ];
  const items = [
    { name: 'Cordillo Downs Shearing Shed', cat: 'Heritage', dist: '184 km' },
    { name: 'Walkers Crossing camp',        cat: 'Camping',  dist: '233 km' },
    { name: 'Sturt\'s Tree',                 cat: 'Heritage', dist: '486 km' },
    { name: 'Cooper Creek crossing',         cat: 'Lookouts', dist: '510 km' },
    { name: 'Coongie Lakes turnoff',         cat: 'Lookouts', dist: '498 km' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          flex: 1, height: 40, borderRadius: 999, background: 'var(--c-surface-muted)',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
        }}>
          <Icon name="search" size={16}/>
          <span style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>Search 40+ categories</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {cats.map(c => (
          <button key={c.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999,
            background: 'var(--c-surface-muted)', fontSize: 12, fontWeight: 700,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color }}/>
            {c.label}
            <span style={{ color: 'var(--c-text-muted)', fontWeight: 500 }}>{c.n}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 14, background: 'var(--c-surface-muted)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
              background: 'var(--c-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-accent)' }}>
              <Icon name="pin" size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
              <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{it.cat} · {it.dist}</div>
            </div>
            <button onClick={onAdd} style={{
              width: 40, height: 40, borderRadius: 999,
              background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="plus" size={18} stroke={2.4}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FuelSheetContent({ state }) {
  return (
    <div>
      <FuelSummary state={state} onClick={() => {}}/>
      <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Stations on route</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { name: 'Birdsville Roadhouse', km: 0,   diesel: 2.49, unleaded: 2.39, status: 'open' },
          { name: 'Cordillo Downs',       km: 184, diesel: null, unleaded: null, status: 'closed' },
          { name: 'Cameron Corner Store', km: 312, diesel: 2.85, unleaded: 2.75, status: 'open' },
          { name: 'Innamincka Trading',   km: 524, diesel: 2.69, unleaded: 2.59, status: 'open' },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px', borderRadius: 14, background: 'var(--c-surface-muted)',
            opacity: s.status === 'closed' ? 0.55 : 1,
          }}>
            <Icon name="fuel" size={20} style={{ color: 'var(--c-accent)' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                {s.km} km · {s.status}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="t-mono" style={{ fontSize: 13, fontWeight: 700 }}>
                {s.diesel ? `$${s.diesel.toFixed(2)}` : '—'}
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>diesel</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Plans drawer content
// ─────────────────────────────────────────────────────────────
export function PlansDrawerContent({ onClose }) {
  const plans = [
    { name: 'Birdsville → Innamincka', km: 524, hrs: '7:42', stops: 3, active: true, shared: false },
    { name: 'Outback loop · 14 days',  km: 3120, hrs: '38:10', stops: 11, active: false, shared: true },
    { name: 'Simpson Desert crossing', km: 478, hrs: '22:15', stops: 5, active: false, shared: false },
    { name: 'Top End wet-season',      km: 1840, hrs: '24:30', stops: 8, active: false, shared: false },
  ];
  return (
    <div style={{ padding: '14px 14px 80px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <GhostBtn style={{ flex: 1 }}><Icon name="addUser" size={16}/> Join</GhostBtn>
        <GhostBtn style={{ flex: 1 }}><Icon name="sparkle" size={16}/> AI</GhostBtn>
        <PrimaryBtn style={{ flex: 1 }}><Icon name="plus" size={16}/> New</PrimaryBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map((p, i) => (
          <div key={i} style={{
            padding: '14px', borderRadius: 18,
            background: p.active ? 'var(--c-accent-tint)' : 'var(--c-surface-muted)',
            border: p.active ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {p.active && <Icon name="starFill" size={14} style={{ color: 'var(--c-accent)' }}/>}
              {p.shared && <Icon name="invite" size={14} style={{ color: 'var(--c-shared)' }}/>}
              <div className="t-display" style={{ fontWeight: 700, fontSize: 15, flex: 1, letterSpacing: -0.1 }}>{p.name}</div>
            </div>
            <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 10 }}>
              {p.km} km · {p.hrs} · {p.stops} stops
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <IconChip icon="share"/>
              <IconChip icon="invite"/>
              <IconChip icon="open" highlight={!p.active}/>
              <IconChip icon="trash"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IconChip({ icon, highlight }) {
  return (
    <button style={{
      width: 40, height: 40, borderRadius: 12,
      background: highlight ? 'var(--c-accent)' : 'var(--c-surface)',
      color: highlight ? 'white' : 'var(--c-text)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={16}/>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// AI generator modal
// ─────────────────────────────────────────────────────────────
export function AIGeneratorModal({ onClose }) {
  const [stage, setStage] = useState('input'); // input | thinking | preview
  const [prompt, setPrompt] = useState('A 5-day outback loop from Adelaide via the Flinders, gravel ok, with hot showers and one heritage stop a day.');

  useEffect(() => {
    if (stage === 'thinking') {
      const t = setTimeout(() => setStage('preview'), 1800);
      return () => clearTimeout(t);
    }
  }, [stage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={18} style={{ color: 'var(--c-accent)' }}/>
          <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>AI trip generator</div>
        </div>
        <button onClick={onClose} style={{ width: 40, height: 40 }}><Icon name="x" size={18}/></button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: '4px 18px 8px' }}>
        {stage === 'input' && (
          <div>
            <div style={{
              padding: '12px', borderRadius: 14,
              background: 'var(--c-surface-muted)',
              fontSize: 14, lineHeight: 1.5, minHeight: 120,
            }}>
              {prompt}<span style={{ animation: 'cursor 1.1s steps(1) infinite', borderLeft: '1.5px solid var(--c-text)', marginLeft: 1 }}>&nbsp;</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              <div className="t-mono t-muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Quick prompts</div>
              {['Weekend escape with hot springs','Family route with playgrounds','Photographer\'s loop, low light hours'].map(q => (
                <button key={q} onClick={() => setPrompt(q)} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                  background: 'var(--c-surface-muted)', fontSize: 13,
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {stage === 'thinking' && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999, margin: '0 auto 16px',
              background: 'var(--c-accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'spin 2s linear infinite',
            }}>
              <Icon name="sparkle" size={28} style={{ color: 'var(--c-accent)' }}/>
            </div>
            <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>Building your trip…</div>
            <div className="t-muted" style={{ fontSize: 13, marginTop: 6 }}>Checking corridors, fuel coverage, season conditions</div>
          </div>
        )}
        {stage === 'preview' && (
          <div>
            <div className="t-display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>5-day Flinders loop</div>
            <div className="t-muted" style={{ fontSize: 12, marginBottom: 12 }}>1,824 km · 5 nights · 92% sealed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { d: 'Day 1', stop: 'Wilpena Pound', why: 'Hot showers + heritage walk · 4 h from start' },
                { d: 'Day 2', stop: 'Arkaroola',     why: 'Ridgetop tour booking aligns with your sunset window' },
                { d: 'Day 3', stop: 'Blinman',       why: 'Mine tour + showers · sits between fuel stops' },
                { d: 'Day 4', stop: 'Parachilna',    why: 'Prairie Hotel dinner · short next-morning hop' },
                { d: 'Day 5', stop: 'Quorn',         why: 'Pichi Richi rail + easy return run' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--c-surface-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="t-mono" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--c-accent-tint)', color: 'var(--c-accent)', fontWeight: 700 }}>{s.d}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.stop}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 4 }}>{s.why}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 18px 18px', display: 'flex', gap: 8, borderTop: '1px solid var(--c-border)' }}>
        {stage === 'input' && <PrimaryBtn style={{ flex: 1 }} onClick={() => setStage('thinking')}><Icon name="sparkle" size={16}/> Generate</PrimaryBtn>}
        {stage === 'thinking' && <GhostBtn style={{ flex: 1 }} onClick={onClose}>Cancel</GhostBtn>}
        {stage === 'preview' && (
          <>
            <GhostBtn style={{ flex: 1 }} onClick={() => setStage('input')}>Modify</GhostBtn>
            <PrimaryBtn style={{ flex: 1 }} onClick={onClose}>Save plan</PrimaryBtn>
          </>
        )}
      </div>
    </div>
  );
}

export function ShareTripModal({ onClose }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>Share trip</div>
        <button onClick={onClose} style={{ width: 36, height: 36 }}><Icon name="x" size={18}/></button>
      </div>
      <div style={{ position: 'relative', height: 200, borderRadius: 14, overflow: 'hidden',
        background: 'var(--c-surface-muted)', marginBottom: 14 }}>
        <FauxMap width={360} height={200} style="terrain" clusterSize="small"/>
        <div style={{ position: 'absolute', left: 12, top: 12, padding: '4px 10px', borderRadius: 999,
          background: 'rgba(0,0,0,0.55)', color: 'white', fontWeight: 700, fontSize: 11 }}>
          GLOVEBOX
        </div>
        <div style={{ position: 'absolute', left: 12, bottom: 12, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          <div className="t-display" style={{ fontSize: 18, fontWeight: 700 }}>Birdsville → Innamincka</div>
          <div className="t-mono" style={{ fontSize: 11 }}>524 km · 3 stops · Strzelecki Track</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {['msg','phone','share','open'].map(i => (
          <button key={i} style={{
            height: 60, borderRadius: 14, background: 'var(--c-surface-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={i} size={20}/>
          </button>
        ))}
      </div>
      <PrimaryBtn style={{ width: '100%' }}><Icon name="share" size={16}/> Open share sheet</PrimaryBtn>
    </div>
  );
}

export function InviteCodeModal({ onClose }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>Invite people</div>
        <button onClick={onClose} style={{ width: 36, height: 36 }}><Icon name="x" size={18}/></button>
      </div>
      <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Your code</div>
      <div style={{
        padding: '20px 24px', borderRadius: 18, background: 'var(--c-accent-tint)',
        textAlign: 'center', marginBottom: 16,
      }}>
        <div className="t-display" style={{ fontWeight: 700, fontSize: 36, letterSpacing: 6, color: 'var(--c-accent)' }}>
          R7-K3M
        </div>
        <div className="t-muted" style={{ fontSize: 12 }}>Share this code to add travelers to your plan</div>
      </div>
      <div className="t-mono" style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Or redeem a code</div>
      <div style={{
        height: 56, borderRadius: 14, background: 'var(--c-surface-muted)',
        display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 16, color: 'var(--c-text-muted)',
        marginBottom: 14,
      }}>
        Enter 6-character code
      </div>
      <PrimaryBtn style={{ width: '100%' }}>Join plan</PrimaryBtn>
    </div>
  );
}

export function PaywallModal({ onClose }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="crown" size={20} style={{ color: 'var(--c-accent)' }}/>
          <div className="t-display" style={{ fontWeight: 700, fontSize: 18 }}>Glovebox Pro</div>
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36 }}><Icon name="x" size={18}/></button>
      </div>
      <div className="t-display" style={{ fontWeight: 600, fontSize: 22, letterSpacing: -0.2, marginBottom: 16 }}>
        Take the corridors off-grid.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {[
          { i: 'route',  t: 'Unlimited offline corridors',  d: 'Cache the entire continent if you want' },
          { i: 'sparkle',t: 'AI guide along every kilometre', d: 'Tap-free context Q&A while driving' },
          { i: 'invite', t: 'Shared plans · traveler presence', d: 'Up to 12 vehicles on one trip' },
          { i: 'radio',  t: 'Satellite hand-off',            d: 'When the corridor goes truly dark' },
        ].map(f => (
          <div key={f.t} style={{ display: 'flex', gap: 10, padding: '10px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--c-accent-tint)',
              color: 'var(--c-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={f.i} size={18}/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{f.t}</div>
              <div className="t-muted" style={{ fontSize: 12 }}>{f.d}</div>
            </div>
          </div>
        ))}
      </div>
      <PrimaryBtn style={{ width: '100%' }} large>$8.90 / month — 7 days free</PrimaryBtn>
      <div className="t-mono t-muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 10 }}>
        Or $79/yr · cancel anytime
      </div>
    </div>
  );
}

export function QuickReportGrid({ onClose }) {
  const cats = [
    { i: 'warn',     l: 'Hazard',     c: 'var(--c-sev-major)' },
    { i: 'closure',  l: 'Closure',    c: 'var(--c-sev-major)' },
    { i: 'mountain', l: 'Road cond.', c: 'var(--c-sev-moderate)' },
    { i: 'bolt',     l: 'Speed',      c: 'var(--c-info)' },
    { i: 'wind',     l: 'Weather',    c: 'var(--c-cat-water)' },
    { i: 'fuel',     l: 'Fuel price', c: 'var(--c-accent)' },
    { i: 'tent',     l: 'Campsite',   c: 'var(--c-success-dark)' },
    { i: 'flag',     l: 'General',    c: 'var(--c-text-muted)' },
  ];
  return (
    <div>
      <div className="t-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Long-press a category, then drop the marker on the map.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {cats.map(c => (
          <button key={c.l} style={{
            height: 90, borderRadius: 14, background: 'var(--c-surface-muted)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: 8,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--c-surface)',
              color: c.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.i} size={20} stroke={2}/>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{c.l}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 4px 4px', borderTop: '1px solid var(--c-border)', marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Step 2: place on map</div>
        <PrimaryBtn onClick={onClose}><Icon name="plus" size={14}/> Submit</PrimaryBtn>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────
// trip-plan.jsx merged in (planning UI subcomponents).
// ─────────────────────────────────────────────────────────────

// trip-plan.jsx — new planning UI: variants, stop action sheet, AI-poi nav card, right rail.

// ─────────────────────────────────────────────────────────────
// Stop data — single source of truth used by all planning variants
// ─────────────────────────────────────────────────────────────
export function useStops() {
  const [stops, setStops] = useState([
    { id: 1, name: 'Birdsville',        time: '06:30', kind: 'start',  fuel: true,  note: 'Bakery breakfast' },
    { id: 2, name: 'Big Red Dune',      time: '07:15', kind: 'wp',     fuel: false, note: '' },
    { id: 3, name: 'Cordillo Downs',    time: '11:40', kind: 'wp',     fuel: false, note: 'Shearing shed photo stop' },
    { id: 4, name: 'Cameron Corner',    time: '14:20', kind: 'wp',     fuel: true,  note: '' },
    { id: 5, name: 'Innamincka',        time: '17:55', kind: 'end',    fuel: true,  note: 'Sunset on the Cooper' },
  ]);
  const legs = [
    { km: 38,  min: 45,  surface: 'sand',        warn: null     },
    { km: 146, min: 265, surface: 'corrugated',  warn: null     },
    { km: 124, min: 160, surface: 'unsealed',    warn: 'fuelgap'},
    { km: 216, min: 215, surface: 'unsealed',    warn: null     },
  ];
  return { stops, setStops, legs };
}

// ─────────────────────────────────────────────────────────────
// RIGHT-edge floating rail — grouped well, clearer than 4 separate floaters.
// Held tightly to top so it never overlaps the trip card.
// ─────────────────────────────────────────────────────────────
export function PlanRail({ onStyle, onAI, onPlans, onShare }) {
  const item = (icon, label, onClick, opts = {}) => (
    <button onClick={onClick} aria-label={label} style={{
      width: 52, height: 48,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: opts.accent ? 'var(--grad-cta)' : 'transparent',
      color: opts.accent ? 'white' : 'var(--c-text)',
      borderRadius: opts.accent ? 14 : 0,
      margin: opts.accent ? 2 : 0,
      position: 'relative',
      gap: 1,
    }}>
      <Icon name={icon} size={20} stroke={2}/>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
        color: opts.accent ? 'rgba(255,255,255,0.92)' : 'var(--c-text-muted)',
        textTransform: 'uppercase' }}>{label}</div>
    </button>
  );
  return (
    <div style={{
      position: 'absolute', right: 12, top: 110, zIndex: 12,
      width: 56,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 18,
      boxShadow: 'var(--sh-floating)',
      overflow: 'hidden',
    }}>
      {item('sparkle', 'AI', onAI, { accent: true })}
      <Divider/>
      {item('route', 'Plans', onPlans)}
      <Divider/>
      {item('layers', 'Style', onStyle)}
      <Divider/>
      {item('share', 'Share', onShare)}
    </div>
  );
}
export function Divider() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '0 10px' }}/>;
}

// ─────────────────────────────────────────────────────────────
// Top-row compact pills — fits in 370px even with 4 elements
// ─────────────────────────────────────────────────────────────
export function TopOverlayRow({ tweaks }) {
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, top: 56,
      display: 'flex', alignItems: 'center', gap: 6,
      zIndex: 12,
    }}>
      <NetworkPill state={tweaks.networkState} compact/>
      <TerrainChipCompact/>
      <div style={{ flex: 1 }}/>
      <NearbyGloveboxersPillCompact count={tweaks.nearbyGloveboxers}/>
      <AccountBtn/>
    </div>
  );
}
export function TerrainChipCompact() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', height: 28, borderRadius: 999,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      boxShadow: 'var(--sh-card)', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--c-accent)' }}/>
      <span style={{ color: 'var(--c-text)' }}>4WD</span>
    </div>
  );
}
export function NearbyGloveboxersPillCompact({ count = 0 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', height: 28, borderRadius: 999,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      boxShadow: 'var(--sh-card)', fontSize: 11, fontWeight: 700,
      color: count > 0 ? 'var(--c-info)' : 'var(--c-text-muted)',
    }}>
      <span style={{ position: 'relative', width: 8, height: 8 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: count > 0 ? 'var(--c-info)' : 'var(--c-text-muted)',
          animation: count > 0 ? 'pulse-soft 2s ease-in-out infinite' : 'none' }}/>
      </span>
      {count}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PlanSheet — one bottom sheet, three snap heights, smooth animation.
// Snap 0 (peek):    ~165px tall · just title + Start Nav CTA visible
// Snap 1 (default): ~470px tall · timeline + fuel summary in view
// Snap 2 (full):    everything · jumps z-index above rail + account
// Drag the handle to resize freely; release → snaps to nearest.
// Tap a snap dot to jump.
// ─────────────────────────────────────────────────────────────
export function PlanSheet({ tweaks, setTweak, stops, setStops, legs, onAction, onAddAt, onStart, onSuggestions, onFuel, onInvite, onUpgrade, onEditTitle }) {
  const SNAP_TOPS = [625, 332, 72]; // px from top of iOS frame
  const snapFromKey = (s) => s === 'peek' ? 0 : s === 'full' ? 2 : 1;
  const snapToKey   = (n) => n === 0 ? 'peek' : n === 2 ? 'full' : 'default';
  const snap = snapFromKey(tweaks.planningSnap);
  const setSnap = (n) => setTweak('planningSnap', snapToKey(n));

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef(null);

  const onPointerDown = (e) => {
    startRef.current = { y: e.clientY, top: SNAP_TOPS[snap] };
    setIsDragging(true);
    setDragOffset(0);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onPointerMove = (e) => {
    if (!startRef.current) return;
    setDragOffset(e.clientY - startRef.current.y);
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    const targetTop = startRef.current.top + dragOffset;
    let best = 1, bd = Infinity;
    SNAP_TOPS.forEach((t, i) => { const d = Math.abs(t - targetTop); if (d < bd) { bd = d; best = i; } });
    setSnap(best);
    setIsDragging(false);
    setDragOffset(0);
    startRef.current = null;
  };

  const currentTop = isDragging
    ? Math.max(60, Math.min(720, SNAP_TOPS[snap] + dragOffset))
    : SNAP_TOPS[snap];

  const totalKm = legs.reduce((a, l) => a + l.km, 0);
  const totalMin = legs.reduce((a, l) => a + l.min, 0);
  const drive = `${Math.floor(totalMin/60)}h ${(totalMin%60).toString().padStart(2,'0')}`;
  const isFull = snap === 2;

  return (
    <>
      {/* Backdrop at full snap — dim everything behind the sheet */}
      {isFull && !isDragging && (
        <div onClick={() => setSnap(1)} style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 82,
          background: 'rgba(19,19,19,0.32)', zIndex: 13,
          animation: 'fade-in 0.25s ease',
        }}/>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: currentTop, bottom: 82,
        zIndex: isFull ? 14 : 11,
        transition: isDragging ? 'none' : 'top 0.34s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        <div style={{
          height: '100%',
          background: 'var(--c-surface)',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTop: '1px solid var(--c-border)',
          borderLeft: '1px solid var(--c-border)',
          borderRight: '1px solid var(--c-border)',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.05), 0 -12px 28px rgba(0,0,0,0.10)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Drag handle - the entire top header strip is the hit target
              (56px tall), with a prominent 96x6 pill so the thumb finds it
              from anywhere along the top edge. Widens + darkens on drag. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              padding: '18px 0 14px',
              minHeight: 56,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              touchAction: 'none', cursor: 'ns-resize',
              flexShrink: 0, userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              background: isDragging ? 'var(--c-surface-muted)' : 'transparent',
              transition: 'background 140ms ease',
            }}>
            <div style={{
              width: isDragging ? 112 : 96,
              height: 6,
              borderRadius: 999,
              background: isDragging ? 'var(--c-text)' : 'var(--c-text-muted)',
              opacity: isDragging ? 0.55 : 0.32,
              transition: 'width 160ms cubic-bezier(0.2,0.8,0.2,1), background 160ms ease, opacity 160ms ease',
            }}/>
            <SnapDots snap={snap} onSnap={setSnap}/>
          </div>

          {/* Scrollable content — at peek only the header is visible; at full the
              user sees everything without needing to scroll the sheet itself. */}
          <div className="scroll-y" style={{ flex: 1 }}>
            <CardHeader title="Birdsville → Innamincka"
              sub={<><strong style={{ color: 'var(--c-text)' }}>Day 1 of 1</strong> · {stops.length} stops · via Strzelecki Track</>}
              onEdit={onEditTitle}/>
            <StatRow km={totalKm} drive={drive} surface="92% unsealed"/>
            <div style={{ padding: '6px 8px 0', display: 'flex', flexDirection: 'column' }}>
              {stops.map((s, i) => (
                <Fragment key={s.id}>
                  <StopRow stop={s} index={i} isLast={i === stops.length - 1}
                    onAction={() => onAction(s)}
                    onRename={(name) => setStops(ss => ss.map(x => x.id === s.id ? { ...x, name } : x))}/>
                  {i < stops.length - 1 && (
                    <LegRow leg={legs[i]} onAddBetween={() => onAddAt(i + 1)}/>
                  )}
                </Fragment>
              ))}
              {/* "Add another stop" - aligned to the name column so it reads
                  as a continuation of the itinerary, not a stray button.
                  Gutter math: drag(18) + gap(10) + time(46) + gap(10) + spine(20) + gap(10) = 114 */}
              <button onClick={() => onAddAt(stops.length)} style={{
                marginLeft: 114,
                marginTop: 4, marginBottom: 8,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', height: 34, borderRadius: 10,
                background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
                fontSize: 12.5, fontWeight: 700,
                alignSelf: 'flex-start',
              }}>
                <Icon name="plus" size={14} stroke={2.4}/> Add another stop
              </button>
            </div>
            <FuelStrip state={tweaks.fuelState} onClick={onFuel}/>
            <FooterRail tier={tweaks.tier} onInvite={onInvite} onUpgrade={onUpgrade}/>
          </div>

          {/* Persistent action bar — always visible at the bottom of the sheet */}
          <div style={{
            padding: '8px 12px 10px',
            display: 'flex', gap: 8, alignItems: 'center',
            borderTop: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
            flexShrink: 0,
          }}>
            <button onClick={onSuggestions} style={{
              flex: '0 0 auto', height: 48, padding: '0 14px', borderRadius: 14,
              background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
              fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="plus" size={16} stroke={2.2}/>
              Stops
            </button>
            <PrimaryBtn onClick={onStart} large style={{ flex: 1 }}>
              <Icon name="nav" size={18} stroke={2.2}/>
              Start navigation
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </>
  );
}

export function SnapDots({ snap, onSnap }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <button key={i}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onSnap(i); }}
          aria-label={`Snap ${i}`}
          style={{
            width: i === snap ? 18 : 6, height: 6, borderRadius: 999,
            background: i === snap ? 'var(--c-accent)' : 'var(--c-border-strong)',
            transition: 'width 0.18s ease, background 0.18s ease',
            padding: 0, border: 0, cursor: 'pointer',
          }}/>
      ))}
    </div>
  );
}

export function CardHeader({ title, sub, onEdit }) {
  return (
    <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="starFill" size={16} style={{ color: 'var(--c-accent)' }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-display" style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div className="t-muted" style={{ fontSize: 11 }}>{sub}</div>
      </div>
      <button onClick={onEdit} style={{ width: 36, height: 36, color: 'var(--c-text-muted)' }}>
        <Icon name="edit" size={16}/>
      </button>
    </div>
  );
}

export function StatRow({ km, drive, surface }) {
  return (
    <div style={{
      padding: '4px 16px 10px', display: 'flex', gap: 8,
      borderBottom: '1px solid var(--c-border)',
    }}>
      <StatChip icon="route" big={`${km}`} unit="km"/>
      <StatChip icon="clock" big={drive} unit=""/>
      <StatChip icon="mountain" big={surface} unit="" mono/>
    </div>
  );
}
export function StatChip({ icon, big, unit, mono }) {
  return (
    <div style={{
      flex: 1, padding: '6px 8px', borderRadius: 10,
      background: 'var(--c-surface-muted)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon name={icon} size={14} style={{ color: 'var(--c-text-muted)' }}/>
      <div className={mono ? 't-mono' : 't-display'} style={{ fontWeight: 700, fontSize: mono ? 11 : 14, lineHeight: 1.1, color: 'var(--c-text)' }}>
        {big}{unit && <span style={{ color: 'var(--c-text-muted)', fontWeight: 500, fontSize: 10, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

// Single stop row
// SPINE_COL_W is the shared timeline column used by StopRow + LegRow so the
// continuous vertical line lands in the exact same x-coordinate on every row.
// Don't change without also updating LegRow.
const SPINE_COL_W = 20;

export function StopRow({ stop, index, isLast, onAction, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stop.name);

  const isStart = stop.kind === 'start';
  const isEnd = stop.kind === 'end';
  const isWp = stop.kind === 'wp';

  // Marker palette: start = green pin, end = red pin, waypoint = hollow ring on accent.
  const dotFill = isStart ? 'var(--c-success)' : isEnd ? 'var(--c-danger)' : 'var(--c-surface)';
  const dotRing = isStart || isEnd ? dotFill : 'var(--c-accent)';
  const dotSize = isWp ? 12 : 14;

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'stretch', gap: 10,
      padding: '2px 4px',
    }}>
      {/* drag handle - hint only, real reorder lives in StopActionsSheet */}
      <div style={{
        width: 18, alignSelf: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text-muted)', cursor: 'grab', opacity: 0.45,
      }}>
        <Icon name="drag" size={14} stroke={1.6}/>
      </div>

      {/* time pill - typographic anchor on the left */}
      <div className="t-mono t-num" style={{
        minWidth: 46, alignSelf: 'center',
        padding: '6px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-surface-muted)', borderRadius: 8,
        fontSize: 12, fontWeight: 700, color: 'var(--c-text)',
        letterSpacing: -0.2, lineHeight: 1,
      }}>
        {stop.time}
      </div>

      {/* Timeline spine: a vertical line that runs the full row height with
          the marker dot overlaid on top. The line above the first stop and
          below the last stop is clipped so the spine reads as start->end. */}
      <div style={{
        position: 'relative', width: SPINE_COL_W, alignSelf: 'stretch',
        display: 'flex', justifyContent: 'center',
      }}>
        {!isStart && (
          <div style={{
            position: 'absolute', top: 0, bottom: '50%',
            width: 2, background: 'var(--c-accent)', opacity: 0.85,
          }}/>
        )}
        {!isEnd && (
          <div style={{
            position: 'absolute', top: '50%', bottom: 0,
            width: 2, background: 'var(--c-accent)', opacity: 0.85,
          }}/>
        )}
        <div style={{
          position: 'relative', alignSelf: 'center',
          width: dotSize, height: dotSize, borderRadius: 999,
          background: dotFill,
          border: `2px solid ${dotRing}`,
          boxShadow: '0 0 0 3px var(--c-surface)',
          zIndex: 2,
        }}/>
      </div>

      {/* name + tags */}
      <div style={{ flex: 1, minWidth: 0, padding: '8px 0', alignSelf: 'center' }}>
        {editing ? (
          <input autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onRename(draft); setEditing(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(draft); setEditing(false); } }}
            style={{
              border: '1.5px solid var(--c-accent)', outline: 'none',
              background: 'var(--c-surface)', color: 'var(--c-text)',
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
              padding: '2px 6px', borderRadius: 6, width: '100%',
            }}/>
        ) : (
          <div onClick={() => { setDraft(stop.name); setEditing(true); }}
            style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--c-text)', lineHeight: 1.25,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stop.name}
          </div>
        )}
        {(isStart || isEnd || stop.fuel || stop.note) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
            overflow: 'hidden' }}>
            {isStart && <TinyTag label="Start"/>}
            {isEnd && <TinyTag label="Destination" accent/>}
            {stop.fuel && <TinyTag icon="fuel" label="Fuel"/>}
            {stop.note && <span className="t-muted" style={{ fontSize: 11, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.note}</span>}
          </div>
        )}
      </div>

      {/* action menu - explicit 44px tap target */}
      <button onClick={onAction} aria-label="Stop options" style={{
        width: 40, alignSelf: 'center', height: 40, borderRadius: 12,
        color: 'var(--c-text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="dots" size={16}/>
      </button>
    </div>
  );
}

export function TinyTag({ label, icon, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 4,
      background: accent ? 'var(--c-danger-tint)' : 'var(--c-surface-muted)',
      color: accent ? 'var(--c-danger)' : 'var(--c-text-muted)',
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
    }}>
      {icon && <Icon name={icon} size={9} stroke={2.4}/>}
      {label}
    </span>
  );
}

// Leg row between stops - rides the same spine column as StopRow so the
// vertical line reads as continuous. Info chips float on the right.
export function LegRow({ leg, onAddBetween }) {
  const surfaceColor = leg.surface === 'sealed' ? 'var(--c-success)'
                     : leg.surface === 'sand' ? 'var(--c-cat-solar)'
                     : leg.surface === 'corrugated' ? 'var(--c-sev-moderate)'
                     : 'var(--c-text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 10,
      padding: '0 4px',
      position: 'relative', minHeight: 30,
    }}>
      {/* gutter widths match StopRow exactly: drag(18) + gap(10) + time(46) */}
      <div style={{ width: 18 }}/>
      <div style={{ minWidth: 46 }}/>

      {/* spine column - continuous line through the row */}
      <div style={{
        position: 'relative', width: SPINE_COL_W, alignSelf: 'stretch',
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          width: 2, background: 'var(--c-accent)', opacity: 0.85,
          alignSelf: 'stretch',
        }}/>
      </div>

      {/* leg info row - distance, time, surface, optional fuel-gap warning */}
      <div style={{
        flex: 1, minWidth: 0, padding: '5px 0',
        display: 'flex', alignItems: 'center', gap: 6,
        flexWrap: 'wrap',
      }}>
        <span className="t-mono t-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>
          {leg.km}km
        </span>
        <span style={{ opacity: 0.35, fontSize: 11 }}>·</span>
        <span className="t-mono t-num" style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
          {Math.floor(leg.min/60)}h {(leg.min%60).toString().padStart(2,'0')}
        </span>
        <span style={{ opacity: 0.35, fontSize: 11 }}>·</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: surfaceColor,
          textTransform: 'uppercase', letterSpacing: 0.3 }}>{leg.surface}</span>
        {leg.warn === 'fuelgap' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 6px', borderRadius: 999,
            background: 'var(--c-warn-bg)', color: 'var(--c-warn-text)',
            fontWeight: 700, fontSize: 10, letterSpacing: 0.2,
          }}>
            <Icon name="fuel" size={9} stroke={2.4}/> 124km between fuel
          </span>
        )}
      </div>

      {/* +-between - compact, lives on the right edge */}
      <button onClick={onAddBetween} aria-label="Add stop between" style={{
        width: 26, height: 26, borderRadius: 999,
        background: 'var(--c-surface-muted)', color: 'var(--c-text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        alignSelf: 'center',
        opacity: 0.85, flexShrink: 0,
      }}>
        <Icon name="plus" size={12} stroke={2.4}/>
      </button>
    </div>
  );
}

export function FuelStrip({ state, onClick }) {
  return (
    <div style={{ padding: '8px 12px 4px' }}>
      <FuelSummary state={state} onClick={onClick}/>
    </div>
  );
}

export function FooterRail({ tier, onInvite, onUpgrade }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 14px 12px', gap: 10,
      background: 'var(--c-surface-muted)',
    }}>
      <button onClick={onInvite} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--c-text)', fontWeight: 600, fontSize: 12, minHeight: 32 }}>
        <Icon name="invite" size={14} stroke={2}/> Invite travelers
      </button>
      {tier === 'free' && (
        <button onClick={onUpgrade} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 999, minHeight: 32,
          background: 'var(--grad-cta)', color: 'white',
          fontWeight: 700, fontSize: 11,
        }}>
          <Icon name="crown" size={12} stroke={2.2}/> Glovebox Pro
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STOP ACTIONS SHEET — opened from kebab on any stop
// ─────────────────────────────────────────────────────────────
export function StopActionsSheet({ stop, onClose, onUpdate, onRemove }) {
  if (!stop) return null;
  const [time, setTime] = useState(stop.time);
  const [fuel, setFuel] = useState(stop.fuel);
  return (
    <BottomSheet open onClose={onClose} title={stop.name}>
      <div style={{ marginBottom: 8 }}>
        <TinyTag label={stop.kind === 'start' ? 'Start' : stop.kind === 'end' ? 'Destination' : `Waypoint ${stop.id}`} accent={stop.kind === 'end'}/>
      </div>

      <div className="t-mono t-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 6 }}>
        Schedule
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <SheetField label="Arrive" value={time} onChange={setTime}/>
        <SheetField label="Depart" value={addMin(time, 35)} onChange={() => {}}/>
      </div>

      <div className="t-mono t-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 6 }}>
        Stop options
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 14,
        background: 'var(--c-surface-muted)', borderRadius: 14, overflow: 'hidden' }}>
        <ActionRow icon="fuel"  label="Fuel stop"        value={fuel ? 'On' : 'Off'} onClick={() => setFuel(f => !f)} toggle on={fuel}/>
        <ActionRow icon="cluster" label="Replace with nearby" sub="3 alternatives within 5 km"/>
        <ActionRow icon="edit"  label="Rename"            sub={stop.name}/>
        <ActionRow icon="route" label="Re-route via this stop" sub="recalculate from here"/>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { onUpdate({ ...stop, time, fuel }); onClose(); }}
          style={{ flex: 1, minHeight: 48, borderRadius: 12,
            background: 'var(--c-accent)', color: 'white', fontWeight: 700, fontSize: 14 }}>
          Save changes
        </button>
        {stop.kind !== 'start' && stop.kind !== 'end' && (
          <button onClick={() => { onRemove(); onClose(); }}
            style={{
              minHeight: 48, padding: '0 14px', borderRadius: 12,
              background: 'var(--c-error-bg)', color: 'var(--c-error-text)',
              fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Icon name="trash" size={14}/> Remove
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
export function SheetField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 12,
      background: 'var(--c-surface-muted)' }}>
      <div className="t-mono" style={{ fontSize: 9, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} style={{
        border: 'none', background: 'transparent', outline: 'none',
        fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--c-text)',
        width: '100%', padding: '2px 0', marginTop: 2,
      }}/>
    </div>
  );
}
export function ActionRow({ icon, label, sub, value, toggle, on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', minHeight: 52, padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'transparent', textAlign: 'left',
    }}>
      <Icon name={icon} size={18} style={{ color: 'var(--c-text-muted)' }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{label}</div>
        {sub && <div className="t-muted" style={{ fontSize: 11 }}>{sub}</div>}
      </div>
      {value && <span style={{ fontSize: 12, fontWeight: 700, color: on ? 'var(--c-accent)' : 'var(--c-text-muted)' }}>{value}</span>}
      {toggle && (
        <div style={{
          width: 36, height: 20, borderRadius: 999,
          background: on ? 'var(--c-accent)' : 'var(--c-border-strong)',
          position: 'relative', transition: 'background 0.15s ease',
        }}>
          <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2,
            width: 16, height: 16, borderRadius: 999, background: 'white',
            transition: 'left 0.15s ease' }}/>
        </div>
      )}
      {!toggle && !value && <Icon name="chev" size={14} style={{ color: 'var(--c-text-muted)' }}/>}
    </button>
  );
}
export function addMin(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24, nm = total % 60;
  return `${nh.toString().padStart(2,'0')}:${nm.toString().padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
// NAV MODE — Right-side well: pills + compass + controls in one panel
// Single grouped visual unit, never overlaps cards.
// ─────────────────────────────────────────────────────────────
export function NavRail({ tweaks, muted, onMute, onLayers, layerMenuOpen }) {
  const fuelColor =
    tweaks.fuelState === 'critical' ? 'var(--c-danger)' :
    tweaks.fuelState === 'warning' ? 'var(--c-cat-solar)' :
    'var(--c-success)';
  const fuelLabel =
    tweaks.fuelState === 'critical' ? '38' :
    tweaks.fuelState === 'warning' ? '184' : '184';
  return (
    <div style={{
      position: 'absolute', right: 12, top: 200, zIndex: 12,
      width: 60,
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 18,
      boxShadow: 'var(--sh-floating)',
      overflow: 'visible',
    }}>
      {/* Pills group */}
      <div style={{ padding: '8px 6px 6px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <RailPillStat icon="wifi" label={tweaks.networkState === 'corridor' ? 'CACH' : tweaks.networkState.slice(0,4).toUpperCase()}
          color="var(--c-success)" sub={tweaks.networkState === 'corridor' ? 'corr' : tweaks.networkState}/>
        <RailPillStat icon="fuel" label={fuelLabel} color={fuelColor} sub="km"/>
        <CompassMini/>
      </div>
      <div style={{ height: 1, background: 'var(--c-border)', margin: '0 10px' }}/>
      {/* Controls group */}
      <div style={{ padding: 2 }}>
        <RailBtn icon={muted ? 'mute' : 'speaker'} label={muted ? 'MUTED' : 'AUDIO'} onClick={onMute}/>
        <Divider2/>
        <RailBtn icon="layers" label="LAYERS" onClick={onLayers} active={layerMenuOpen}/>
      </div>
    </div>
  );
}
export function Divider2() {
  return <div style={{ height: 1, background: 'var(--c-border)', margin: '0 10px' }}/>;
}
export function RailPillStat({ icon, label, sub, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 1, padding: '4px 0', width: '100%',
    }}>
      <Icon name={icon} size={14} style={{ color }} stroke={2.2}/>
      <div className="t-mono t-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>{label}</div>
      <div className="t-mono" style={{ fontSize: 8, color: 'var(--c-text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{sub}</div>
    </div>
  );
}
export function CompassMini() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 0' }}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="none" stroke="var(--c-border-strong)" strokeWidth="1"/>
        <path d="M10 2 L13 10 L10 8 L7 10 Z" fill="var(--c-danger)"/>
        <path d="M10 18 L13 10 L10 12 L7 10 Z" fill="var(--c-text-muted)"/>
      </svg>
      <div className="t-mono t-num" style={{ fontSize: 11, fontWeight: 700 }}>164°</div>
      <div className="t-mono" style={{ fontSize: 8, color: 'var(--c-text-muted)', letterSpacing: 0.4 }}>SSE</div>
    </div>
  );
}
export function RailBtn({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: '100%', minHeight: 48,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: active ? 'var(--c-accent-tint)' : 'transparent',
      color: active ? 'var(--c-accent)' : 'var(--c-text)',
      borderRadius: 14,
      gap: 0,
    }}>
      <Icon name={icon} size={18} stroke={2}/>
      <div className="t-mono" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
        color: active ? 'var(--c-accent)' : 'var(--c-text-muted)', marginTop: 2 }}>{label}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// NAV MODE — Next-stop card with AI POIs. Tap → popover with options.
// Fixed height so it never pushes the layout around.
// ─────────────────────────────────────────────────────────────
const AI_POIS_FOR_NEXT_STOP = [
  { id: 'bigred',      name: 'Big Red Dune climb', off: '+8 min', map: { x: 0.32, y: 0.36 } },
  { id: 'mungerannie', name: 'Old Coach Rd ruins', off: '+4 min', map: { x: 0.42, y: 0.42 } },
];

export function NextStopCard({ open, onToggle, onSkip, onView }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Popover with options (floats above the card, doesn't expand it) */}
      {open && (
        <>
          <div onClick={onToggle} style={{ position: 'absolute', inset: 0, transform: 'translateY(-160px)', height: 160, width: '100%' }}/>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 8,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 14,
            boxShadow: 'var(--sh-floating)',
            padding: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'slide-up 0.18s ease',
            zIndex: 1,
          }}>
            <PopoverOption icon="eye" label="View Cordillo Downs" sub="hours · amenities · photo"
              onClick={() => { onView && onView(); onToggle(); }}/>
            <PopoverOption icon="route" label="Skip · go straight to Cameron Corner" sub="+34 km · save 0h 32m"
              onClick={() => { onSkip && onSkip(); onToggle(); }}/>
          </div>
        </>
      )}

      <div style={{
        background: 'var(--c-nav-card)',
        borderRadius: 14,
        border: '1px solid var(--c-border)',
        boxShadow: 'var(--sh-card)',
        overflow: 'hidden',
      }}>
        <button onClick={onToggle} style={{
          width: '100%', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="pin" size={16}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-mono" style={{ fontSize: 9, color: 'var(--c-text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Next stop · 1h 42m · 142km
            </div>
            <div style={{ fontWeight: 700, fontSize: 14,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Cordillo Downs
            </div>
          </div>
          <Icon name="chevDown" size={14} style={{ color: 'var(--c-text-muted)',
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}/>
        </button>

        {/* AI POI chips along the way — always visible inline */}
        <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px', flexWrap: 'wrap' }}>
          {AI_POIS_FOR_NEXT_STOP.map(p => (
            <div key={p.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 8px', borderRadius: 999,
              background: 'var(--c-accent-tint)', color: 'var(--c-accent)',
              fontSize: 11, fontWeight: 700,
            }}>
              <Icon name="sparkle" size={10} stroke={2.4}/>
              {p.name}
              <span style={{ opacity: 0.7 }}>{p.off}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PopoverOption({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '10px 8px', borderRadius: 10,
      background: 'transparent', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--c-surface-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text)' }}>
        <Icon name={icon} size={16}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div className="t-mono" style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{sub}</div>
      </div>
      <Icon name="chev" size={14} style={{ color: 'var(--c-text-muted)' }}/>
    </button>
  );
}

