"use client";

import { useCallback } from "react";
import type { ThemeId } from "@/lib/types";
import { withViewTransition } from "@/lib/view-transition";
import { useStore } from "@/state/store";

const DARK_VARIANT_KEY = "danesh-yar:dark-variant";
const DARK_FAMILY: ThemeId[] = ["dark", "emerald", "cyber"];

export const isDarkFamily = (id: ThemeId) => DARK_FAMILY.includes(id);

/** The dark-family theme the user last chose, so the sun/moon switch returns to it. */
export function readDarkVariant(): ThemeId {
  try {
    const v = localStorage.getItem(DARK_VARIANT_KEY) as ThemeId | null;
    if (v && isDarkFamily(v)) return v;
  } catch {}
  return "dark";
}

/**
 * Applies a theme with a circular reveal from `origin` (viewport centre by
 * default). Switching from light into a dark-family theme plays in reverse:
 * the old light page collapses into the origin instead.
 */
export function useApplyTheme(): (id: ThemeId, origin?: { x: number; y: number }) => void {
  const { set } = useStore();
  return useCallback(
    (id, origin) => {
      const html = document.documentElement;
      const from = (html.dataset.theme as ThemeId | undefined) ?? "dark";
      if (from === id) return;
      if (isDarkFamily(id)) {
        try {
          localStorage.setItem(DARK_VARIANT_KEY, id);
        } catch {}
      }
      const { x, y } = origin ?? { x: innerWidth / 2, y: innerHeight / 2 };
      void withViewTransition(
        () => {
          html.dataset.theme = id;
          set({ theme: id });
        },
        { reveal: { x, y, reverse: isDarkFamily(id) && from === "light" } },
      );
    },
    [set],
  );
}
