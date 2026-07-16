import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Z, RAIL, RAIL_SLOT_ID } from "@/lib/ui/layers";

/**
 * Docks a map control into the shared top-right rail (see ShellControls).
 *
 * Anything wrapped in this becomes a sibling of the Places/SOS/Settings row in
 * one flex column, which is the whole point: siblings in a column cannot overlap
 * each other, so the class of bug where the layer switcher (top:108) and the
 * report FAB (top:116) landed on top of each other is gone by construction
 * rather than by a corrected offset.
 *
 * A portal keeps the React tree intact - the control still lives inside the map
 * component, keeps its state, context and handlers, and only its DOM position
 * moves. That matters for the layer dropdown, which anchors to its button.
 *
 * Fallback: on routes that render a map but no rail (/embed hides the shell
 * controls entirely), there is nothing to dock into. Rather than silently
 * dropping the control, position it where the rail would have been. /embed keeps
 * its layer switcher.
 */
export function RailSlot({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Resolved after mount, not during render: ShellControls renders the slot in
    // the same commit, so the node does not exist in the DOM yet at render time.
    setSlot(document.getElementById(RAIL_SLOT_ID));
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (slot) return createPortal(children, slot);

  return (
    <div
      style={{
        position: "absolute",
        top: `calc(env(safe-area-inset-top, 0px) + ${RAIL.TOP}px)`,
        right: RAIL.RIGHT,
        zIndex: Z.RAIL,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: RAIL.GAP,
      }}
    >
      {children}
    </div>
  );
}
