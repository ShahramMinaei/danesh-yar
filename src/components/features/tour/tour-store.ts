"use client";

import { useSyncExternalStore } from "react";

/* Module-level active flag for the guided tour, shared without React context. */

let active = false;
const listeners = new Set<() => void>();

function emit(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Where focus returns when the tour ends; read at launch, while the launcher is still in the DOM. */
let origin: HTMLElement | null = null;

export function startTour(): void {
  if (!active) {
    const el = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // a menu item is about to unmount with its menu: return to the button that opened it;
    // inside a dialog (the palette) the dialog restores focus itself
    const menu = el?.closest<HTMLElement>("[role=menu]");
    origin = el?.closest("dialog")
      ? null
      : (menu?.parentElement?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? (el === document.body ? null : el));
  }
  emit(true);
}

/** The launch point captured by the latest startTour. */
export function tourOrigin(): HTMLElement | null {
  return origin;
}

export function stopTour(): void {
  emit(false);
}

export function useTourActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false,
  );
}
