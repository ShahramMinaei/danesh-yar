import { sliceInline } from "./answer";
import type { Block, Inline } from "./types";

function addInline(parts: Inline[], into: Map<string, number>) {
  for (const p of parts) {
    if (typeof p !== "string" && "cite" in p) into.set(p.cite, (into.get(p.cite) ?? 0) + 1);
  }
}

function addBlock(block: Block, into: Map<string, number>) {
  switch (block.type) {
    case "p":
    case "callout":
      addInline(block.content, into);
      break;
    case "ul":
      for (const item of block.items) addInline(item, into);
      break;
    case "table":
      // a row's «مرجع» cell backs the whole row, so it counts once
      for (const id of block.rowCites ?? []) if (id) into.set(id, (into.get(id) ?? 0) + 1);
      break;
    case "formula":
      break;
  }
}

/**
 * How many times each chunk is cited, in order of first appearance.
 * With `reveal` (streaming), only what is on screen counts: blocks before
 * `reveal.block` in full, plus the visible slice of the current paragraph.
 */
export function citationCounts(blocks: Block[], reveal?: { block: number; chars: number }): Map<string, number> {
  const counts = new Map<string, number>();
  const full = reveal ? Math.min(reveal.block, blocks.length) : blocks.length;
  for (let i = 0; i < full; i++) addBlock(blocks[i], counts);
  const current = reveal ? blocks[reveal.block] : undefined;
  if (current?.type === "p") addInline(sliceInline(current.content, reveal!.chars), counts);
  return counts;
}

/** Stable string for a counts map ('id:n|id:n'); changes only when a citation lands. */
export function citedIdsSignature(counts: Map<string, number>): string {
  let out = "";
  for (const [id, n] of counts) out += (out ? "|" : "") + `${id}:${n}`;
  return out;
}

/** Inverse of `citedIdsSignature`. */
export function countsFromSignature(signature: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (!signature) return counts;
  for (const pair of signature.split("|")) {
    const at = pair.lastIndexOf(":");
    counts.set(pair.slice(0, at), Number(pair.slice(at + 1)));
  }
  return counts;
}
