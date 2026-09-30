import type { Block, FormulaPart, Inline } from "./types";

export function inlineText(parts: Inline[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : "b" in p ? p.b : `[${p.label}]`))
    .join("");
}

export function formulaText(parts: FormulaPart[]): string {
  return parts.map((p) => (typeof p === "string" ? p : `_${p.sub}`)).join("");
}

/** Number of characters that stream in for a block (0 = revealed at once). */
export function streamLength(block: Block): number {
  return block.type === "p" ? inlineText(block.content).length : 0;
}

/** Truncate inline content to the first `chars` characters (citations count as their label). */
export function sliceInline(parts: Inline[], chars: number): Inline[] {
  const out: Inline[] = [];
  let left = chars;
  for (const p of parts) {
    if (left <= 0) break;
    if (typeof p === "string") {
      out.push(p.slice(0, left));
      left -= p.length;
    } else if ("b" in p) {
      out.push({ b: p.b.slice(0, left) });
      left -= p.b.length;
    } else {
      const len = p.label.length + 2;
      if (left >= len) out.push(p);
      left -= len;
    }
  }
  return out;
}

/** Plain-text rendering of an answer, used by «کپی». */
export function answerPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "p":
          return inlineText(b.content);
        case "callout":
          return `⚠ ${inlineText(b.content)}`;
        case "ul":
          return b.items.map((i) => `• ${inlineText(i)}`).join("\n");
        case "table":
          return [b.head, ...b.rows].map((r) => r.join(" | ")).join("\n");
        case "formula":
          return [formulaText(b.expr), ...b.legend.map((l) => `${formulaText(l.sym)}: ${l.desc}`)].join("\n");
      }
    })
    .join("\n\n");
}
