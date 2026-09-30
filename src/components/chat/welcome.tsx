"use client";

import { BookmarkSimple, Brain, Eye, Lightning } from "@phosphor-icons/react";
import { useRef, type CSSProperties } from "react";
import { cx } from "@/lib/format";
import type { Breakpoint } from "@/lib/hooks";
import { useIsMac } from "@/lib/keymap";
import { SAMPLE_QUESTIONS } from "@/lib/mock-data";
import { useDevicePixelSnap } from "@/lib/pixel-snap";
import { useSpotlightGroup } from "@/lib/spotlight";
import { withViewTransition } from "@/lib/view-transition";
import { useStore } from "@/state/store";
import { openPalette } from "../features/command/palette-store";
import { startTour } from "../features/tour/tour-store";
import { Kbd } from "../ui/primitives";

const FEATURES = [
  {
    icon: BookmarkSimple,
    title: "ارجاع مستقیم به منابع",
    text: "هر جمله کلیدی با نشان بند مرجع همراه است؛ با یک کلیک متن اصلی را ببینید.",
  },
  {
    icon: Lightning,
    title: "جستجوی هوشمند",
    text: "پیش از تولید پاسخ، سؤال بازنویسی و بندهای مرتبط از پایگاه دانش بازیابی می‌شود.",
  },
  {
    icon: Eye,
    title: "مشاهده متن منبع",
    text: "متن کامل قطعه بازیابی‌شده، همراه صفحه، بخش و امتیاز مرتبط‌بودن.",
  },
];

/** Shared-element name of the card while it flies into the composer (see styles/welcome.css). */
const MORPH = "dy-q";

const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Empty state. Each feature card pre-fills a sample question that exercises it. */
export function Welcome({ bp, onPick }: { bp: Breakpoint; onPick: (q: string) => void }) {
  const mobile = bp === "mobile";
  const isMac = useIsMac();
  // every tour anchor (incl. the sidebar's mode picker) is on screen only on a desktop with the sidebar open
  const { sidebarExpanded } = useStore().state;
  const fullTour = bp === "desktop" && sidebarExpanded;
  const spot = useSpotlightGroup<HTMLDivElement>();
  // every card border equally crisp at any display scaling (125%, 150%…)
  useDevicePixelSnap(spot.ref, { cols: 3, gap: 12 });
  const morphing = useRef(false);

  // the picked card flies and morphs into the composer box, so the pre-filled question explains itself
  const pick = (q: string, card: HTMLElement) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduce) return onPick(q);
    if (morphing.current) return;
    morphing.current = true;
    let box: HTMLElement | null = null;
    card.style.viewTransitionName = MORPH;
    withViewTransition(() => {
      card.style.viewTransitionName = "";
      onPick(q);
      box = document.querySelector<HTMLElement>("[data-composer-box]");
      if (box) box.style.viewTransitionName = MORPH;
    }).finally(() => {
      card.style.viewTransitionName = "";
      if (box) box.style.viewTransitionName = "";
      morphing.current = false;
    });
  };

  return (
    <div
      className={cx(
        "flex min-h-full flex-col items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklab,var(--accent)_7%,transparent),transparent_60%)]",
        // mobile is tight so the hero and all three suggestions fit a phone screen without scrolling
        mobile ? "px-4 pt-5 pb-4" : bp === "tablet" ? "px-8 py-10" : "px-16 py-10",
      )}
    >
      <div
        style={rise(0)}
        className={cx(
          "wl-rise grid place-items-center rounded-[16px] bg-panel text-accent-hi shadow-[0_0_0_1px_var(--accent-bg-2),0_0_40px_color-mix(in_oklab,var(--accent)_18%,transparent)]",
          mobile ? "size-11 text-[21px]" : "size-14 text-[27px]",
        )}
      >
        <Brain />
      </div>
      <h1 style={rise(60)} className={cx("wl-rise mb-2 text-center leading-[1.2] font-medium", mobile ? "mt-3.5 text-[20px]" : "mt-5 text-[30px]")}>
        پاسخ دقیق، مستند به منبع
      </h1>
      <p
        style={rise(120)}
        className={cx("wl-rise m-0 max-w-[560px] text-center text-pretty text-fg/55", mobile ? "text-[13px] leading-[1.75]" : "text-[14px] leading-[1.85]")}
      >
        {mobile
          ? "پاسخ‌ها فقط بر پایه‌ی اسناد و آیین‌نامه‌ها ساخته می‌شوند و هر ادعا به بند مرجعش ارجاع دارد."
          : "سؤال خود را به فارسی بپرسید. پاسخ‌ها تنها بر پایه اسناد، آیین‌نامه‌ها و بندهای موجود در پایگاه دانش ساخته می‌شوند و هر ادعا به بند مرجع خود ارجاع می‌یابد."}
      </p>
      <div
        ref={spot.ref}
        onPointerMove={spot.onPointerMove}
        onPointerLeave={spot.onPointerLeave}
        data-tour="samples"
        className={cx("grid w-full max-w-[820px] gap-3", mobile ? "mt-5 grid-cols-1 gap-2" : "mt-8 grid-cols-3")}
      >
        {FEATURES.map((f, i) => (
          <button
            key={f.title}
            data-spot
            style={rise(180 + i * 60)}
            onClick={(e) => pick(SAMPLE_QUESTIONS[i], e.currentTarget)}
            className={cx(
              "spot wl-rise relative flex rounded-[12px] bg-panel text-start ring-1 ring-inset ring-fg/8 transition-shadow hover:ring-fg/14",
              mobile ? "items-start gap-3 px-3.5 py-3" : "flex-col gap-[9px] p-4",
            )}
          >
            <f.icon className="shrink-0 text-[19px] text-accent-hi" />
            <span className="flex flex-col gap-[9px] max-md:gap-1">
              <span className="text-[14px] font-semibold max-md:text-[13px]">{f.title}</span>
              <span className="text-[12px] leading-[1.75] text-fg/50 max-md:leading-[1.65]">{f.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div
        style={rise(180 + FEATURES.length * 60)}
        className={cx("wl-rise flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-fg/45", mobile ? "mt-5" : "mt-6")}
      >
        {!mobile && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={openPalette}
                aria-haspopup="dialog"
                className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors duration-150 hover:text-fg/80"
              >
                <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
                برای جستجو و فرمان‌ها
              </button>
            </span>
            <span aria-hidden className="h-3 w-px bg-fg/12" />
          </>
        )}
        <button
          type="button"
          onClick={startTour}
          className="-mx-1 rounded-md px-1 py-0.5 transition-colors duration-150 hover:text-accent-fg"
        >
          آشنایی سریع با دانش‌یار{fullTour && " (۶ مرحله)"}
        </button>
      </div>
    </div>
  );
}
