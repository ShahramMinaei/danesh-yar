import { inlineText, sliceInline, streamLength } from "./answer";
import type { AssistantMessage, Block, Inline } from "./types";

const ELLIPSIS = "…";

/** Share of the ring that the pipeline (before any answer text) fills. */
const PIPELINE_SHARE = 0.25;

/** Minimum weight of a block, so tables / formulas (revealed at once) still advance the ring. */
const MIN_BLOCK_WEIGHT = 40;

/**
 * Cuts a streaming paragraph at the last word boundary at or before `chars`
 * (never mid-word, which reads badly in Persian) and ends it with «…».
 * Returns null when not even one whole word is visible yet.
 */
function cutParagraph(content: Inline[], chars: number): Inline[] | null {
  const text = inlineText(content);
  let safe = 0;
  // a whitespace right at `chars` means the visible word is already complete
  for (let i = Math.min(chars, text.length - 1); i >= 0; i--) {
    if (/\s/.test(text[i])) {
      safe = i + 1;
      break;
    }
  }
  if (chars >= text.length) safe = text.length;
  if (safe === 0) return null;

  const parts = sliceInline(content, safe);
  // drop trailing whitespace (and anything emptied by it) before the ellipsis
  while (parts.length) {
    const last = parts[parts.length - 1];
    if (typeof last === "string") {
      const t = last.trimEnd();
      if (t) {
        parts[parts.length - 1] = t + ELLIPSIS;
        return parts;
      }
      parts.pop();
    } else if ("b" in last) {
      const t = last.b.trimEnd();
      if (t) {
        parts[parts.length - 1] = { b: t };
        parts.push(ELLIPSIS);
        return parts;
      }
      parts.pop();
    } else {
      parts.push(ELLIPSIS);
      return parts;
    }
  }
  return null;
}

/**
 * Freezes a streaming answer at exactly what the reader has already seen: whole
 * blocks before the cursor plus the current paragraph cut at a word boundary.
 * Running pipeline steps become "stopped"; the cursor moves past the last block.
 */
export function freezePartial(m: AssistantMessage): AssistantMessage {
  const { block, chars } = m.reveal;
  const blocks: Block[] = m.blocks.slice(0, block);
  const cur = m.blocks[block];
  if (cur?.type === "p" && chars > 0) {
    const content = cutParagraph(cur.content, chars);
    if (content) blocks.push({ ...cur, content });
  }
  return {
    ...m,
    blocks,
    steps: m.steps.map((s) => (s.status === "running" ? { ...s, status: "stopped" } : s)),
    status: "done",
    stopped: true,
    reveal: { block: blocks.length, chars: 0 },
    meta: undefined,
  };
}

/** Parses retrieval meta like "7/10" into 0..1. */
function metaFraction(meta: string | undefined): number {
  const m = meta?.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 0;
  const k = Number(m[2]);
  return k > 0 ? Math.min(1, Number(m[1]) / k) : 0;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Answer progress in 0..1 for the stop button ring. The first quarter tracks the
 * pipeline (retrieval advances with its i/k counter); the remaining three
 * quarters track revealed answer text, weighting every block by its length.
 */
export function streamProgress(m: AssistantMessage): number {
  if (m.status !== "streaming") return 1;

  if (m.blocks.length === 0) {
    const perStep = PIPELINE_SHARE / Math.max(1, m.steps.length);
    let p = 0;
    for (const s of m.steps) {
      if (s.status === "success") p += perStep;
      else if (s.status === "running" && s.key === "retrieve") p += perStep * metaFraction(s.meta);
    }
    return clamp01(p);
  }

  let total = 0;
  let revealed = 0;
  m.blocks.forEach((b, i) => {
    const w = Math.max(streamLength(b), MIN_BLOCK_WEIGHT);
    total += w;
    if (i < m.reveal.block) revealed += w;
    else if (i === m.reveal.block) revealed += Math.min(m.reveal.chars, w);
  });
  return clamp01(PIPELINE_SHARE + (1 - PIPELINE_SHARE) * (total ? revealed / total : 0));
}
