"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/**
 * Cursor spotlight for a group of cards (Linear-style). Every `[data-spot]`
 * child gets `--mx`/`--my` (pointer position relative to that child, px) and
 * `--spot` (1 while the pointer is over the group, 0 after it leaves), so the
 * glow of one card spills naturally onto its neighbours across the gaps.
 * One write per animation frame, no React state. Coordinates are physical, so
 * RTL needs no special handling. Styling lives in styles/welcome.css (`.spot`).
 */
export function useSpotlightGroup<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  onPointerMove: (e: ReactPointerEvent<T>) => void;
  onPointerLeave: () => void;
} {
  const ref = useRef<T | null>(null);
  const frame = useRef(0);
  // latest pointer position; null once the pointer has left the group
  const point = useRef<{ x: number; y: number } | null>(null);

  const paint = useCallback(() => {
    frame.current = 0;
    const root = ref.current;
    if (!root) return;
    const p = point.current;
    for (const el of root.querySelectorAll<HTMLElement>("[data-spot]")) {
      if (!p) {
        // keep the last --mx/--my so the glow fades out where it was
        el.style.setProperty("--spot", "0");
        continue;
      }
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${Math.round(p.x - r.left)}px`);
      el.style.setProperty("--my", `${Math.round(p.y - r.top)}px`);
      el.style.setProperty("--spot", "1");
    }
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      // touch and pen get no hover light (the CSS is gated to fine pointers too)
      if (e.pointerType !== "mouse") return;
      point.current = { x: e.clientX, y: e.clientY };
      schedule();
    },
    [schedule],
  );

  const onPointerLeave = useCallback(() => {
    point.current = null;
    schedule();
  }, [schedule]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { ref, onPointerMove, onPointerLeave };
}
