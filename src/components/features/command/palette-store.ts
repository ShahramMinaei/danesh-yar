"use client";

import { useSyncExternalStore } from "react";

/* Module-level open flag for the command palette, shared without React context. */

let open = false;
const listeners = new Set<() => void>();

function emit(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function openPalette(): void {
  emit(true);
}

export function closePalette(): void {
  emit(false);
}

export function togglePalette(): void {
  emit(!open);
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
