"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/format";
import { useReducedMotion } from "@/lib/hooks";

/**
 * Elapsed-time counter for the running pipeline step. Ticks via rAF and writes
 * `textContent` directly, so it never re-renders React. Throttled to ~20fps
 * (4fps under reduced motion). Decorative: the step itself is announced.
 */
export function LiveMs({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const startRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Keep the origin across reduced-motion flips so the count never restarts.
    if (!startRef.current) startRef.current = performance.now();
    const start = startRef.current;
    const every = reduced ? 250 : 50;
    let last = 0;
    let raf = requestAnimationFrame(function tick(now) {
      if (now - last >= every) {
        last = now;
        el.textContent = `${Math.max(0, Math.round(now - start))}ms`;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <span ref={ref} aria-hidden className={cx("font-mono tabular-nums ltr", className)}>
      0ms
    </span>
  );
}
