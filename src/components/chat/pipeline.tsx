"use client";

import { CaretDown, CircleNotch } from "@phosphor-icons/react";
import { Fragment, useRef, useState } from "react";
import { cx, fa, faNum, seconds } from "@/lib/format";
import { STEP_LABELS } from "@/lib/mock-data";
import type { PipelineStep, StepStatus } from "@/lib/types";
import { LiveMs } from "../features/retrieval/live-ms";

/**
 * Step status glyph. Success draws its check (plus a one-shot ring ping),
 * failure draws an X in two strokes and shakes; both play only when the status
 * changes after mount, so completed answers render static. The root is keyed
 * by status, so each transition replays exactly once.
 */
export function StepIcon({ status, size = 18 }: { status: StepStatus; size?: number }) {
  const initial = useRef(status).current;
  const animate = status !== initial;
  const fs = size * 0.6;
  const base = "relative grid shrink-0 place-items-center rounded-full";
  const style = { width: size, height: size, fontSize: fs };
  const glyph = { width: size * 0.72, height: size * 0.72 };
  switch (status) {
    case "success":
      return (
        <span key={status} style={style} className={cx(base, "bg-success/15 text-success")}>
          {animate && <span aria-hidden className="rm-ping" />}
          <svg viewBox="0 0 20 20" style={glyph} aria-hidden>
            <path
              pathLength={1}
              d="M5 10.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={animate ? "rm-draw" : undefined}
            />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span key={status} style={style} className={cx(base, "bg-error/15 text-error", animate && "rm-shake")}>
          <svg viewBox="0 0 20 20" style={glyph} aria-hidden fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path pathLength={1} d="M6.5 6.5l7 7" className={animate ? "rm-draw" : undefined} />
            <path pathLength={1} d="M13.5 6.5l-7 7" className={animate ? "rm-draw rm-draw-2" : undefined} />
          </svg>
        </span>
      );
    case "running":
      return (
        <span key={status} style={style} className={cx(base, "text-accent-hi ring-[1.5px] ring-inset ring-accent")}>
          <CircleNotch className="animate-spin" style={{ fontSize: fs * 0.9 }} />
        </span>
      );
    case "stopped":
      return (
        <span key={status} style={style} className={cx(base, "bg-fg/10 text-fg/55")}>
          <span aria-hidden className="rounded-[2px] bg-current" style={{ width: size * 0.4, height: size * 0.4 }} />
        </span>
      );
    default:
      return <span key={status} style={style} className={cx(base, "ring-[1.5px] ring-inset ring-fg/30")} />;
  }
}

function stepMeta(s: PipelineStep): string | undefined {
  if (s.status === "running") return s.meta;
  if (s.status !== "success" || s.ms == null) return undefined;
  return s.key === "retrieve" && s.meta ? `${s.ms}ms · ${s.meta}` : `${s.ms}ms`;
}

/** Technical meta next to a step: live elapsed ms while running, «متوقف» once stopped. */
function StepMeta({ s, className }: { s: PipelineStep; className: string }) {
  if (s.status === "stopped") return <span className="text-[10.5px] text-fg/40">متوقف</span>;
  const meta = stepMeta(s);
  if (meta) return <span className={cx("font-mono tabular-nums ltr", className)}>{meta}</span>;
  if (s.status === "running") return <LiveMs className={className} />;
  return null;
}

/** Horizontal 4-step stepper (desktop). `live` = streaming/error density. */
export function Pipeline({ steps, live }: { steps: PipelineStep[]; live?: boolean }) {
  return (
    <ol
      aria-label="مراحل پردازش"
      className="flex items-center rounded-[10px] bg-panel px-3.5 py-[11px] ring-1 ring-inset ring-fg/7"
    >
      {steps.map((s, i) => {
        const label = live ? STEP_LABELS[s.key].short : STEP_LABELS[s.key].full;
        const prev = steps[i - 1];
        return (
          <Fragment key={s.key}>
            {i > 0 && <Connector prev={prev.status} cur={s.status} live={live} />}
            <li
              aria-current={s.status === "running" ? "step" : undefined}
              className={cx("flex items-center gap-[7px]", s.status === "pending" && (live ? "opacity-45" : "opacity-55"))}
            >
              <StepIcon status={s.status} size={live ? 16 : 18} />
              <span
                className={cx(
                  live ? "text-[11.5px]" : "text-[12px]",
                  s.status === "running"
                    ? "font-semibold text-accent-fg"
                    : s.status === "failed"
                      ? "font-semibold text-error"
                      : s.status === "stopped"
                        ? "font-medium text-fg/50"
                        : cx("font-medium", live ? "text-fg/60" : "text-fg/75"),
                )}
              >
                {label}
              </span>
              <StepMeta s={s} className={cx("text-[10px]", s.status === "running" ? "text-fg/35" : "text-fg/30")} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/**
 * Link between two steps. The success fill grows from the finished step toward
 * the next one (origin-right = inline start in RTL); while that next step runs,
 * a small accent packet travels along it.
 */
function Connector({ prev, cur, live }: { prev: StepStatus; cur: StepStatus; live?: boolean }) {
  const filled = prev === "success";
  return (
    <span aria-hidden className={cx("relative h-px flex-1 overflow-hidden bg-fg/10", live ? "mx-[9px]" : "mx-3")}>
      <span
        style={{ transform: `scaleX(${filled ? 1 : 0})` }}
        className={cx(
          "absolute inset-0 origin-right transition-transform duration-500 ease-out",
          filled && cur === "success"
            ? "bg-[linear-gradient(to_left,color-mix(in_oklab,var(--success)_20%,transparent),color-mix(in_oklab,var(--success)_45%,transparent),color-mix(in_oklab,var(--success)_45%,transparent),color-mix(in_oklab,var(--success)_20%,transparent))]"
            : "bg-success/45",
        )}
      />
      {filled && cur === "running" && <span className="rm-packet" />}
    </span>
  );
}

/** Collapsible one-line summary used on tablet/mobile. */
export function PipelineSummary({
  steps,
  latencyMs,
  refsCount,
  mobile,
}: {
  steps: PipelineStep[];
  latencyMs?: number;
  refsCount: number;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const running = steps.find((s) => s.status === "running");
  const failed = steps.find((s) => s.status === "failed");
  const stopped = steps.some((s) => s.status === "stopped");
  const allDone = steps.every((s) => s.status === "success");

  let icon: StepStatus = "success";
  let text: string;
  if (failed) {
    icon = "failed";
    text = `${STEP_LABELS[failed.key].full} ناموفق بود`;
  } else if (stopped) {
    icon = "stopped";
    text = "پاسخ متوقف شد";
  } else if (running) {
    icon = "running";
    text = `${STEP_LABELS[running.key].full}${running.meta ? ` · ${fa(running.meta)}` : "…"}`;
  } else if (allDone) {
    text = mobile ? `۴ مرحله · بازیابی ${faNum(refsCount)} بند` : "۴ مرحله کامل شد";
  } else {
    icon = "pending";
    text = "در صف پردازش";
  }

  return (
    <div className="relative rounded-[9px] bg-panel ring-1 ring-inset ring-fg/7">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "flex w-full items-center gap-2 text-[11px] font-medium text-fg/60",
          mobile ? "gap-[7px] px-2.5 py-2" : "px-[11px] py-[9px]",
        )}
      >
        <StepIcon status={icon} size={14} />
        <span className={cx(mobile && "flex-1 text-start", icon === "failed" && "text-error", icon === "running" && "text-accent-fg")}>{text}</span>
        {!mobile && <span className={cx("h-px flex-1", allDone ? "bg-success/30" : "bg-fg/10")} />}
        {!mobile && allDone && latencyMs != null && <span className="font-mono text-[10px] text-fg/35 ltr">{seconds(latencyMs)}</span>}
        <CaretDown className={cx("text-[11px] text-fg/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="flex flex-col gap-2 border-t border-fg/7 px-3 py-2.5">
          {steps.map((s) => (
            <li key={s.key} className={cx("flex items-center gap-2 text-[12px]", s.status === "pending" && "opacity-50")}>
              <StepIcon status={s.status} size={16} />
              <span
                className={cx(
                  "flex-1",
                  s.status === "failed" ? "text-error" : s.status === "running" ? "text-accent-fg" : s.status === "stopped" ? "text-fg/50" : "text-fg/75",
                )}
              >
                {STEP_LABELS[s.key].full}
              </span>
              <StepMeta s={s} className="text-[10px] text-fg/35" />
            </li>
          ))}
        </ol>
      )}
      <ProgressRail steps={steps} />
    </div>
  );
}

const RAIL_FILL: Partial<Record<StepStatus, string>> = {
  success: "bg-success/60",
  running: "bg-accent rm-shimmer",
  failed: "bg-error",
  stopped: "bg-fg/25",
};

/**
 * Four hairline segments on the card's bottom edge; each fills as its step
 * progresses. Once every step succeeds the rail retires (fades out), so
 * finished answers keep the calm one-line card; a failed or stopped run keeps
 * it as a record of where the pipeline ended.
 */
function ProgressRail({ steps }: { steps: PipelineStep[] }) {
  const complete = steps.every((s) => s.status === "success");
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-x-2 bottom-0 flex gap-1 transition-opacity duration-700 ease-out",
        complete && "opacity-0 delay-500",
      )}
    >
      {steps.map((s) => (
        <span key={s.key} className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-fg/8">
          <span
            style={{ transform: `scaleX(${s.status === "pending" ? 0 : 1})` }}
            className={cx("absolute inset-0 origin-right rounded-full transition-transform duration-500 ease-out", RAIL_FILL[s.status])}
          />
        </span>
      ))}
    </span>
  );
}
