"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cx, faNum } from "@/lib/format";
import { usePresence } from "@/lib/hooks";
import { useIsMac } from "@/lib/keymap";
import { useStore } from "@/state/store";
import { Button } from "../../ui/button";
import { closePalette } from "../command/palette-store";
import { stopTour, tourOrigin, useTourActive } from "./tour-store";

/*
 * Guided spotlight tour «راهنمای استفاده». A fixed "hole" glides from anchor to
 * anchor ([data-tour=…]) while its spread shadow dims the rest of the page; a
 * coach card sits next to it. The page stays usable inside the hole, a
 * transparent blocker (clipped around the hole) swallows clicks on the dim area.
 */

type StepId = "samples" | "composer" | "mode" | "model" | "palette" | "theme";
/** `touch`: the same idea without keyboard talk, for phones and tablets */
type Step = { id: StepId; title: string; body: string; touch?: string };

const STEPS: Step[] = [
  { id: "samples", title: "پرسش‌های نمونه", body: "با یک کلیک یک پرسش واقعی در کادر پرسش قرار می‌گیرد." },
  {
    id: "composer",
    title: "کادر پرسش",
    body: "پرسش را بنویسید؛ Enter ارسال و Shift+Enter خط جدید. هنگام پاسخ‌دهی می‌توانید پرسش بعدی را در صف بگذارید یا با Esc پاسخ را متوقف کنید.",
    touch: "پرسش را بنویسید و ارسال کنید. هنگام پاسخ‌دهی می‌توانید پرسش بعدی را در صف بگذارید یا پاسخ را متوقف کنید.",
  },
  {
    id: "mode",
    title: "حالت بازیابی",
    body: "در حالت خودکار، سامانه اسناد مرتبط را خودش تشخیص می‌دهد؛ در حالت دستی دامنه جستجو را محدود کنید.",
  },
  { id: "model", title: "مدل و عمق جستجو", body: "مدل هوش مصنوعی و تعداد بندهای بازیابی‌شده را از اینجا تنظیم کنید." },
  {
    id: "palette",
    title: "جستجو و فرمان‌ها",
    body: "با Ctrl+K به همه‌چیز دسترسی دارید — حتی با صفحه‌کلید فارسی.",
    touch: "همه فرمان‌ها، اسناد و پرسش‌های نمونه از همین‌جا در دسترس‌اند.",
  },
  { id: "theme", title: "پوسته", body: "چهار پوسته رنگی؛ تغییر پوسته با انیمیشن دایره‌ای انجام می‌شود." },
];

const PAD = 6; // hole padding around the target
const RING = 2; // the accent ring is drawn outside the hole
const GAP = 12; // hole ↔ card
const EDGE = 12; // min distance from the viewport edges
const GLIDE_MS = 380;
const EXIT_MS = 180;
// a drawer/sidebar we just closed must be fully gone before anchors are resolved
// (its 300ms exit starts a render after ours, so leave some slack)
const SETTLE_MS = 420;
const DONE_KEY = "danesh-yar:tour-done";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Visible, laid-out and on-canvas (a parked or collapsed panel doesn't count). */
function usable(el: HTMLElement): boolean {
  if (!el.isConnected || el.closest("[inert]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1 || r.right <= 0 || r.left >= window.innerWidth) return false;
  if (typeof el.checkVisibility === "function")
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
  return true;
}

function findTarget(id: StepId): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) if (usable(el)) return el;
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

export function Tour() {
  const active = useTourActive();
  const { mounted, closing } = usePresence(active, EXIT_MS);
  // a restart during the exit fade gets a fresh run
  const [run, setRun] = useState(0);
  const [prev, setPrev] = useState(active);
  if (prev !== active) {
    setPrev(active);
    if (active) setRun((n) => n + 1);
  }
  if (!mounted) return null;
  return <TourRun key={run} closing={closing} />;
}

function TourRun({ closing }: { closing: boolean }) {
  const { state, set, closeModal, closePopover, toast } = useStore();
  /** null while resolving; [] means no anchor is visible at this size */
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [glide, setGlide] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const isMac = useIsMac();
  // the tour only mounts on the client, so the media query is safe to read here
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const titleId = useId();
  const bodyId = useId();

  const i = steps ? Math.min(index, Math.max(steps.length - 1, 0)) : 0;
  const step = steps?.[i];
  const n = steps?.length ?? 0;
  const last = i === n - 1;

  // clear the stage (nothing may cover the anchors), then resolve the steps
  useEffect(() => {
    // captured at launch: by now a launching menu item has already unmounted
    restore.current = tourOrigin();
    closePalette();
    if (state.modal) closeModal();
    if (state.popover) closePopover();
    let settle = 0;
    // read the width directly: useBreakpoint() would still report its "desktop" default on this first render
    const w = window.innerWidth;
    if (w < 768 && state.drawerOpen) {
      set({ drawerOpen: false });
      settle = SETTLE_MS;
    }
    if (w >= 768 && w < 1024 && state.sidebarExpanded) {
      set({ sidebarExpanded: false });
      settle = SETTLE_MS;
    }
    const t = setTimeout(() => setSteps(STEPS.filter((s) => findTarget(s.id))), settle);
    return () => clearTimeout(t);
    // run once per tour
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the stream stop hotkey stands down while the tour owns Escape
  useEffect(() => {
    if (closing) return;
    const html = document.documentElement;
    html.dataset.tourActive = "";
    return () => {
      delete html.dataset.tourActive;
    };
  }, [closing]);

  // every anchor vanished mid-tour (e.g. resized to mobile): nothing left to show
  useEffect(() => {
    if (steps && steps.length === 0 && box) stopTour();
  }, [steps, box]);

  const measure = useCallback(() => {
    if (!steps || !step) return;
    // anchors can go away mid-tour (the welcome after a question, a collapsed sidebar): drop those
    // steps so the «مرحله n از m» count stays true, and keep pointing at the same step (or the next one)
    const kept = steps.filter((s) => (s === step && target.current && usable(target.current)) || findTarget(s.id));
    if (kept.length !== steps.length) {
      const at = steps.indexOf(step);
      setSteps(kept);
      setIndex(steps.slice(0, at).filter((s) => kept.includes(s)).length);
      if (!kept.includes(step)) {
        target.current = null;
        return;
      }
    }
    let el = target.current;
    if (!el || !usable(el)) el = findTarget(step.id);
    if (!el) return;
    target.current = el;
    const r = el.getBoundingClientRect();
    // padded, but pulled in at the viewport edges so the ring is never cut off (the sidebar's mode picker)
    const x1 = Math.max(r.left - PAD, RING);
    const y1 = Math.max(r.top - PAD, RING);
    const x2 = Math.min(r.right + PAD, window.innerWidth - RING);
    const y2 = Math.min(r.bottom + PAD, window.innerHeight - RING);
    const next = { x: x1, y: y1, w: Math.max(x2 - x1, 0), h: Math.max(y2 - y1, 0) };
    setBox((b) => (b && b.x === next.x && b.y === next.y && b.w === next.w && b.h === next.h ? b : next));
  }, [steps, step]);

  // one measurement per frame on scroll (any scroller), resize and target resize
  const measureRef = useRef(measure);
  useLayoutEffect(() => {
    measureRef.current = measure;
  }, [measure]);
  const frame = useRef(0);
  const schedule = useCallback(() => {
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        measureRef.current();
      });
  }, []);
  useEffect(() => {
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      cancelAnimationFrame(frame.current);
    };
  }, [schedule]);

  // entering a step: bring the target into view, glide the hole to it, watch its size
  // (layout effect, so the new card never paints against the previous target)
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.id);
    target.current = el;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    if (!el) return;
    let t = 0;
    if (placed.current) {
      setGlide(true);
      t = window.setTimeout(() => setGlide(false), GLIDE_MS + 40);
    }
    placed.current = true;
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [step, measure, schedule]);

  // coach card: below the target, flipped above when there's no room, aligned to its inline start (right)
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !box) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const below = box.y + box.h + GAP;
    const above = box.y - GAP - h;
    let top: number;
    if (below + h <= vh - EDGE) top = below;
    else if (above >= EDGE) top = above;
    else top = vh - box.y - box.h > box.y ? below : above; // neither fits: the roomier side
    card.style.top = `${clamp(top, EDGE, vh - EDGE - h)}px`;
    card.style.left = `${clamp(box.x + box.w - w, EDGE, vw - EDGE - w)}px`;
    // step: a remounted card (a dropped step) must be placed even when the box didn't move
  }, [box, i, step]);

  // focus follows the card so Enter/Space/arrows work straight away
  const shown = steps !== null && (n === 0 || box !== null);
  useEffect(() => {
    if (shown && !closing) nextRef.current?.focus({ preventScroll: true });
  }, [shown, step, closing]);

  // hand focus back to where the user was
  useEffect(() => {
    if (!closing) return;
    const el = restore.current;
    if (el?.isConnected && (!document.activeElement || document.activeElement === document.body || cardRef.current?.contains(document.activeElement)))
      el.focus({ preventScroll: true });
  }, [closing]);

  const go = useCallback((d: 1 | -1) => setIndex(Math.max(0, i + d)), [i]);
  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // storage blocked: the tour simply isn't remembered
    }
    stopTour();
    toast("success", "آماده‌اید! یک پرسش نمونه را امتحان کنید");
  }, [toast]);
  const next = useCallback(() => (last ? finish() : go(1)), [last, finish, go]);

  // Esc closes; ← next / → previous (RTL), unless a field or another layer has the key
  useEffect(() => {
    if (closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        stopTour();
        return;
      }
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as Node | null;
      if (!(t === document.body || (t && cardRef.current?.contains(t)))) return;
      e.preventDefault();
      // arrows only walk the steps; finishing takes a deliberate «پایان» (a held key must not end the tour)
      if (e.key === "ArrowLeft") {
        if (!last) go(1);
      } else if (i > 0) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closing, last, go, i]);

  if (!steps) return null;

  const layer = cx("fixed inset-0 z-[60]", closing ? "tour-out pointer-events-none" : "tour-in pointer-events-none");
  const card = "pointer-events-auto absolute w-[300px] max-w-[calc(100vw-24px)] animate-pop-in rounded-[12px] bg-surface p-4 shadow-modal";

  // no anchor at this size: a single centred note
  if (n === 0) {
    return (
      <div className={layer}>
        <div aria-hidden className="pointer-events-auto absolute inset-0 tour-dim" onMouseDown={(e) => e.preventDefault()} />
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={cx(card, "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2")}
        >
          <h2 id={titleId} className="m-0 text-[14.5px] font-semibold">
            راهنمای استفاده
          </h2>
          <p id={bodyId} className="mt-1.5 mb-0 text-[12.5px] leading-[1.85] text-fg/65">
            راهنما در این اندازه صفحه محدود است
          </p>
          <div className="mt-4 flex justify-end">
            <Button ref={nextRef} size="sm" variant="primary" onClick={stopTour}>
              متوجه شدم
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!step || !box) return null;
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;

  return (
    <div className={layer}>
      {/* swallows clicks on the dim area; the evenodd hole keeps the target clickable */}
      <div
        aria-hidden
        className={cx("absolute inset-0", !closing && "pointer-events-auto")}
        style={{
          clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.x}px ${box.y}px, ${x2}px ${box.y}px, ${x2}px ${y2}px, ${box.x}px ${y2}px, ${box.x}px ${box.y}px)`,
        }}
        onMouseDown={(e) => e.preventDefault()}
      />
      <div
        aria-hidden
        data-glide={glide || undefined}
        className="tour-hole"
        style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
      />

      <div
        key={step.id}
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={card}
        // while the hole glides, the card waits a beat so both land together
        style={glide ? { animationDelay: "160ms", animationFillMode: "backwards" } : undefined}
      >
        <div className="text-[11px] font-medium text-accent-fg/75">
          مرحله {faNum(i + 1)} از {faNum(n)}
        </div>
        <h2 id={titleId} className="mt-1 mb-1.5 text-[14.5px] leading-normal font-semibold">
          {step.title}
        </h2>
        <p id={bodyId} className="m-0 text-[12.5px] leading-[1.85] text-pretty text-fg/65">
          {touch && step.touch ? step.touch : isMac ? step.body.replace("Ctrl+K", "⌘K") : step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={stopTour}
            className="me-auto -mx-1 rounded-md px-1 py-0.5 text-[12px] text-fg/50 transition-colors duration-150 hover:text-fg/85"
          >
            رد کردن
          </button>
          <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => go(-1)}>
            قبلی
          </Button>
          <Button ref={nextRef} size="sm" variant="primary" onClick={next} aria-keyshortcuts={last ? undefined : "ArrowLeft"}>
            {last ? "پایان" : "بعدی"}
          </Button>
        </div>
      </div>
    </div>
  );
}
