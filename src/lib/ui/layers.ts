/**
 * The stacking order of the app, in one place.
 *
 * Before this file every z-index on the trip surface was a magic number written
 * at its use site, coordinated only by comments naming other components' values
 * ("above sheet (20) but below modals"). Two of those comments were already
 * wrong, and the map control rail was kept off the SOS button by a hardcoded
 * 56px geometric clearance in TripMap.tsx that a 116px offset in ClientPage.tsx
 * did not know about. The two drifted and the buttons landed on top of each
 * other.
 *
 * The rule: a component does not pick a number. It names a layer.
 *
 * Ordering intent, low to high:
 *   MAP            the canvas and anything painted into it
 *   MAP_CHROME     controls docked over the map (the rail, nav HUD, banners)
 *   SHEET          the trip sheet / desktop side panel and its action bar
 *   DRAWER         side drawers that own the screen edge (plans, Friend)
 *   MODAL          things that take the whole screen and must beat everything
 *
 * Why the rail sits BELOW the drawers: an open drawer is a modal surface. A
 * control painting on top of it reads as a rendering bug, which is exactly what
 * Places/SOS/Settings at z90 did to the Friend drawer at z70.
 *
 * Why the rail sits ABOVE the sheet: SOS has to be one tap away from anywhere,
 * always (see ShellControls). Putting it under the sheet would let an expanded
 * sheet swallow the safety control.
 */
export const Z = {
  /** MapLibre canvas + the WebGL fallback. */
  MAP: 0,
  /** Painted onto the map, under all chrome. */
  MAP_OVERLAY: 10,

  /** The trip sheet at rest, and the nav vignette. */
  SHEET: 20,
  /** The sheet's action bar, above the sheet body. */
  SHEET_ACTIONS: 22,

  /** Turn-by-turn maneuver card + bottom progress card. */
  NAV_HUD: 30,
  /** Off-route banner. Beats the HUD it replaces. */
  NAV_ALERT: 35,
  /** The nav-mode right rail (mute / recentre / layers / report). */
  NAV_RAIL: 40,

  /**
   * The one top-right control rail: Places, SOS, Settings, layers, report.
   * Everything docked there shares this single value, so nothing in the rail
   * can ever z-fight anything else in the rail.
   */
  RAIL: 45,

  /** Transient map-chrome messages (toasts, enrichment banner). */
  MAP_TOAST: 48,

  /** Desktop side panel (the sheet, re-docked at >=900px). */
  PANEL: 50,
  PANEL_ACTIONS: 51,
  /** The desktop panel's collapse chevron, which rides the panel edge. */
  PANEL_TOGGLE: 55,

  /** Edge drawers. Both own the screen edge and must beat the rail. */
  DRAWER_SCRIM: 59,
  DRAWER: 60,
  /** Friend: a drawer, one step above the plans drawer that can open under it. */
  FRIEND_SCRIM: 65,
  FRIEND: 70,

  /** Nav-mode entry flash. Brief, and covers the screen while it plays. */
  NAV_TRANSITION: 80,
  /** Connectivity truth. Outranks chrome because it explains the chrome. */
  STATUS: 100,

  /** Full-screen takeovers. */
  MODAL_SCRIM: 200,
  MODAL: 201,
} as const;

export type Layer = keyof typeof Z;

/**
 * Geometry of the top-right rail, shared by the shell buttons and the map
 * controls that portal into it. Exported so nothing has to re-derive a
 * clearance offset the way TripMap's SHELL_CONTROLS_CLEARANCE did.
 */
export const RAIL = {
  /** Distance from the safe-area top edge. */
  TOP: 8,
  /** Distance from the right edge. */
  RIGHT: 8,
  /** Gap between rail rows. */
  GAP: 8,
  /** Shell button diameter (Places / SOS / Settings). */
  BTN: 40,
  /** Map control button size (layers / report). */
  MAP_BTN: 44,
} as const;

/** DOM id of the slot inside the rail that map controls portal into. */
export const RAIL_SLOT_ID = "gb-rail-slot";
