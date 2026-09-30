"use client";

import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "@/lib/hooks";

/** The badge/card the pointer or focus is on, per scope root (set by EvidenceScope). */
const origins = new WeakMap<Element, WeakRef<Element>>();

export function setThreadOrigin(root: Element, el: Element | null) {
  if (el) origins.set(root, new WeakRef(el));
  else origins.delete(root);
}

/** Rendered (not display:none / collapsed away) element with a real box. */
function shown(el: Element | null): el is Element {
  return !!el && el.getClientRects().length > 0;
}

/** The card for `id`, or the «نمایش همه» button when that card is folded away. */
export function threadTarget(root: Element, id: string): Element | null {
  const card = root.querySelector(`[data-card="${CSS.escape(id)}"]`);
  if (shown(card)) return card;
  const more = root.querySelector("[data-refs-more][data-lit]");
  return shown(more) ? more : null;
}

interface Thread {
  d: string;
  /** badge end */
  s: { x: number; y: number };
  /** card end */
  e: { x: number; y: number };
}

/**
 * Accent threads between a focused citation and its source card, drawn in an
 * SVG overlay that covers the EvidenceScope root. It reads the scope's
 * `data-focus` / `data-focus-from` attributes (no React state flows in), and
 * re-measures in a rAF when they change or when the root resizes (streaming
 * text, sidebar animation). The overlay scrolls with its content.
 */
export function CiteThread({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const reduced = useReducedMotion();
  const [threads, setThreads] = useState<Thread[]>([]);
  // bumped on every focus change so the draw animation replays (but not on resize)
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let refocused = false;

    const measure = () => {
      frame = 0;
      if (refocused) setSeq((n) => n + 1);
      refocused = false;
      const id = root.dataset.focus;
      const target = id ? threadTarget(root, id) : null;
      if (!id || !target) {
        setThreads((t) => (t.length ? [] : t));
        return;
      }
      const rr = root.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const e = { x: tr.left + tr.width / 2 - rr.left, y: tr.bottom - rr.top };

      const esc = CSS.escape(id);
      let badges: Element[];
      const origin = origins.get(root)?.deref();
      if (root.dataset.focusFrom === "badge" && origin?.isConnected && origin.closest("[data-answer-body]")) {
        badges = [origin];
      } else {
        badges = [...root.querySelectorAll(`[data-answer-body] [data-chunk="${esc}"]`)];
      }

      const next: Thread[] = [];
      for (const b of badges) {
        if (!shown(b)) continue;
        const br = b.getBoundingClientRect();
        const s = { x: br.left + br.width / 2 - rr.left, y: br.top - rr.top };
        if (s.y <= e.y + 4) continue; // never loop back upwards
        // control arm: 56px, shortened for close pairs so the curve never overshoots
        const c = Math.max(12, Math.min(56, (s.y - e.y) * 0.45));
        next.push({
          d:
            root.dataset.focusFrom === "badge"
              ? `M ${s.x} ${s.y} C ${s.x} ${s.y - c}, ${e.x} ${e.y + c}, ${e.x} ${e.y}`
              : `M ${e.x} ${e.y} C ${e.x} ${e.y + c}, ${s.x} ${s.y - c}, ${s.x} ${s.y}`,
          s,
          e,
        });
      }
      setThreads(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const mo = new MutationObserver(() => {
      refocused = true;
      schedule();
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-focus"] });
    const ro = new ResizeObserver(() => {
      if (root.dataset.focus) schedule();
    });
    ro.observe(root);
    schedule();

    return () => {
      mo.disconnect();
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef]);

  if (threads.length === 0) return null;
  const end = threads[0].e;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-[1] overflow-visible" width="100%" height="100%">
      <g key={seq} className={reduced ? undefined : "ev-thread"}>
        {threads.map((t, i) => (
          <g key={i}>
            <path d={t.d} pathLength={1} className="ev-thread-path" />
            <circle cx={t.s.x} cy={t.s.y} r={3} className="ev-thread-dot" />
          </g>
        ))}
        <circle cx={end.x} cy={end.y} r={7} className="ev-thread-halo" />
        <circle cx={end.x} cy={end.y} r={3} className="ev-thread-dot" />
      </g>
    </svg>
  );
}
