"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * A length that is a whole number of device pixels AND exactly representable in the
 * browser's layout units (1/64 CSS px), so layout can't round it off the pixel grid.
 * `dir` -1 rounds down (fits the available width), +1 rounds up (fits the content).
 */
function deviceLength(css: number, dpr: number, dir: -1 | 1): number {
  let k = dir < 0 ? Math.floor(css * dpr) : Math.ceil(css * dpr);
  for (let i = 0; i < 64; i++, k += dir) {
    const units = (k / dpr) * 64;
    if (Math.abs(units - Math.round(units)) < 1e-6) return Math.round(units) / 64;
  }
  return Math.round(css * 64) / 64;
}

/**
 * Keeps an equal-column grid of bordered cards on the *device* pixel grid.
 *
 * With Windows display scaling (125%, 150%…) one CSS pixel is not a whole
 * screen pixel, so a 1px border can land between pixels and render one or two
 * device pixels wide — some card edges then look thicker than others. This
 * sizes the columns and rows to whole device pixels and nudges the grid by the
 * sub-pixel remainder of its position, so every border renders identically.
 * Re-runs on resize and when the zoom / display scale changes.
 */
export function useDevicePixelSnap(ref: RefObject<HTMLElement | null>, { cols, gap }: { cols: number; gap: number }) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const snap = () => {
      frame = 0;
      const dpr = window.devicePixelRatio || 1;
      // reset, then measure the natural layout
      el.style.gridTemplateColumns = "";
      el.style.gridAutoRows = "";
      el.style.translate = "";
      const cs = getComputedStyle(el);
      const n = cs.gridTemplateColumns.split(" ").length;
      if (n !== cols) return; // stacked (mobile) layout: nothing to align side by side
      const width = el.getBoundingClientRect().width;
      const col = deviceLength((width - gap * (cols - 1)) / cols, dpr, -1);
      el.style.gridTemplateColumns = `repeat(${cols}, ${col}px)`;
      const first = el.firstElementChild as HTMLElement | null;
      if (first) el.style.gridAutoRows = `${deviceLength(first.getBoundingClientRect().height, dpr, 1)}px`;
      // centre the snapped columns in the original box, then drop the sub-pixel remainder
      const r = el.getBoundingClientRect();
      const used = col * cols + gap * (cols - 1);
      const x = r.left + (width - used) / 2;
      const dx = Math.round(x * dpr) / dpr - r.left;
      const dy = Math.round(r.top * dpr) / dpr - r.top;
      el.style.translate = `${dx}px ${dy}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(snap);
    };

    snap();
    const ro = new ResizeObserver(schedule);
    ro.observe(el.parentElement ?? el);
    let mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => {
      mq.removeEventListener("change", onDpr);
      mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", onDpr);
      schedule();
    };
    mq.addEventListener("change", onDpr);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mq.removeEventListener("change", onDpr);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, cols, gap]);
}
