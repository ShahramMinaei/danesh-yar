"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useIsMac } from "@/lib/keymap";
import { IconButton } from "../../ui/button";
import { openPalette, usePaletteOpen } from "./palette-store";

/**
 * Borderless search icon that opens the command palette (also on Ctrl/⌘+K).
 * `rail`: sized and rounded like the other icons of the collapsed rail.
 */
export function PaletteTrigger({ size = 32, rail }: { size?: 32 | 34 | 36; rail?: boolean }) {
  const isMac = useIsMac();
  const open = usePaletteOpen();
  return (
    <IconButton
      label={`جستجو و فرمان‌ها (${isMac ? "⌘K" : "Ctrl+K"})`}
      size={size}
      data-tour="palette"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      onClick={openPalette}
      tone="bare"
      className={rail ? "rounded-[9px] text-[17px] text-fg/55" : "text-[18px] text-fg/60"}
    >
      <MagnifyingGlass />
    </IconButton>
  );
}
