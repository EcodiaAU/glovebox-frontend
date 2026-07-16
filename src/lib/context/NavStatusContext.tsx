import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Is the driver in turn-by-turn right now?
 *
 * `activeNav.isActive` lives in the trip page, but the things that must react to
 * it - the shell control rail and the Friend drawer - are mounted ABOVE it in
 * AppLayout, so they cannot see it. That is how a Friend chat drawer and three
 * shell buttons ended up sitting on the maneuver card at 100km/h: nothing at
 * shell scope had any idea the app was navigating.
 *
 * Deliberately a context rather than another `<html>` data-attribute. The
 * existing data-attr trick (data-desktop-panel-open) is fine for pure styling,
 * but this has to UNMOUNT the Friend drawer, not just hide it - a display:none
 * drawer is still focusable, still animating, still one stray tab-key from being
 * back on screen while someone is driving.
 */
interface NavStatusValue {
  /** True while navigating / off-route / rerouting. */
  navActive: boolean;
  setNavActive: (v: boolean) => void;
}

const NavStatusContext = createContext<NavStatusValue | null>(null);

export function NavStatusProvider({ children }: { children: ReactNode }) {
  const [navActive, setNavActive] = useState(false);
  const value = useMemo(() => ({ navActive, setNavActive }), [navActive]);
  return <NavStatusContext.Provider value={value}>{children}</NavStatusContext.Provider>;
}

/**
 * Safe outside the provider: returns navActive=false and a no-op setter, so a
 * component that renders on a route without the provider (login, embed) does not
 * explode. Reads as "not navigating", which is the correct default.
 */
export function useNavStatus(): NavStatusValue {
  return useContext(NavStatusContext) ?? { navActive: false, setNavActive: () => {} };
}
