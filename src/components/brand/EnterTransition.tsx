/**
 * The front-door enter animation, mounted once at the app root (inside
 * BrowserRouter, outside Routes) so it survives the React Router navigation.
 *
 * EnterSphere dispatches a 'gl-enter' event with the sphere's centre + size +
 * target. This one persistent cream overlay grows from the sphere to fill the
 * screen, routes into the app, HOLDS full-screen cream until the destination
 * route actually commits (watched via useLocation, covering the whole lazy load
 * with no flash of the landing), then FADES out to reveal the destination. For a
 * store/off-app target it grows then hands off to the URL. Event-driven, so it
 * never fires on a normal visit; honours prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const CREAM = '#E8DFC9';

interface Box {
  cx: number;
  cy: number;
  size: number;
  scale: number;
}

export function EnterTransition() {
  const navigate = useNavigate();
  const location = useLocation();
  const [box, setBox] = useState<Box | null>(null);
  const [grown, setGrown] = useState(false);
  const [faded, setFaded] = useState(false);
  const activeRef = useRef(false);
  const originRef = useRef('');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const reset = () => {
    activeRef.current = false;
    clearTimers();
    setBox(null);
    setGrown(false);
    setFaded(false);
  };

  useEffect(() => {
    function onEnter(e: Event) {
      const d = (e as CustomEvent<{ cx: number; cy: number; size: number; href: string; external: boolean }>).detail;
      if (!d || activeRef.current) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const corners: [number, number][] = [
        [0, 0],
        [window.innerWidth, 0],
        [0, window.innerHeight],
        [window.innerWidth, window.innerHeight],
      ];
      const maxDist = Math.max(...corners.map(([x, y]) => Math.hypot(x - d.cx, y - d.cy)));
      const scale = (maxDist * 2) / d.size + 1.6;

      if (d.external) {
        if (reduce) {
          window.location.href = d.href;
          return;
        }
        activeRef.current = true;
        setFaded(false);
        setGrown(false);
        setBox({ cx: d.cx, cy: d.cy, size: d.size, scale });
        requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
        clearTimers();
        timers.current = [window.setTimeout(() => { window.location.href = d.href; }, 640)];
        return;
      }

      if (reduce) {
        navigate(d.href);
        return;
      }
      activeRef.current = true;
      originRef.current = window.location.pathname;
      setFaded(false);
      setGrown(false);
      setBox({ cx: d.cx, cy: d.cy, size: d.size, scale });
      requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
      clearTimers();
      timers.current = [
        window.setTimeout(() => navigate(d.href), 560),
        // safety: never hold the cream forever if the commit signal is missed
        window.setTimeout(() => {
          setFaded(true);
          timers.current.push(window.setTimeout(reset, 740));
        }, 4500),
      ];
    }
    window.addEventListener('gl-enter', onEnter as EventListener);
    return () => {
      window.removeEventListener('gl-enter', onEnter as EventListener);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Once the route has left the landing (any destination, including a /trip ->
  // /login auth redirect), give it a beat to paint under the cover, then fade
  // the cream out. Keyed on "moved off origin", NOT an exact target, so a
  // redirect past the nominal target still clears the cream.
  useEffect(() => {
    if (!activeRef.current || faded || !box) return;
    if (location.pathname === originRef.current) return;
    const t = window.setTimeout(() => {
      setFaded(true);
      timers.current.push(window.setTimeout(reset, 740));
    }, 520);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!box) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: box.cy - box.size / 2,
        left: box.cx - box.size / 2,
        width: box.size,
        height: box.size,
        borderRadius: '50%',
        background: CREAM,
        transformOrigin: 'center',
        transform: grown ? `scale(${box.scale})` : 'scale(1)',
        opacity: faded ? 0 : 1,
        transition: 'transform .68s cubic-bezier(.66,0,.34,1), opacity .6s ease',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
}
