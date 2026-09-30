"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "@/lib/hooks";
import { SHORTCUTS, isTypingTarget, matches, shortcutById, type ShortcutId } from "@/lib/keymap";
import { SCOPES, THEMES } from "@/lib/mock-data";
import type { ScopeId } from "@/lib/types";
import { useStore } from "@/state/store";
import type { ComposerHandle } from "../../chat/composer";
import { useApplyTheme } from "../theme/use-apply-theme";
import { togglePalette } from "./palette-store";

const PALETTE_KEYS = shortcutById("palette").keys;

const DEPTH: Partial<Record<ShortcutId, ScopeId>> = {
  depthQuick: "quick",
  depthStandard: "standard",
  depthDeep: "deep",
};

/**
 * App-wide keyboard shortcuts driven by the keymap registry. One window
 * listener in the bubble phase, so document-level handlers (menus, modals,
 * the palette) see the key first and can claim it with preventDefault.
 */
export function GlobalShortcuts({
  composer,
  onToggleSidebar,
}: {
  composer: RefObject<ComposerHandle | null>;
  onToggleSidebar: () => void;
}) {
  void composer; // focus goes through #composer so a disabled (streaming) textarea is simply skipped
  const api = useStore();
  const applyTheme = useApplyTheme();
  const reduced = useReducedMotion();

  // the listener is installed once; it reads the latest values through this ref
  const latest = useRef({ api, applyTheme, onToggleSidebar, reduced });
  useEffect(() => {
    latest.current = { api, applyTheme, onToggleSidebar, reduced };
  });

  useEffect(() => {
    /** moves focus through the citation badges of the latest answer (wraps around) */
    const stepCitation = (dir: 1 | -1) => {
      const bodies = document.querySelectorAll("[data-answer-body]");
      const last = bodies[bodies.length - 1];
      if (!last) return;
      const cites = Array.from(last.querySelectorAll<HTMLElement>("[data-citation]"));
      if (!cites.length) return;
      const at = cites.indexOf(document.activeElement as HTMLElement);
      const next = at === -1 ? (dir === 1 ? 0 : cites.length - 1) : (at + dir + cites.length) % cites.length;
      const el = cites[next];
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", behavior: latest.current.reduced ? "auto" : "smooth" });
    };

    const actions: Partial<Record<ShortcutId, () => void>> = {
      focus: () => document.getElementById("composer")?.focus(),
      shortcuts: () => latest.current.api.openModal({ type: "shortcuts" }),
      sidebar: () => latest.current.onToggleSidebar(),
      newChat: () => latest.current.api.clearConversation(),
      theme: () => {
        const { api, applyTheme } = latest.current;
        const i = THEMES.findIndex((t) => t.id === api.state.theme);
        applyTheme(THEMES[(i + 1) % THEMES.length].id, { x: innerWidth / 2, y: innerHeight / 2 });
      },
      citeNext: () => stepCitation(1),
      citePrev: () => stepCitation(-1),
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;

      if (matches(e, PALETTE_KEYS)) {
        // claim it even on repeat, before the browser's own Ctrl+K (search bar) sees it
        e.preventDefault();
        if (e.repeat) return;
        const { state, closeModal } = latest.current.api;
        if (state.modal) closeModal();
        togglePalette();
        return;
      }

      if (e.repeat || e.defaultPrevented) return;
      // a store modal or any open <dialog> (the palette itself) owns the keyboard
      if (latest.current.api.state.modal || document.querySelector("dialog[open]")) return;

      const hit = SHORTCUTS.find((s) => !s.display && matches(e, s.keys));
      if (!hit) return;
      if (hit.when === "notTyping" && isTypingTarget(e.target)) return;

      const depth = DEPTH[hit.id];
      if (depth) {
        e.preventDefault();
        const { set, toast } = latest.current.api;
        set({ scope: depth });
        toast("info", `عمق جستجو: ${SCOPES.find((s) => s.id === depth)!.label}`);
        return;
      }
      const run = actions[hit.id];
      if (!run) return;
      e.preventDefault();
      run();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
