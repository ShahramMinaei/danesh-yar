"use client";

import type { ReactNode } from "react";
import { cx, faNum } from "@/lib/format";
import type { PipelineStep } from "@/lib/types";

const MAX_TICKS = 20;

/**
 * Ghost source deck, shown while the retrieve step is running. It keeps the
 * exact footprint of RetrievedRefs (same header, grid/strip and card heights),
 * so the real cards swap in without a layout jump. Ghost cells turn solid as
 * chunks are found; a tick meter counts every chunk. Disappears on failure or
 * stop so no ghosts are left behind.
 */
export function PendingRefs({ steps, layout }: { steps: PipelineStep[]; layout: "grid" | "scroll" }) {
  const retrieve = steps.find((s) => s.key === "retrieve");
  const m = retrieve?.status === "running" ? retrieve.meta?.match(/^(\d+)\/(\d+)$/) : null;
  if (!m) return null;
  const k = Number(m[2]);
  const found = Math.min(Number(m[1]), k);
  if (k <= 0) return null;

  const kicker = `در حال بازیابی · ${faNum(found)} از ${faNum(k)} بند`;
  // The single live update: announced once, when every chunk has arrived.
  const sr = <span className="sr-only">{found === k ? `${faNum(k)} بند بازیابی شد` : ""}</span>;

  if (layout === "scroll") {
    const ghosts = Math.min(k, 3);
    return (
      <section role="status" aria-label="در حال بازیابی منابع" className="flex animate-fade-in flex-col gap-[7px]">
        {sr}
        <div aria-hidden className="flex items-center justify-between gap-3">
          <span className="kicker text-[9.5px]!">{kicker}</span>
          <TickMeter found={found} k={k} />
        </div>
        <div aria-hidden className="relative">
          <div className="-mx-3 flex gap-[7px] overflow-hidden px-3 pb-0.5">
            {Array.from({ length: ghosts }, (_, i) => (
              <GhostCard key={i} found={i < found} compact />
            ))}
          </div>
          <span className="pointer-events-none absolute inset-y-0 -left-3 w-10 bg-[linear-gradient(to_left,transparent,var(--app))]" />
        </div>
      </section>
    );
  }

  const ghosts = Math.min(k, 4);
  return (
    <section role="status" aria-label="در حال بازیابی منابع" className="flex animate-fade-in flex-col gap-2">
      {sr}
      <div aria-hidden className="flex items-center gap-3">
        <span className="kicker flex-1">{kicker}</span>
        <TickMeter found={found} k={k} />
        {/* zero-width strut: with >4 refs the real header is as tall as its «نمایش همه» button,
            so mirror that button (inert and invisible) to reserve the same line box */}
        {k > 4 && (
          <button type="button" disabled tabIndex={-1} className="invisible -ms-3 w-0 overflow-hidden whitespace-nowrap py-0.5 text-[11px]">
            نمایش همه
          </button>
        )}
      </div>
      <div aria-hidden className="@container">
        <div className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-3 @min-[720px]:grid-cols-4">
          {Array.from({ length: ghosts }, (_, i) => (
            <GhostCard key={i} found={i < found} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One 3×10px tick per chunk (capped at 20); the newest lit tick pops in. */
function TickMeter({ found, k }: { found: number; k: number }) {
  const n = Math.min(k, MAX_TICKS);
  const lit = Math.round((found / k) * n);
  return (
    <span className="flex shrink-0 items-center gap-[2px]">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cx(
            "h-[10px] w-[3px] rounded-full transition-colors duration-200",
            i < lit ? "bg-accent" : "bg-fg/12",
            i === lit - 1 && "rm-tick",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Skeleton twin of a RetrievedRefs card. Each row is one line box (h-lh) at the
 * real row's font size, so the card height matches exactly.
 */
function GhostCard({ found, compact }: { found: boolean; compact?: boolean }) {
  const row = (text: string, bar: string, extra?: ReactNode) => (
    <span className={cx("flex h-lh items-center justify-between gap-2", text)}>
      <span className={cx("rm-skel block rounded-[4px]", bar)} />
      {extra}
    </span>
  );
  const dot = <span className={cx("size-[5px] shrink-0 rounded-full", found ? "rm-dot bg-accent" : "bg-transparent")} />;
  return (
    <div
      data-found={found || undefined}
      className={cx(
        "rm-ghost flex flex-col bg-panel",
        compact
          ? "w-[150px] shrink-0 gap-[5px] rounded-[9px] px-2.5 py-[9px] max-md:w-[142px]"
          : "gap-1.5 rounded-[9px] px-[11px] py-2.5",
      )}
    >
      {compact ? (
        <>
          {row("text-[11.5px]", "me-auto h-[9px] w-[58%]", dot)}
          {row("text-[10.5px]", "me-auto h-[8px] w-[80%]")}
        </>
      ) : (
        <>
          {row("text-[12px]", "me-auto h-[10px] w-[56%]", dot)}
          {row("text-[11px]", "me-auto h-[9px] w-[82%]")}
          <span className="rm-skel block h-[2px] rounded-full" />
        </>
      )}
    </div>
  );
}
