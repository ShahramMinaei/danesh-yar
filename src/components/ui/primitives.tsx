"use client";

import { Check, Minus } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";

/* ── Badge ───────────────────────────────────────────── */

type BadgeTone = "accent" | "neutral" | "outline" | "success" | "warning" | "error" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  accent: "bg-accent-bg-2 text-accent-fg-2",
  neutral: "bg-chip text-fg/60",
  outline: "ring-1 ring-inset ring-accent text-accent",
  success: "bg-success/14 text-success",
  warning: "bg-warning/14 text-warning",
  error: "bg-error/14 text-error",
  info: "bg-info/14 text-info",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-[5px] rounded-[5px] px-[7px] py-[2px] text-[10px] leading-[1.5] whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-[5px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ── Status dot ──────────────────────────────────────── */

const DOT_TONES = {
  success: "bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]",
  warning: "bg-warning shadow-[0_0_0_3px_color-mix(in_oklab,var(--warning)_18%,transparent)]",
  error: "bg-error shadow-[0_0_0_3px_color-mix(in_oklab,var(--error)_18%,transparent)]",
  idle: "bg-idle",
  accent: "bg-accent",
};

export function StatusDot({
  tone = "success",
  size = 7,
  pulse,
  halo = true,
  className,
}: {
  tone?: keyof typeof DOT_TONES;
  size?: number;
  pulse?: boolean;
  halo?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx(
        "inline-block shrink-0 rounded-full",
        DOT_TONES[tone],
        !halo && "shadow-none!",
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}

/* ── Checkbox (visual) ───────────────────────────────── */

export function CheckboxBox({
  checked,
  indeterminate,
  size = 16,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  size?: number;
  className?: string;
}) {
  const on = checked || indeterminate;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.65 }}
      className={cx(
        "grid shrink-0 place-items-center transition-colors",
        size > 16 ? "rounded-[5px]" : "rounded-[4px]",
        on ? "bg-accent text-on-accent" : "ring-[1.5px] ring-inset ring-fg/25",
        className,
      )}
    >
      {indeterminate ? <Minus weight="bold" /> : checked ? <Check weight="bold" /> : null}
    </span>
  );
}

/* ── Kbd ─────────────────────────────────────────────── */

/** Key cap. `pressed` lights it up while the key is held (see the shortcuts sheet). */
export function Kbd({ children, pressed, className }: { children: ReactNode; pressed?: boolean; className?: string }) {
  return (
    <kbd
      data-pressed={pressed || undefined}
      className={cx(
        "kbd inline-block min-w-[18px] rounded-[4px] px-[5px] py-px text-center text-[10px] leading-[1.5] font-medium ltr ring-1 ring-inset",
        pressed
          ? "translate-y-px bg-accent/20 text-accent-fg ring-accent"
          : "bg-surface text-fg/70 ring-fg/15 shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--fg)_18%,transparent)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ── Segmented control ───────────────────────────────── */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx("inline-flex gap-[3px] rounded-[10px] bg-fg/4 p-[3px] ring-1 ring-inset ring-fg/10", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-[7px] px-[13px] py-[6px] text-[12.5px] whitespace-nowrap transition-colors",
              active
                ? "bg-accent/14 font-semibold text-accent-fg ring-1 ring-inset ring-accent"
                : "font-medium text-fg/60 hover:bg-fg/5 hover:text-fg/85",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Score bar ───────────────────────────────────────── */

export function ScoreBar({ score, height = 2, className }: { score: number; height?: number; className?: string }) {
  return (
    <div style={{ height }} className={cx("overflow-hidden rounded-full bg-chip", className)}>
      <span
        data-scorebar
        style={{ width: `${Math.round(score * 100)}%` }}
        className={cx("block h-full rounded-full", score >= 0.8 ? "bg-success" : "bg-warning")}
      />
    </div>
  );
}

/* ── Tooltip (hover/focus, CSS only) ─────────────────── */

export function Tooltip({
  label,
  side = "bottom",
  children,
}: {
  label: string;
  side?: "bottom" | "left" | "top";
  children: ReactNode;
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute z-50 rounded-[6px] bg-elevated px-[9px] py-[5px] text-[11.5px] whitespace-nowrap text-fg opacity-0 shadow-pop transition-opacity delay-300 duration-150",
          "group-hover/tt:opacity-100 group-has-[:focus-visible]/tt:opacity-100",
          side === "bottom" && "top-[calc(100%+8px)] left-1/2 -translate-x-1/2",
          side === "top" && "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
          side === "left" && "top-1/2 right-[calc(100%+8px)] -translate-y-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
