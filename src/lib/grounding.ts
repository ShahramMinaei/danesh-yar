import type { Block, Inline, RetrievedChunk } from "./types";

/*
 * Grounding audit (pure, no React).
 * Splits an answer into claims, grades each claim by the evidence it cites,
 * and — for uncited claims — suggests the retrieved chunk that best overlaps it
 * lexically. Suggestions are only ever shown as «پیشنهادی», never attached.
 */

export type Claim = { key: string; kind: "p" | "li" | "row" | "callout"; text: string; cites: string[] };
export type Grade = "strong" | "moderate" | "uncited" | "orphan";

/** cited evidence at or above this retrieval score counts as strong */
const STRONG_SCORE = 0.8;
/** below this weighted overlap a suggestion is not worth showing */
const MIN_OVERLAP = 0.25;

/* ── claims ──────────────────────────────────────────── */

/** Inline text without citation labels. */
function plain(parts: Inline[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : "b" in p ? p.b : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const citesOf = (parts: Inline[]) => [...new Set(parts.flatMap((p) => (typeof p === "object" && "cite" in p ? [p.cite] : [])))];

/** One claim per paragraph, list item, table row and callout, keyed like answer-body's `data-claim`. */
export function extractClaims(blocks: Block[]): Claim[] {
  const out: Claim[] = [];
  blocks.forEach((b, i) => {
    switch (b.type) {
      case "p":
      case "callout":
        out.push({ key: `b${i}`, kind: b.type, text: plain(b.content), cites: citesOf(b.content) });
        break;
      case "ul":
        b.items.forEach((item, j) => out.push({ key: `b${i}.i${j}`, kind: "li", text: plain(item), cites: citesOf(item) }));
        break;
      case "table":
        b.rows.forEach((row, r) => {
          const id = b.rowCites?.[r];
          out.push({ key: `b${i}.r${r}`, kind: "row", text: row.join(" · "), cites: id ? [id] : [] });
        });
        break;
      // formulas restate a cited rule; they are not claims of their own
    }
  });
  return out;
}

export function grade(claim: Claim, refs: RetrievedChunk[]): Grade {
  if (claim.cites.length === 0) return "uncited";
  let best = 0;
  for (const id of claim.cites) {
    const ref = refs.find((r) => r.id === id);
    if (!ref) return "orphan";
    best = Math.max(best, ref.score);
  }
  return best >= STRONG_SCORE ? "strong" : "moderate";
}

/* ── normalization & tokens ──────────────────────────── */

const ZWNJ = "‌";
const ORDINALS: [RegExp, string][] = [
  // longest first so «بیست‌وهشتم» is not read as «بیستم»
  [/بیست\s*و\s*هشتم/, "28"],
  [/بیست\s*و\s*چهارم/, "24"],
  [/سی\s*و\s*سوم/, "33"],
  [/بیستم/, "20"],
  [/دهم/, "10"],
];

const STOP = new Set(
  (
    "و در به از که را با این برای است باید یا تا بر نیز شود شوند می نمی هر آن آنها ها های یک ای اند " +
    "شده شد بود باشد نه هم همه اگر چه خود بین پس کند کنند دارد هیچ صورت حالت روی مورد عنوان"
  ).split(" "),
);

export function normalize(text: string): string {
  let s = text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٰٟـ]/g, "");
  // «یک‌بیستم» → 1/20, with or without ZWNJ / spaces
  for (const [ord, n] of ORDINALS) {
    s = s.replace(new RegExp(`یک[${ZWNJ}\\s]*${ord.source.replaceAll("\\s*", `[${ZWNJ}\\s]*`)}`, "g"), ` 1/${n} `);
  }
  // «ℓ⁄۱۰», «ℓ / 10» → 1/10
  s = s.replace(/ℓ\s*[⁄/]\s*(\d+)/g, " 1/$1 ");
  // ZWNJ splits suffixes («دال‌های» → «دال های»), so stems meet across inflections
  return s.replaceAll(ZWNJ, " ").toLowerCase();
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("fa", { granularity: "word" }) : null;

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  // fractions stay whole: a word segmenter would split «1/10» into «1» «/» «10»
  const rest = normalize(text).replace(/\d+\/\d+/g, (f) => {
    out.add(f);
    return " ";
  });
  const words = segmenter
    ? [...segmenter.segment(rest)].filter((w) => w.isWordLike).map((w) => w.segment)
    : rest.split(/[\s.,،؛:;!?؟()«»"'\-—…·\/\[\]]+/);
  for (const w of words) if (w.length >= 2 && !STOP.has(w)) out.add(w);
  return out;
}

/* ── suggestions ─────────────────────────────────────── */

type RefTokens = { hi: Set<string>; all: Set<string> };
const refCache = new WeakMap<RetrievedChunk, RefTokens>();

function refTokens(ref: RetrievedChunk): RefTokens {
  let t = refCache.get(ref);
  if (!t) {
    const hi = tokens(ref.excerpt.highlight);
    const ctx = [ref.excerpt.before, ref.excerpt.after, ...ref.body.map((b) => ("text" in b ? b.text : ""))].join(" ");
    t = { hi, all: new Set([...hi, ...tokens(ctx)]) };
    refCache.set(ref, t);
  }
  return t;
}

/**
 * Best retrieved chunk for an uncited claim, or null.
 * overlap = weighted |T(claim) ∩ T(chunk)| / weighted |T(claim)|, where each
 * term weighs its rarity across the retrieved set (idf) and a term found only
 * in the chunk's context, not its highlighted passage, counts half. That keeps
 * generic words («دال», «خیز») from outvoting the one distinctive match.
 */
export function suggest(claim: Claim, refs: RetrievedChunk[]): { chunkId: string; overlap: number } | null {
  const terms = tokens(claim.text);
  if (terms.size === 0 || refs.length === 0) return null;
  const idx = refs.map(refTokens);
  const idf = new Map<string, number>();
  let total = 0;
  for (const t of terms) {
    const df = idx.reduce((n, r) => n + (r.all.has(t) ? 1 : 0), 0);
    const w = Math.log(1 + refs.length / (1 + df));
    idf.set(t, w);
    total += w;
  }
  let best: { chunkId: string; overlap: number } | null = null;
  refs.forEach((ref, i) => {
    let hit = 0;
    for (const t of terms) hit += idx[i].hi.has(t) ? idf.get(t)! : idx[i].all.has(t) ? idf.get(t)! / 2 : 0;
    const overlap = hit / total;
    if (overlap >= MIN_OVERLAP && (!best || overlap > best.overlap)) best = { chunkId: ref.id, overlap };
  });
  return best;
}

/* ── summary ─────────────────────────────────────────── */

export type GroundingSummary = {
  claims: Claim[];
  grades: Grade[];
  /** share of claims backed by retrieved evidence (strong + moderate) */
  coverage: number;
  supported: number;
  /** distinct cited chunk ids that are in the retrieved set */
  used: string[];
  /** mean retrieval score of `used` (0 when none) */
  avgScore: number;
};

export function summarize(blocks: Block[], refs: RetrievedChunk[]): GroundingSummary {
  const claims = extractClaims(blocks);
  const grades = claims.map((c) => grade(c, refs));
  const supported = grades.filter((g) => g === "strong" || g === "moderate").length;
  const used = refs.filter((r) => claims.some((c) => c.cites.includes(r.id)));
  return {
    claims,
    grades,
    coverage: claims.length ? supported / claims.length : 0,
    supported,
    used: used.map((r) => r.id),
    avgScore: used.length ? used.reduce((s, r) => s + r.score, 0) / used.length : 0,
  };
}
