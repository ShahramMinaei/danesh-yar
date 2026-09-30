"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import { useStore } from "@/state/store";
import { Tooltip } from "../../ui/primitives";
import { readDarkVariant, useApplyTheme } from "./use-apply-theme";

/**
 * Dark/light sliding switch. The knob sits on the start (right) side in dark mode.
 * Switching reveals the new theme as a circle spreading from the switch itself;
 * light → dark returns to the last dark variant (dark / emerald / cyber).
 */
export function ThemeToggle() {
  const { state } = useStore();
  const applyTheme = useApplyTheme();
  const dark = state.theme !== "light";
  // bumps on each switch to remount the knob's one-shot accent ring
  const [flash, setFlash] = useState(0);
  return (
    <Tooltip label="حالت روشن / تیره">
      <button
        role="switch"
        aria-checked={dark}
        aria-label="حالت تیره"
        data-tour="theme"
        onClick={(e) => {
          // centre of the switch, so keyboard activation reveals from the same spot
          const r = e.currentTarget.getBoundingClientRect();
          setFlash((n) => n + 1);
          applyTheme(dark ? "light" : readDarkVariant(), { x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }}
        className="relative flex h-8 w-[62px] shrink-0 items-center justify-between rounded-full border border-fg/12 bg-panel p-[3px] transition-colors hover:border-fg/24"
      >
        <span className="grid size-6 place-items-center text-[13px] text-fg/40">
          <Moon />
        </span>
        <span className="grid size-6 place-items-center text-[14px] text-fg/40">
          <Sun />
        </span>
        <span
          aria-hidden
          className={cx(
            "absolute start-[3px] top-[3px] grid size-6 place-items-center rounded-full bg-accent-bg text-[13px] text-accent-fg shadow-[0_2px_6px_var(--shadow-color)] ring-1 ring-inset ring-accent transition-transform duration-200",
            !dark && "-translate-x-[30px]",
          )}
        >
          {dark ? <Moon weight="fill" /> : <Sun weight="fill" />}
          {flash > 0 && <span key={flash} className="ts-knob-flash" />}
        </span>
      </button>
    </Tooltip>
  );
}
