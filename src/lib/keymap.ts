"use client";

import { useSyncExternalStore } from "react";

/*
 * Single source of truth for keyboard shortcuts. GlobalShortcuts executes them,
 * the palette shows them as row hints and the «میان‌برهای صفحه‌کلید» sheet lists
 * them. Keys are physical `KeyboardEvent.code`s, so they work on a Persian layout
 * too (Shift+Slash types «؟» there and still opens the sheet).
 */

export type ShortcutGroup = "عمومی" | "گفتگو" | "پاسخ" | "ظاهر";

export type ShortcutId =
  | "palette"
  | "focus"
  | "shortcuts"
  | "sidebar"
  | "newChat"
  | "send"
  | "newline"
  | "depthQuick"
  | "depthStandard"
  | "depthDeep"
  | "citeNext"
  | "citePrev"
  | "stop"
  | "theme";

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  label: string;
  /** `KeyboardEvent.code` values plus the modifiers "mod" (Ctrl/⌘), "shift" and "alt" */
  keys: string[];
  /** skipped while the focus is in a text field */
  when?: "notTyping";
  /** key-cap labels of a display-only shortcut, handled by its own component (never run by GlobalShortcuts) */
  display?: string[];
}

export const SHORTCUTS: Shortcut[] = [
  { id: "palette", group: "عمومی", label: "جستجو و فرمان‌ها", keys: ["mod", "KeyK"] },
  { id: "focus", group: "عمومی", label: "رفتن به کادر پرسش", keys: ["Slash"], when: "notTyping" },
  { id: "shortcuts", group: "عمومی", label: "میان‌برهای صفحه‌کلید", keys: ["shift", "Slash"], when: "notTyping" },
  { id: "sidebar", group: "عمومی", label: "باز/بسته کردن سایدبار", keys: ["mod", "KeyB"] },

  { id: "newChat", group: "گفتگو", label: "گفتگوی جدید", keys: ["alt", "shift", "KeyN"] },
  { id: "send", group: "گفتگو", label: "ارسال پرسش", keys: ["Enter"], display: ["Enter"] },
  { id: "newline", group: "گفتگو", label: "خط جدید", keys: ["shift", "Enter"], display: ["Shift", "Enter"] },
  { id: "depthQuick", group: "گفتگو", label: "عمق جستجو: سریع", keys: ["alt", "Digit1"] },
  { id: "depthStandard", group: "گفتگو", label: "عمق جستجو: استاندارد", keys: ["alt", "Digit2"] },
  { id: "depthDeep", group: "گفتگو", label: "عمق جستجو: عمیق", keys: ["alt", "Digit3"] },

  // RTL: the next citation sits to the left, so «[» moves forward
  { id: "citeNext", group: "پاسخ", label: "ارجاع بعدی", keys: ["BracketLeft"], when: "notTyping" },
  { id: "citePrev", group: "پاسخ", label: "ارجاع قبلی", keys: ["BracketRight"], when: "notTyping" },
  { id: "stop", group: "پاسخ", label: "توقف پاسخ", keys: ["Escape"], display: ["Esc"] },

  { id: "theme", group: "ظاهر", label: "تم بعدی", keys: ["alt", "shift", "KeyT"] },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["عمومی", "گفتگو", "پاسخ", "ظاهر"];

export const shortcutById = (id: ShortcutId) => SHORTCUTS.find((s) => s.id === id)!;

const MODIFIERS = new Set(["mod", "shift", "alt"]);

/** True when `e` is exactly `keys`: same physical key and no extra modifiers. */
export function matches(e: KeyboardEvent, keys: string[]): boolean {
  const code = keys.find((k) => !MODIFIERS.has(k));
  if (!code || e.code !== code) return false;
  return (
    (e.ctrlKey || e.metaKey) === keys.includes("mod") &&
    e.shiftKey === keys.includes("shift") &&
    e.altKey === keys.includes("alt")
  );
}

const NON_TEXT_INPUTS = new Set(["button", "checkbox", "radio", "range", "submit", "reset", "color", "file", "image"]);

/** Text fields and editable content, where plain keys belong to the user's typing. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return tag === "INPUT" && !NON_TEXT_INPUTS.has((t as HTMLInputElement).type);
}

/* ── Platform ────────────────────────────────────────── */

const noop = () => () => {};

function detectMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || "");
}

/** Apple platform (⌘ instead of Ctrl). Always false during SSR and hydration. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noop, detectMac, () => false);
}

const CODE_LABEL: Record<string, string> = {
  Slash: "/",
  BracketLeft: "[",
  BracketRight: "]",
  Escape: "Esc",
  Enter: "Enter",
  Space: "Space",
};

/** Key-cap labels: ["mod","KeyK"] → ["⌘","K"] on Apple, ["Ctrl","K"] elsewhere. */
export function formatKeys(keys: string[], isMac: boolean): string[] {
  return keys.map((k) => {
    if (k === "mod") return isMac ? "⌘" : "Ctrl";
    if (k === "shift") return isMac ? "⇧" : "Shift";
    if (k === "alt") return isMac ? "⌥" : "Alt";
    if (k.startsWith("Key")) return k.slice(3);
    if (k.startsWith("Digit")) return k.slice(5);
    return CODE_LABEL[k] ?? k;
  });
}
