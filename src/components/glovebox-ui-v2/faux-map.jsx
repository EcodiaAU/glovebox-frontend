// glovebox-ui-v2/faux-map.jsx
// Stylized SVG placeholder map ported from the prototype.
// Lives alongside the new screens until MapLibre is wired in v2.
// Tate approved the prototype visual on 2026-05-19; FauxMap stays in build 30
// to ship the layout he loved. Real MapLibre slots into the same prop surface
// in a follow-up.
//
// allowJs:true + jsx:react-jsx in tsconfig - this .jsx file is type-checked
// loosely (no annotations needed). The runtime contract is the prop shape.

import { useMemo } from "react";

// Trip: Birdsville -> Cordillo Downs -> Cameron Corner -> Innamincka
const TRIP_ROUTE = [
  { x: 0.18, y: 0.20, name: "Birdsville",     kind: "start" },
  { x: 0.32, y: 0.36, name: "Big Red",        kind: "wp"    },
  { x: 0.52, y: 0.48, name: "Cordillo Downs", kind: "wp"    },
  { x: 0.62, y: 0.62, name: "Cameron Corner", kind: "wp"    },
  { x: 0.80, y: 0.78, name: "Innamincka",     kind: "end"   },
];

const POIs = [
  { x: 0.28, y: 0.30, c: "water"  },
  { x: 0.42, y: 0.42, c: "fuel"   },
  { x: 0.45, y: 0.55, c: "tent"   },
  { x: 0.58, y: 0.52, c: "solar"  },
  { x: 0.66, y: 0.55, c: "emergency" },
  { x: 0.72, y: 0.70, c: "fuel"   },
  { x: 0.78, y: 0.68, c: "tent"   },
  { x: 0.36, y: 0.28, c: "cafe"   },
  { x: 0.52, y: 0.38, c: "water"  },
  { x: 0.68, y: 0.50, c: "tent"   },
];

function buildRoutePath(pts, w, h) {
  const P = pts.map(p => ({ x: p.x * w, y: p.y * h }));
  let d = `M ${P[0].x} ${P[0].y}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i], p1 = P[i + 1];
    const dx = (p1.x - p0.x) * 0.5;
    const dy = (p1.y - p0.y) * 0.5;
    d += ` C ${p0.x + dx} ${p0.y + dy * 0.3}, ${p1.x - dx * 0.3} ${p1.y - dy}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function FauxMap({
  width = 402,
  height = 718,
  style = "terrain",
  progress = 0,
  showProgress = false,
  showCar = false,
  showGloveboxers = 0,
  clusterSize = "small",
  aiPois = [],
}) {
  const w = width, h = height;
  const path = useMemo(() => buildRoutePath(TRIP_ROUTE, w, h), [w, h]);
  const carPos = useMemo(() => {
    const t = Math.min(Math.max(progress, 0), 1);
    const seg = t * (TRIP_ROUTE.length - 1);
    const i = Math.min(Math.floor(seg), TRIP_ROUTE.length - 2);
    const f = seg - i;
    const a = TRIP_ROUTE[i], b = TRIP_ROUTE[i + 1];
    return {
      x: (a.x + (b.x - a.x) * f) * w,
      y: (a.y + (b.y - a.y) * f) * h,
      angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    };
  }, [progress, w, h]);

  const isSat = style === "satellite";
  const isStreet = style === "street";

  const bg = isSat
    ? "radial-gradient(120% 80% at 30% 30%, #4a3a26, #1a1410 70%)"
    : isStreet
    ? "linear-gradient(180deg, var(--c-surface-muted), var(--c-bg))"
    : "var(--map-bg)";

  const ridgeColor = "var(--map-ridge)";
  const clusterR = clusterSize === "small" ? 6 : 10;

  return (
    <div style={{ position: "absolute", inset: 0, background: bg, overflow: "hidden" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="rui-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.6" fill={isSat ? "rgba(255,180,100,0.06)" : "rgba(122,84,43,0.10)"}/>
          </pattern>
          <pattern id="rui-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M80 0H0V80" fill="none" stroke={isStreet ? "rgba(19,19,19,0.06)" : "transparent"} strokeWidth="1"/>
          </pattern>
        </defs>

        <rect width={w} height={h} fill="url(#rui-dots)"/>
        {isStreet && <rect width={w} height={h} fill="url(#rui-grid)"/>}

        {!isStreet && Array.from({ length: 8 }).map((_, i) => {
          const yy = 60 + i * (h - 120) / 7;
          const amp = 14 + (i % 3) * 10;
          const wig = `M -20 ${yy} Q ${w * 0.2} ${yy - amp} ${w * 0.45} ${yy} T ${w * 0.85} ${yy} T ${w + 40} ${yy - amp / 2}`;
          return <path key={i} d={wig} fill="none" stroke={ridgeColor} strokeWidth="1.2"/>;
        })}

        {!isSat && !isStreet && (
          <g opacity="0.55">
            <path d={`M -10 ${h * 0.18} Q ${w * 0.5} ${h * 0.10} ${w + 10} ${h * 0.16}`} fill="none" stroke="var(--map-ridge)" strokeWidth="1"/>
            <path d={`M -10 ${h * 0.74} Q ${w * 0.5} ${h * 0.82} ${w + 10} ${h * 0.70}`} fill="none" stroke="var(--map-ridge)" strokeWidth="1"/>
          </g>
        )}

        {isSat && (
          <g>
            <ellipse cx={w * 0.3} cy={h * 0.35} rx={w * 0.25} ry={h * 0.12} fill="rgba(60,40,20,0.6)"/>
            <ellipse cx={w * 0.65} cy={h * 0.60} rx={w * 0.30} ry={h * 0.15} fill="rgba(70,45,22,0.55)"/>
            <ellipse cx={w * 0.85} cy={h * 0.25} rx={w * 0.18} ry={h * 0.08} fill="rgba(80,55,30,0.5)"/>
          </g>
        )}

        <path d={path} fill="none" stroke="var(--map-route-cased)" strokeWidth="8" strokeLinecap="round"/>
        <path d={path} fill="none" stroke="var(--map-route)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>

        {showProgress && (
          <path
            d={path} fill="none" stroke="var(--c-success)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray="2000" strokeDashoffset={`${2000 - 2000 * progress}`}
          />
        )}

        {POIs.map((p, i) => {
          const cx = p.x * w, cy = p.y * h;
          const color =
            p.c === "water" ? "var(--c-cat-water)" :
            p.c === "fuel" ? "var(--c-accent)" :
            p.c === "tent" ? "var(--c-success-dark)" :
            p.c === "solar" ? "var(--c-cat-solar)" :
            p.c === "emergency" ? "var(--c-cat-emergency)" :
            p.c === "cafe" ? "#8a5a2b" :
            "var(--c-text)";
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={clusterR + 2} fill="var(--c-surface)" opacity="0.9"/>
              <circle cx={cx} cy={cy} r={clusterR} fill={color}/>
            </g>
          );
        })}

        {Array.from({ length: showGloveboxers }).map((_, i) => {
          const cx = (0.5 + Math.cos(i * 1.7) * 0.16) * w;
          const cy = (0.5 + Math.sin(i * 1.7) * 0.16) * h;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="14" fill="var(--c-info)" opacity="0.18">
                <animate attributeName="r" values="6;18;6" dur="2.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2.2s" repeatCount="indefinite"/>
              </circle>
              <circle cx={cx} cy={cy} r="5" fill="var(--c-info)" stroke="var(--c-surface)" strokeWidth="2"/>
            </g>
          );
        })}

        {aiPois.map((p, i) => {
          const cx = p.x * w, cy = p.y * h;
          return (
            <g key={"ai" + i}>
              <circle cx={cx} cy={cy} r="22" fill="none" stroke="var(--c-accent)" strokeWidth="2" opacity="0.55">
                <animate attributeName="r" values="14;26;14" dur="2.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <circle cx={cx} cy={cy} r="10" fill="var(--c-surface)" stroke="var(--c-accent)" strokeWidth="2.5"/>
            </g>
          );
        })}

        {TRIP_ROUTE.map((p, i) => {
          const cx = p.x * w, cy = p.y * h;
          if (p.kind === "wp") {
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="7" fill="var(--c-surface)" stroke="var(--map-route)" strokeWidth="3"/>
              </g>
            );
          }
          const isStart = p.kind === "start";
          const fill = isStart ? "var(--c-success)" : "var(--c-danger)";
          return (
            <g key={i}>
              <path d={`M ${cx} ${cy - 22} a 12 12 0 0 1 0 22 a 12 12 0 0 1 0 -22 z`} fill={fill} stroke="white" strokeWidth="2"/>
              <circle cx={cx} cy={cy - 11} r="4.5" fill="white"/>
            </g>
          );
        })}

        {showCar && (
          <g transform={`translate(${carPos.x},${carPos.y}) rotate(${carPos.angle})`}>
            <circle r="22" fill="var(--c-accent)" opacity="0.18">
              <animate attributeName="r" values="14;28;14" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle r="10" fill="var(--c-accent)" stroke="white" strokeWidth="3"/>
            <path d="M 0 -4 L 5 4 L -5 4 z" fill="white"/>
          </g>
        )}
      </svg>
    </div>
  );
}

export { TRIP_ROUTE, POIs };
