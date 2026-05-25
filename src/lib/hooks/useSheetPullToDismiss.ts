/**
 * useSheetPullToDismiss
 *
 * Bottom-sheet gesture model that matches the iOS / Apple Maps standard:
 *
 *   1. A drag handle area (the top strip of the sheet) is always
 *      grabbable for a pull-to-dismiss gesture, regardless of where the
 *      scroll content is positioned.
 *
 *   2. The scrollable body of the sheet *also* triggers the dismiss
 *      gesture - but only when the body is scrolled to its top. Once the
 *      finger is going down and `scrollTop === 0`, the scroll has nowhere
 *      else to go, so the gesture becomes a pull on the sheet. This is the
 *      behaviour Tate was asking for: at the top of a sheet, pulling down
 *      should close it.
 *
 *   3. Past `threshold` px, the sheet animates out and `onDismiss` fires.
 *      Anything less and the sheet snaps back.
 *
 * Both touch and mouse use the same code path via pointer events.
 *
 * The hook returns a sheetRef (apply to the outer sheet container that
 * should translate / dismiss) and a scrollRef (apply to the scroll body
 * that should detect at-top pulls). `handleRef` is optional and applies to
 * a dedicated drag-handle / grab strip if the sheet has one.
 */

import { useEffect, useRef } from "react";

export interface SheetPullToDismissOptions {
  /** px past start position required to trigger dismiss. Defaults to 110. */
  threshold?: number;
  /** Multiplier for the visual translate so heavy drags feel resistant. */
  damp?: number;
}

export function useSheetPullToDismiss(
  onDismiss: () => void,
  options: SheetPullToDismissOptions = {},
) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const threshold = options.threshold ?? 110;
  const damp = options.damp ?? 1;

  // Pin the latest dismiss handler so cleanup-on-rerender doesn't churn
  // the effect's listeners (which would interrupt an in-progress drag).
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    let drag: {
      startY: number;
      pointerId: number;
      engaged: boolean;
      // When the gesture starts on the scroll body, we can only engage
      // pull-to-dismiss while the body remained at scrollTop===0 since
      // pointerdown. Tracking the initial scrollTop lets us tell scroll
      // from pull cleanly without the gesture flipping mid-stream.
      fromScrollBody: boolean;
    } | null = null;

    function reset(animated: boolean) {
      sheet!.style.transition = animated ? "" : "none";
      sheet!.style.transform = "";
      // Restore default in the next frame so the inline override doesn't
      // permanently overpower the component's own transition style.
      requestAnimationFrame(() => {
        if (sheet) sheet.style.transition = "";
      });
    }

    function commitDismiss() {
      sheet!.style.transform = "translateY(120%)";
      // Match the sheet's own slide-down transition (~280ms in callers).
      setTimeout(() => onDismissRef.current(), 280);
    }

    function bind(target: HTMLElement, fromScrollBody: boolean) {
      function onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return;
        if (e.pointerType === "mouse" && fromScrollBody) {
          // Mouse users have a scrollbar; the at-top pull is mainly a
          // touch gesture. Mouse on the drag handle still works.
          return;
        }
        const scroll = scrollRef.current;
        // If the gesture starts on the scroll body and the body isn't
        // already at the top, the user is mid-scroll - don't claim this
        // gesture as a sheet pull.
        if (fromScrollBody && scroll && scroll.scrollTop > 0) return;

        drag = {
          startY: e.clientY,
          pointerId: e.pointerId,
          engaged: false,
          fromScrollBody,
        };
      }

      function onPointerMove(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const dy = e.clientY - drag.startY;

        // Upward gesture - never our concern. Yield to native scroll.
        if (dy < 0) {
          if (drag.engaged) {
            // We've been translating the sheet; revert and let scroll take over.
            reset(true);
          }
          drag = null;
          return;
        }

        if (!drag.engaged) {
          if (dy < 6) return; // dead-zone so taps don't translate the sheet

          if (drag.fromScrollBody) {
            const scroll = scrollRef.current;
            // Only engage if the scroll body is still pinned at the top.
            // Anything else means the user IS scrolling, not pulling.
            if (scroll && scroll.scrollTop > 0) {
              drag = null;
              return;
            }
          }

          drag.engaged = true;
          sheet!.style.transition = "none";
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            // Safari sometimes throws InvalidStateError when capturing a
            // pointer that's already been released. We don't need capture
            // to function - it's an optimisation for tracking the gesture
            // off-element - so swallow and continue.
          }
        }

        if (drag.engaged) {
          // Prevent the scroll body from rubber-banding while we own the gesture.
          if (e.cancelable) e.preventDefault();
          sheet!.style.transform = `translateY(${dy * damp}px)`;
        }
      }

      function onPointerUp(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const dy = e.clientY - drag.startY;
        const engaged = drag.engaged;
        drag = null;
        if (!engaged) return;

        if (dy > threshold) commitDismiss();
        else reset(true);
      }

      function onPointerCancel(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        drag = null;
        reset(true);
      }

      target.addEventListener("pointerdown", onPointerDown);
      // pointermove on the scroll target must not be passive: we need to
      // call preventDefault() once we engage, so the browser stops
      // rubber-banding the scroll content while we translate the sheet.
      target.addEventListener("pointermove", onPointerMove, { passive: false });
      target.addEventListener("pointerup", onPointerUp);
      target.addEventListener("pointercancel", onPointerCancel);
      return () => {
        target.removeEventListener("pointerdown", onPointerDown);
        target.removeEventListener("pointermove", onPointerMove);
        target.removeEventListener("pointerup", onPointerUp);
        target.removeEventListener("pointercancel", onPointerCancel);
      };
    }

    const cleanups: Array<() => void> = [];
    if (handleRef.current) cleanups.push(bind(handleRef.current, false));
    if (scrollRef.current) cleanups.push(bind(scrollRef.current, true));

    return () => { cleanups.forEach((c) => c()); };
  }, [threshold, damp]);

  return { sheetRef, scrollRef, handleRef };
}
