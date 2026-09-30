import type { Inline } from "./types";

/* Word-boundary helpers for the streaming "ink" reveal. Offsets use the same
 * flat text that `sliceInline` counts: strings and {b} by length, citations as
 * label.length + 2 (one atomic, non-whitespace run). */

const WS = /\s/; // does not match ZWNJ (U+200C), so «می‌شود» stays one word

/**
 * Snap `chars` back to the last word boundary so a Persian word is never cut
 * mid-glyph (which flickers between joined and isolated letter forms).
 */
export function wordSafeChars(parts: Inline[], chars: number): number {
  let flat = "";
  for (const p of parts) {
    if (typeof p === "string") flat += p;
    else if ("b" in p) flat += p.b;
    else flat += "■".repeat(p.label.length + 2); // atomic cite placeholder
  }
  const total = flat.length;
  if (chars >= total) return total;
  if (chars <= 0) return 0;
  if (WS.test(flat[chars])) return chars;
  for (let i = chars - 1; i >= 0; i--) if (WS.test(flat[i])) return i + 1;
  return 0;
}

/** Split into words, each carrying its trailing whitespace; key = absolute start offset. */
export function splitWords(text: string, baseOffset: number): { key: number; text: string }[] {
  const out: { key: number; text: string }[] = [];
  let at = 0;
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    const last = out[out.length - 1];
    if (WS.test(piece[0]) && last) last.text += piece;
    else out.push({ key: baseOffset + at, text: piece });
    at += piece.length;
  }
  return out;
}
