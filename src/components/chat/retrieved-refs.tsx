"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cx, faNum, pct } from "@/lib/format";
import { useReducedMotion } from "@/lib/hooks";
import type { RetrievedChunk } from "@/lib/types";
import { useStore } from "@/state/store";
import { useEvidence } from "../features/evidence/evidence-scope";
import { ScoreBar } from "../ui/primitives";

function refLine(c: RetrievedChunk, short?: boolean) {
  if (short) return c.clause.replace(/^.*· /, "");
  return c.topic ? `${c.clause} · ${c.topic}` : c.clause;
}

/** stagger between dealt cards; capped so long lists don't trail on */
const DEAL_STEP_MS = 60;
const DEAL_MAX_STEPS = 8;
const COUNT_UP_MS = 700;

/** Relevance % that counts up from 0 as its card deals in (final value under reduced motion). */
function CountUp({ score, delay, animate }: { score: number; delay: number; animate: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const run = animate && !reduced;

  useEffect(() => {
    // write to React's own text node (not textContent) so reconciliation stays in sync
    const el = ref.current?.firstChild;
    if (!run || !(el instanceof Text)) return;
    const target = Math.round(score * 100);
    let frame = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / COUNT_UP_MS);
      el.nodeValue = `${Math.round(target * (1 - (1 - p) ** 3))}%`;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => (frame = requestAnimationFrame(tick)), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      el.nodeValue = pct(score);
    };
  }, [run, score, delay]);

  return <span ref={ref}>{run ? "0%" : pct(score)}</span>;
}

/** «×n» citation counter; re-keyed per count so each new citation pops it. */
function CountChip({ n, pop, small }: { n: number; pop: boolean; small?: boolean }) {
  return (
    <>
      <span
        key={n}
        aria-hidden
        className={cx(
          "inline-flex shrink-0 items-center gap-px rounded-full bg-accent/14 font-latin font-semibold text-accent-fg ring-1 ring-inset ring-accent/35",
          small ? "px-1 text-[9px] leading-[14px]" : "px-[5px] text-[9.5px] leading-[15px]",
          pop && "ev-pop",
        )}
      >
        ×{faNum(n)}
      </span>
      <span className="sr-only">، {faNum(n)} بار در پاسخ استناد شده</span>
    </>
  );
}

/**
 * Retrieved sources. Desktop: responsive grid (container query) with a
 * relevance bar, expandable to all chunks. Tablet/mobile: horizontally
 * scrollable cards. Inside an EvidenceScope each card shows how often the
 * answer cites it, deals in as retrieval lands, and fades when unused.
 */
export function RetrievedRefs({ refs, layout }: { refs: RetrievedChunk[]; layout: "grid" | "scroll" }) {
  const { openModal } = useStore();
  const ev = useEvidence();
  const [showAll, setShowAll] = useState(false);
  // where the stagger starts: 0 for the live reveal, the fold once «نمایش همه» opens
  const [dealFrom, setDealFrom] = useState(0);
  const siblings = refs.map((r) => r.id);
  const open = (id: string) => openModal({ type: "inspector", chunkId: id, siblings });

  // desktop folds to one full row: 3 cards at 3 columns, else 4 (two rows of 2 at 2 columns)
  const grid = useRef<HTMLDivElement>(null);
  const [fold, setFold] = useState(4);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      setFold(w >= 560 && w < 720 ? 3 : 4);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const counts = ev?.counts;
  const done = !!ev?.done;
  const used = counts ? refs.filter((r) => counts.has(r.id)).length : 0;
  const popChips = !!ev?.animateCards && !done;

  const card = (c: RetrievedChunk, i: number) => {
    const n = counts?.get(c.id) ?? 0;
    const deal = dealFrom === 0 ? !!ev?.animateCards : i >= dealFrom;
    const delay = Math.min(Math.max(0, i - dealFrom), DEAL_MAX_STEPS) * DEAL_STEP_MS;
    const unused = done && n === 0;
    return {
      n,
      deal,
      delay,
      attrs: {
        "data-card": c.id,
        "data-chunk": c.id,
        "data-unused": unused ? "" : undefined,
        title: unused ? "بازیابی شد ولی در پاسخ استفاده نشد" : undefined,
        style: deal ? ({ "--ev-d": `${delay}ms` } as CSSProperties) : undefined,
        onClick: () => open(c.id),
      },
    };
  };

  if (layout === "scroll") {
    return (
      <section aria-label="منابع بازیابی‌شده" className="flex flex-col gap-[7px]">
        <span className="kicker text-[9.5px]!">
          منابع · {done ? `${faNum(used)} از ${faNum(refs.length)} بند استفاده شد` : `${faNum(refs.length)} بند`}
        </span>
        <div className="relative">
          <div data-refs-strip className="no-scrollbar -mx-3 flex snap-x gap-[7px] overflow-x-auto px-3 pb-0.5 [perspective:800px]">
            {refs.map((c, i) => {
              const { n, deal, attrs } = card(c, i);
              return (
                <button
                  key={c.id}
                  {...attrs}
                  className={cx(
                    "flex w-[150px] shrink-0 snap-start flex-col gap-[5px] rounded-[9px] bg-panel px-2.5 py-[9px] text-start ring-1 ring-inset ring-fg/9 hover:ring-accent/50 max-md:w-[142px]",
                    deal && "ev-deal",
                  )}
                >
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate text-[11.5px] font-medium">{c.docShort}</span>
                      {n > 0 && <CountChip n={n} pop={popChips} small />}
                    </span>
                    <span className={cx("font-latin text-[10.5px] font-semibold ltr", c.score >= 0.8 ? "text-success" : "text-warning")}>
                      {pct(c.score)}
                    </span>
                  </span>
                  <span className="truncate text-[10.5px] text-fg/50">{refLine(c, true)}</span>
                </button>
              );
            })}
            <span aria-hidden className="w-1 shrink-0" />
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-3 w-10 bg-[linear-gradient(to_left,transparent,var(--app))]"
          />
        </div>
      </section>
    );
  }

  const shown = showAll ? refs : refs.slice(0, fold);
  const hiddenCited = showAll || !counts ? 0 : refs.slice(fold).filter((r) => counts.has(r.id)).length;
  return (
    <section aria-label="منابع بازیابی‌شده" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="kicker">
          منابع بازیابی‌شده ·{" "}
          {done ? `${faNum(used)} از ${faNum(refs.length)} بند در پاسخ استفاده شد` : `${faNum(refs.length)} بند`}
        </span>
        {refs.length > fold && (
          <button
            data-refs-more
            aria-expanded={showAll}
            onClick={() => {
              if (!showAll) setDealFrom(fold);
              setShowAll((s) => !s);
            }}
            className="-mx-1.5 shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px] text-accent hover:text-accent-hi"
          >
            {showAll ? "نمایش کمتر" : "نمایش همه"}
            {hiddenCited > 0 && <span className="text-fg/45"> · +{faNum(hiddenCited)} استنادشده</span>}
          </button>
        )}
      </div>
      <div ref={grid} className="@container">
        <div className="grid grid-cols-2 gap-2 [perspective:800px] @min-[560px]:grid-cols-3 @min-[720px]:grid-cols-4">
          {shown.map((c, i) => {
            const { n, deal, delay, attrs } = card(c, i);
            return (
              <button
                key={c.id}
                {...attrs}
                className={cx(
                  "flex min-w-0 flex-col gap-1.5 rounded-[9px] bg-panel px-[11px] py-2.5 text-start ring-1 ring-inset ring-fg/9 hover:ring-accent/50",
                  deal && "ev-deal",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium">{c.docShort}</span>
                    {n > 0 && <CountChip n={n} pop={popChips} />}
                  </span>
                  <span className={cx("font-latin text-[11px] font-semibold ltr", c.score >= 0.8 ? "text-success" : "text-warning")}>
                    <CountUp score={c.score} delay={delay + 120} animate={deal} />
                  </span>
                </span>
                <span className="truncate text-[11px] text-fg/50">{refLine(c)}</span>
                <ScoreBar score={c.score} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
