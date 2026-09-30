"use client";

import { useEffect } from "react";
import { useStore } from "@/state/store";

/** Keeps <meta name="theme-color"> (mobile browser chrome) in sync with the active theme's canvas colour. */
export function ThemeColorMeta() {
  const { state } = useStore();
  useEffect(() => {
    // wait a frame so the new [data-theme] tokens have been applied
    const raf = requestAnimationFrame(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue("--app").trim();
      if (!color) return;
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = color;
    });
    return () => cancelAnimationFrame(raf);
  }, [state.theme]);
  return null;
}
