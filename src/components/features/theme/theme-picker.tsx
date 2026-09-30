"use client";

import { Check, Palette } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/lib/format";
import { THEMES } from "@/lib/mock-data";
import { useStore } from "@/state/store";
import { useApplyTheme } from "./use-apply-theme";

/**
 * Theme gallery: four live mini previews. Each swatch nests its own
 * [data-theme], so it paints with that theme's real tokens (canvas, sidebar,
 * card, accent) rather than hard-coded hex values.
 * `compact` (overflow menu): label inline beside smaller swatches.
 */
export function ThemePicker({ compact }: { compact?: boolean }) {
  const { state } = useStore();
  const applyTheme = useApplyTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, THEMES.findIndex((t) => t.id === state.theme));
  // roving tab stop: follows focus inside the group, falls back to the selected swatch
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const stop = focusIdx ?? selected;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = THEMES.length;
    const moves: Record<string, number> = {
      // RTL: left moves forward
      ArrowLeft: (stop + 1) % n,
      ArrowDown: (stop + 1) % n,
      ArrowRight: (stop - 1 + n) % n,
      ArrowUp: (stop - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    refs.current[moves[e.key]]?.focus();
  };

  const w = compact ? 38 : 44;
  const h = compact ? 28 : 32;

  const group = (
    <div
      role="radiogroup"
      aria-label="پوسته رنگی"
      onKeyDown={onKey}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIdx(null);
      }}
      className={cx("grid grid-cols-4", compact ? "gap-1" : "gap-2")}
    >
      {THEMES.map((t, i) => {
        const checked = i === selected;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t.label}
            tabIndex={i === stop ? 0 : -1}
            onFocus={() => setFocusIdx(i)}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              applyTheme(t.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
            className={cx(
              "ts-swatch flex flex-col items-center rounded-[9px] focus-visible:outline-offset-1",
              compact ? "gap-1 px-0.5 pt-1 pb-0.5" : "gap-[5px] px-1 pt-1.5 pb-1",
            )}
          >
            <span
              className={cx(
                "ts-chip relative rounded-[8px] ring-offset-2 ring-offset-surface",
                checked ? "ring-2 ring-accent" : "ring-0",
              )}
            >
              <span
                aria-hidden
                data-theme={t.id}
                style={{ width: w, height: h }}
                className="relative block overflow-hidden rounded-[7px] bg-app ring-1 ring-line ring-inset"
              >
                {/* sidebar strip on the inline-start edge */}
                <span className="absolute inset-y-0 start-0 w-[28%] border-e border-line bg-panel" />
                {/* answer card with an accent rule and a highlight dot */}
                <span className="absolute start-[38%] end-[12%] top-[24%] bottom-[24%] rounded-[3px] bg-surface ring-1 ring-line ring-inset">
                  <span className="absolute start-[16%] end-[34%] top-[30%] h-[2px] rounded-full bg-accent" />
                  <span className="absolute end-[14%] bottom-[22%] size-[3px] rounded-full bg-accent-hi" />
                </span>
              </span>
              {checked && (
                <span
                  aria-hidden
                  className="ts-check absolute -end-[5px] -top-[5px] grid size-3.5 place-items-center rounded-full bg-accent text-[8px] text-on-accent ring-2 ring-surface"
                >
                  <Check weight="bold" />
                </span>
              )}
            </span>
            <span
              className={cx(
                "text-[10.5px] leading-none transition-colors",
                checked ? "font-medium text-fg" : "text-fg/55",
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <span className="text-[16px] text-fg/60" aria-hidden>
          <Palette />
        </span>
        <span className="flex-1 text-[13px]">پوسته</span>
        {group}
      </div>
    );
  }
  return (
    <div className="px-2.5 pt-1 pb-2">
      <div className="mb-1 text-[11px] text-fg/50">پوسته</div>
      {group}
    </div>
  );
}
