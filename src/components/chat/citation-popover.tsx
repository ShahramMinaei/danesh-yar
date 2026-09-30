"use client";

import { ArrowSquareOut, Copy, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { fa, pct } from "@/lib/format";
import { copyText, useDismiss } from "@/lib/hooks";
import { chunkById } from "@/lib/mock-data";
import { useStore } from "@/state/store";

const WIDTH = 400;

/** Last input modality, so a badge opened from the keyboard hands focus into the popover. */
let lastInput: { kind: "key" | "pointer"; key?: string; at: number } = { kind: "pointer", at: 0 };
const fromKeyboard = (within = 400) => lastInput.kind === "key" && performance.now() - lastInput.at < within;

/** Lightweight contextual popover anchored under a citation badge. */
export function CitationPopover() {
  const { state, closePopover, openModal, toast } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number; above: boolean } | null>(null);
  const pop = state.popover;
  const chunk = pop ? chunkById(pop.chunkId) : undefined;

  const openBtn = useRef<HTMLButtonElement>(null);
  // the badge that opened the popover, to hand focus back on Escape / ✕
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => closePopover(), [closePopover]);
  const closeAndReturn = useCallback(() => {
    const id = pop?.chunkId;
    const back =
      (opener.current?.isConnected && opener.current) ||
      (id ? document.querySelector<HTMLElement>(`[data-chunk="${CSS.escape(id)}"][data-citation]`) : null);
    closePopover();
    back?.focus({ preventScroll: true });
  }, [closePopover, pop?.chunkId]);
  // Escape returns focus to the badge; a pointer press outside just closes
  const dismiss = useCallback(() => {
    if (fromKeyboard(100) && lastInput.key === "Escape") closeAndReturn();
    else close();
  }, [close, closeAndReturn]);

  // citation badges handle their own toggle/re-anchor, so they don't count as "outside"
  const badges = useRef<HTMLElement | null>(null);
  useDismiss([ref, badges], !!pop, dismiss);
  useEffect(() => {
    const track = (e: PointerEvent) => {
      lastInput = { kind: "pointer", at: performance.now() };
      badges.current = (e.target as HTMLElement).closest?.("[data-citation]") as HTMLElement | null;
    };
    const key = (e: KeyboardEvent) => {
      lastInput = { kind: "key", key: e.key, at: performance.now() };
    };
    document.addEventListener("pointerdown", track, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", track, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  // remember the opener; when opened from the keyboard, move focus into the popover
  useEffect(() => {
    if (!pop) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("[data-citation]")) opener.current = active;
    if (fromKeyboard()) openBtn.current?.focus({ preventScroll: true });
  }, [pop]);

  useLayoutEffect(() => {
    if (!pop || !ref.current) return;
    const { x, y, w, h } = pop.anchor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const height = ref.current.offsetHeight;
    const center = x + w / 2;
    const left = Math.min(Math.max(12, center - WIDTH / 2), vw - WIDTH - 12);
    const above = y + h + 10 + height > vh - 12 && y - height - 10 > 12;
    const top = above ? y - height - 10 : y + h + 10;
    setPos({ top, left, arrow: center - left, above });
  }, [pop]);

  // close when the conversation scrolls or the viewport changes
  useEffect(() => {
    if (!pop) return;
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      // the sources strip scrolling a card into view isn't the conversation moving
      if (e.target instanceof Element && e.target.closest("[data-refs-strip]")) return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [pop, close]);

  if (!pop || !chunk) return null;

  const siblingsFor = () => {
    for (const m of state.messages) {
      if (m.role === "assistant" && m.refs.some((r) => r.id === chunk.id)) return m.refs.map((r) => r.id);
    }
    return [chunk.id];
  };

  return (
    <div
      // re-keyed per chunk so switching badges replays the pop, grown from the badge
      key={chunk.id}
      ref={ref}
      role="dialog"
      aria-label={`${chunk.docShort} — ${chunk.clause}`}
      style={
        {
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width: WIDTH,
          transformOrigin: pos ? `${pos.arrow}px ${pos.above ? "100%" : "0%"}` : undefined,
          "--ev-dy": pos?.above ? "4px" : "-4px",
        } as CSSProperties
      }
      className="ev-popover fixed z-40"
    >
      <span
        aria-hidden
        style={{ left: (pos?.arrow ?? 0) - 6 }}
        className={
          pos?.above
            ? "absolute top-full size-0 border-[6px] border-transparent border-t-line-strong"
            : "absolute bottom-full size-0 border-[6px] border-transparent border-b-line-strong"
        }
      />
      <div className="overflow-hidden rounded-[12px] bg-surface shadow-pop">
        <div className="flex items-start gap-2.5 border-b border-fg/8 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">
              {chunk.docShort} — {chunk.clause}
            </div>
            <div className="mt-1 flex items-center gap-[7px] text-[10.5px] text-fg/45">
              <span>
                {chunk.chapter} · {chunk.title}
              </span>
              <span className="opacity-50">·</span>
              <span>صفحه {fa(chunk.page)}</span>
              <span className="opacity-50">·</span>
              <span className={chunk.score >= 0.8 ? "font-semibold text-success ltr" : "font-semibold text-warning ltr"}>{pct(chunk.score)}</span>
            </div>
          </div>
          <button
            aria-label="بستن"
            onClick={closeAndReturn}
            className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[13px] text-fg/45 hover:bg-fg/8"
          >
            <X />
          </button>
        </div>
        <div className="px-3.5 py-3 text-[12.5px] leading-[2] text-fg/60">
          {chunk.excerpt.before}{" "}
          <mark className="box-decoration-clone rounded-[4px] bg-accent/20 px-[3px] py-px text-fg ring-1 ring-inset ring-accent/35">{chunk.excerpt.highlight}</mark>{" "}
          {chunk.excerpt.after}
        </div>
        <div className="flex items-center justify-between bg-panel px-3.5 py-2.5 border-t border-fg/8">
          <button
            ref={openBtn}
            onClick={() => openModal({ type: "inspector", chunkId: chunk.id, siblings: siblingsFor() })}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent-hi"
          >
            <ArrowSquareOut className="text-[14px]" />
            مشاهده متن کامل سند
          </button>
          <button
            onClick={async () => {
              const ok = await copyText(`«${chunk.excerpt.highlight}» — ${chunk.docTitle}، ${chunk.clause}، صفحه ${fa(chunk.page)}`);
              toast(ok ? "success" : "error", ok ? "نقل‌قول کپی شد" : "کپی ناموفق بود");
            }}
            className="inline-flex items-center gap-[5px] text-[11.5px] font-medium text-fg/45 hover:text-fg/75"
          >
            <Copy className="text-[13px]" />
            کپی نقل‌قول
          </button>
        </div>
      </div>
    </div>
  );
}
