"use client";

import { ArrowLeft, BookmarkSimple, Brain, ChatCircleText, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/state/store";
import { closePalette } from "../command/palette-store";
import { startTour } from "./tour-store";

/** Set once the offer was answered (either way); the finished tour sets its own key. */
const OFFER_KEY = "danesh-yar:tour-offer";
const TOUR_DONE_KEY = "danesh-yar:tour-done";
/** Let the welcome screen's entrance play before asking. */
const DELAY_MS = 900;

const HIGHLIGHTS = [
  { icon: ChatCircleText, text: "پرسیدن سؤال و دیدن پاسخ مستند" },
  { icon: BookmarkSimple, text: "دنبال کردن هر ادعا تا بند مرجع" },
  { icon: MagnifyingGlass, text: "جستجو، فرمان‌ها و تنظیمات سریع" },
];

function seen(): boolean {
  try {
    return localStorage.getItem(OFFER_KEY) !== null || localStorage.getItem(TOUR_DONE_KEY) !== null;
  } catch {
    // storage blocked (private mode): don't nag on every visit
    return true;
  }
}

/**
 * First-visit invitation to the guided tour. A native <dialog> (top layer, focus
 * trap, Esc) with two choices: start the tour or skip it. Either answer is
 * remembered, so it appears once; the tour stays available in the settings menu.
 */
export function TourOffer() {
  const { state } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // decide once, after the store has restored preferences and only on an empty conversation
  const hydrated = state.hydrated;
  const empty = state.messages.length === 0;
  useEffect(() => {
    if (!hydrated || !empty || seen()) return;
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
    // the first empty, hydrated render decides; later messages don't re-trigger it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el || el.open) return;
    closePalette();
    el.showModal();
  }, [open]);

  const answer = (start: boolean) => {
    try {
      localStorage.setItem(OFFER_KEY, start ? "started" : "skipped");
    } catch {}
    ref.current?.close();
    setOpen(false);
    // after the dialog has handed focus back, so the tour starts from a clean stage
    if (start) requestAnimationFrame(() => startTour());
  };

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="tour-offer-title"
      aria-describedby="tour-offer-desc"
      // Esc ("cancel") counts as skipping
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
      // a click on the dimmed backdrop (the dialog element itself, outside the card) also skips
      onClick={(e) => {
        if (e.target === e.currentTarget) answer(false);
      }}
      className="m-auto w-[min(420px,calc(100vw-32px))] max-w-none overflow-visible bg-transparent p-0 text-fg backdrop:animate-fade-in backdrop:bg-(--backdrop) backdrop:backdrop-blur-[6px]"
    >
      {/* initial focus lands on the card itself (not a button), so no focus ring shows on open; Tab still reaches both buttons */}
      <div autoFocus tabIndex={-1} className="animate-pop-in overflow-hidden rounded-[16px] bg-surface text-center shadow-modal outline-none">
        {/* soft accent wash behind the mark */}
        <div className="bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_70%)] px-6 pt-7 pb-1 max-md:px-5">
          <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-panel text-[27px] text-accent-hi shadow-[0_0_0_1px_var(--accent-bg-2),0_0_36px_color-mix(in_oklab,var(--accent)_28%,transparent)]">
            <Brain />
          </div>
          <h2 id="tour-offer-title" className="mt-4 mb-1.5 text-[19px] leading-[1.4] font-semibold">
            به دانش‌یار خوش آمدید
          </h2>
          <p id="tour-offer-desc" className="m-0 text-[13px] leading-[1.85] text-pretty text-fg/60">
            در یک تور کوتاه، بخش‌های اصلی را با هم مرور کنیم تا سریع‌تر به پاسخ مستند برسید؟
          </p>
        </div>

        <ul className="m-0 mx-6 mt-4 flex list-none flex-col gap-1 rounded-[12px] bg-panel p-2 text-start ring-1 ring-inset ring-fg/7 max-md:mx-5">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[12.5px] text-fg/80">
              <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent/10 text-[15px] text-accent-hi">
                <Icon />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-2.5 text-[11.5px] text-fg/45">چند مرحله‌ی کوتاه · کمتر از یک دقیقه</div>

        <div className="mt-5 flex gap-2 px-6 pb-3 max-md:px-5">
          <button
            type="button"
            onClick={() => answer(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent text-[13.5px] font-semibold text-on-accent transition-colors hover:bg-accent-hi"
          >
            شروع راهنما
            <ArrowLeft weight="bold" className="text-[15px]" />
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            className="inline-flex h-11 items-center justify-center rounded-[10px] px-5 text-[13.5px] font-medium text-fg/70 ring-1 ring-inset ring-fg/14 transition-colors hover:bg-fg/6 hover:text-fg"
          >
            رد کردن
          </button>
        </div>
        <p className="m-0 px-6 pb-5 text-[11px] text-fg/40 max-md:px-5">راهنما همیشه از منوی تنظیمات در دسترس است.</p>
      </div>
    </dialog>
  );
}
