"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { citationCounts, citedIdsSignature, countsFromSignature } from "@/lib/citations";
import { cx, faNum } from "@/lib/format";
import { useReducedMotion, type Breakpoint } from "@/lib/hooks";
import type { AssistantMessage } from "@/lib/types";
import { CiteThread, setThreadOrigin } from "./cite-thread";

type Evidence = { counts: Map<string, number>; done: boolean; animateCards: boolean };

const EvidenceCtx = createContext<Evidence | null>(null);

const HOVER_INTENT_MS = 90;
const CLEAR_DELAY_MS = 60;
const BADGES = "[data-answer-body] [data-citation]";

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
function subscribeHover(cb: () => void) {
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useCanHover() {
  return useSyncExternalStore(subscribeHover, () => window.matchMedia(HOVER_QUERY).matches, () => false);
}

/**
 * Wraps one assistant turn and threads its evidence together: citation badges
 * in the answer ↔ source cards above it. Linking is DOM-only (delegated
 * pointer/focus handlers set data-* attributes that CSS and CiteThread read),
 * so hovering never re-renders the turn. Also owns the roving tabindex over
 * the answer's badges and exposes live citation counts to the source cards.
 */
export function EvidenceScope({
  message,
  bp,
  className,
  children,
}: {
  message: AssistantMessage;
  bp: Breakpoint;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const canHover = useCanHover();
  const streaming = message.status === "streaming";
  const done = message.status === "done" && !message.stopped;

  // counts keyed on their signature: a 22ms progress tick with no new citation keeps the same Map
  const signature = citedIdsSignature(citationCounts(message.blocks, streaming ? message.reveal : undefined));
  const counts = useMemo(() => countsFromSignature(signature), [signature]);

  // cards deal in only for answers watched live, never for ones restored from history
  const [animateCards, setAnimateCards] = useState(streaming);
  if (streaming && !animateCards) setAnimateCards(true);

  const value = useMemo(() => ({ counts, done, animateCards }), [counts, done, animateCards]);

  const refIds = useMemo(() => new Set(message.refs.map((r) => r.id)), [message.refs]);

  /* ── linking (DOM only) ─────────────────────────────── */

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeId = useRef<string | null>(null);
  /**
   * A clicked citation pins its thread: it survives the pointer leaving and scrolling,
   * so the reader can scroll up and follow it to the source card. Hovering another
   * citation previews that one; leaving returns to the pin. Esc, a click elsewhere or
   * clicking the pinned citation again releases it.
   */
  const pinned = useRef<Element | null>(null);

  const clearLit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll("[data-lit]")) el.removeAttribute("data-lit");
  }, []);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    const root = rootRef.current;
    if (!root || activeId.current === null) return;
    activeId.current = null;
    clearLit();
    setThreadOrigin(root, null);
    delete root.dataset.focusFrom;
    delete root.dataset.focus;
  }, [clearLit]);

  /** keep the card in view inside the horizontal strip, without scrolling the page */
  const revealCard = useCallback(
    (id: string) => {
      const root = rootRef.current;
      const card = root?.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
      const strip = card?.closest<HTMLElement>("[data-refs-strip]");
      if (!card || !strip) return;
      const c = card.getBoundingClientRect();
      const s = strip.getBoundingClientRect();
      const fade = 28; // the strip's end edge fades out
      const rtl = getComputedStyle(strip).direction === "rtl";
      const visible = rtl ? c.left >= s.left + fade && c.right <= s.right : c.left >= s.left && c.right <= s.right - fade;
      if (visible) return;
      // land on a snap point (card start at the strip start) so scroll-snap doesn't nudge it back out
      const delta = rtl ? c.right - s.right : c.left - s.left;
      strip.scrollBy({ left: delta, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  const activate = useCallback(
    (el: Element) => {
      clearTimeout(timer.current);
      const root = rootRef.current;
      const id = el.getAttribute("data-chunk");
      if (!root || !id) return;
      const from = el.hasAttribute("data-card") ? "card" : "badge";
      if (activeId.current !== id) {
        clearLit();
        const esc = CSS.escape(id);
        for (const lit of root.querySelectorAll(`[data-chunk="${esc}"], [data-card="${esc}"]`)) lit.setAttribute("data-lit", "");
        // the card is folded behind «نمایش همه»: light that button instead
        if (refIds.has(id) && !root.querySelector(`[data-card="${esc}"]`)) {
          root.querySelector("[data-refs-more]")?.setAttribute("data-lit", "");
        }
        activeId.current = id;
      }
      setThreadOrigin(root, el);
      root.dataset.focusFrom = from;
      // re-set even when unchanged: CiteThread's MutationObserver treats it as "re-draw from here"
      root.dataset.focus = id;
      if (bp !== "desktop" && from === "badge") revealCard(id);
    },
    [bp, clearLit, refIds, revealCard],
  );

  const chunkAt = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest("[data-chunk]") : null;
    return el && rootRef.current?.contains(el) ? el : null;
  };

  /** Hover ended: fall back to the pinned citation if there is one, otherwise clear. */
  const release = useCallback(() => {
    const pin = pinned.current;
    if (!pin?.isConnected) {
      pinned.current = null;
      clear();
      return;
    }
    // already showing the pin: leave the thread (and its draw animation) alone
    if (activeId.current === pin.getAttribute("data-chunk") && rootRef.current?.dataset.focusFrom === "badge") return;
    activate(pin);
  }, [activate, clear]);

  const unpin = useCallback(() => {
    pinned.current = null;
    clear();
  }, [clear]);

  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = chunkAt(e.target);
    clearTimeout(timer.current);
    if (!el) {
      if (activeId.current !== null) timer.current = setTimeout(release, CLEAR_DELAY_MS);
      return;
    }
    timer.current = setTimeout(() => activate(el), HOVER_INTENT_MS);
  };

  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    clearTimeout(timer.current);
    if (activeId.current !== null) timer.current = setTimeout(release, CLEAR_DELAY_MS);
  };

  const onClick = (e: { target: EventTarget | null }) => {
    const el = chunkAt(e.target);
    if (!el || !el.closest("[data-answer-body]")) return;
    if (pinned.current === el) {
      unpin();
      return;
    }
    pinned.current = el;
    clearTimeout(timer.current);
    activate(el);
  };

  // a click anywhere outside the citations (and outside the citation popover) releases the pin
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      if (!pinned.current) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t && (chunkAt(t) || t.closest('[role="dialog"]'))) return;
      unpin();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [unpin]);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = chunkAt(e.target);
    if (!el) return;
    if (el.matches(BADGES)) {
      // a click or Tab onto any badge makes it the rover
      const list = [...(rootRef.current?.querySelectorAll<HTMLElement>(BADGES) ?? [])];
      const i = list.indexOf(el as HTMLElement);
      if (i >= 0) {
        rover.current = i;
        list.forEach((b, j) => (b.tabIndex = j === i ? 0 : -1));
      }
    }
    activate(el);
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!chunkAt(e.target) || chunkAt(e.relatedTarget)) return;
    release();
  };

  /* ── roving tabindex over the answer's badges ─────── */

  const rover = useRef(0);
  const hintId = `${message.id}-cite-hint`;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const list = [...root.querySelectorAll<HTMLElement>(BADGES)];
    rover.current = Math.min(rover.current, Math.max(0, list.length - 1));
    list.forEach((b, i) => {
      b.tabIndex = i === rover.current ? 0 : -1;
      b.setAttribute("aria-describedby", hintId);
    });
  }, [signature, message.status, message.blocks.length, message.reveal.block, bp, hintId]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      unpin();
      return;
    }
    const root = rootRef.current;
    const target = e.target as Element;
    if (!root || !target.matches?.(BADGES) || e.altKey || e.ctrlKey || e.metaKey) return;
    const list = [...root.querySelectorAll<HTMLElement>(BADGES)];
    const i = list.indexOf(target as HTMLElement);
    if (i < 0) return;
    // RTL: ArrowLeft moves forward through the answer
    const next =
      e.key === "ArrowLeft" ? i + 1 : e.key === "ArrowRight" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const to = Math.max(0, Math.min(list.length - 1, next));
    if (to === i) return;
    list[i].tabIndex = -1;
    list[to].tabIndex = 0;
    rover.current = to;
    list[to].focus();
  };

  /* ── orphan citations (cited, but never retrieved) ─── */

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const b of root.querySelectorAll<HTMLElement>("[data-answer-body] [data-chunk]")) {
      const id = b.getAttribute("data-chunk")!;
      if (refIds.has(id)) {
        if (b.hasAttribute("data-orphan")) {
          b.removeAttribute("data-orphan");
          b.removeAttribute("title");
        }
      } else if (!b.hasAttribute("data-orphan")) {
        b.setAttribute("data-orphan", "");
        b.title = "خارج از نتایج بازیابی";
      }
    }
  }, [signature, refIds, message.status, bp]);

  // no hover-intent timer may outlive the turn
  useEffect(() => () => clearTimeout(timer.current), []);

  /* ── one polite summary when the answer lands ──────── */

  const [prevStatus, setPrevStatus] = useState(message.status);
  const [announce, setAnnounce] = useState("");
  if (prevStatus !== message.status) {
    setPrevStatus(message.status);
    if (prevStatus === "streaming" && done && message.refs.length > 0) {
      let used = 0;
      for (const r of message.refs) if (counts.has(r.id)) used++;
      setAnnounce(`${faNum(used)} بند از ${faNum(message.refs.length)} بند بازیابی‌شده در پاسخ استناد شد`);
    }
  }

  return (
    <EvidenceCtx.Provider value={value}>
      <div
        ref={rootRef}
        data-evidence-scope
        className={cx("relative", className)}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onClickCapture={onClick}
        onFocusCapture={onFocus}
        onBlurCapture={onBlur}
        onKeyDown={onKeyDown}
      >
        {children}
        <span id={hintId} className="sr-only">
          با کلیدهای جهت بین ارجاع‌ها حرکت کنید
        </span>
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
        {bp === "desktop" && canHover && <CiteThread rootRef={rootRef} />}
      </div>
    </EvidenceCtx.Provider>
  );
}

/** Citation counts for the enclosing EvidenceScope (null outside one). */
export function useEvidence(): { counts: Map<string, number>; done: boolean; animateCards: boolean } | null {
  return useContext(EvidenceCtx);
}
