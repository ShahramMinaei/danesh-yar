"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/state/store";

/**
 * Esc stops the streaming answer — the last layer of the Escape stack. Menus,
 * the citation popover, modals, the palette and the tour each claim the key
 * first (and call preventDefault), so this listens on window, in the bubble
 * phase, and only acts on an unclaimed Escape.
 */
export function StopHotkey() {
  const { isStreaming, state, stop } = useStore();
  const [live, setLive] = useState("");

  // the listener is attached once; it reads the latest store values from a ref
  const latest = useRef({ isStreaming, modal: state.modal, popover: state.popover, stop });
  useEffect(() => {
    latest.current = { isStreaming, modal: state.modal, popover: state.popover, stop };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      const s = latest.current;
      if (!s.isStreaming || s.modal || s.popover) return;
      if (document.querySelector("dialog[open]") || document.querySelector("[data-tour-active]")) return;
      e.preventDefault();
      s.stop();
      // ZWNJ keeps a repeated message distinct so it is announced again
      setLive((prev) => (prev === "پاسخ متوقف شد" ? "پاسخ متوقف شد‌" : "پاسخ متوقف شد"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <span className="sr-only" aria-live="polite">
      {live}
    </span>
  );
}
