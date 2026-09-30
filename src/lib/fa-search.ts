/*
 * Persian-aware fuzzy search for the command palette.
 *
 * Both sides are normalised (Arabic ↔ Persian letter forms, digits, ZWNJ,
 * diacritics) so «كتاب»، «کتاب» and «کتـــاب» all match, and a query typed on
 * the wrong keyboard layout ("shdfv") is retried as «سایبر».
 */

const CHAR_MAP: Record<string, string> = {
  // Arabic letter forms → Persian
  "ي": "ی",
  "ى": "ی",
  "ئ": "ی",
  "ك": "ک",
  "ة": "ه",
  "ۀ": "ه",
  "أ": "ا",
  "إ": "ا",
  "ٱ": "ا",
  "آ": "ا",
  "ؤ": "و",
  // dash variants
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "―": "-",
  "−": "-",
  "﹘": "-",
  "﹣": "-",
  "－": "-",
};

/** Persian (U+06F0) and Arabic-Indic (U+0660) digits → ASCII. */
function digit(c: number): string | null {
  if (c >= 0x06f0 && c <= 0x06f9) return String(c - 0x06f0);
  if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
  return null;
}

/** RLM / LRM / ALM / ZWJ, tatweel, harakat and the superscript alef carry no meaning for search. */
function dropped(c: number): boolean {
  return (
    c === 0x200e ||
    c === 0x200f ||
    c === 0x061c ||
    c === 0x200d ||
    c === 0x0640 ||
    (c >= 0x064b && c <= 0x065f) ||
    c === 0x0670
  );
}

/**
 * Normalises `s` for matching. `map[i]` is the index in `s` of normalised char `i`,
 * so match ranges can be projected back onto the original string for highlighting.
 */
export function normalizeFa(s: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (dropped(code)) continue;
    let ch = s[i];
    if (code === 0x200c || /\s/.test(ch)) ch = " ";
    else ch = digit(code) ?? CHAR_MAP[ch] ?? ch.toLowerCase();
    // collapse whitespace runs and trim the start
    if (ch === " " && (text.length === 0 || text[text.length - 1] === " ")) continue;
    text += ch;
    map.push(i);
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

const WORD_BREAK = /[\s\-_/·.,،:;()«»"'[\]]/;

type Norm = { text: string; map: number[] };

/** Best greedy subsequence placement of `token` in `t`, trying every start position. */
function matchToken(token: string, t: string): { score: number; idx: number[] } | null {
  let best: { score: number; idx: number[] } | null = null;
  for (let start = t.indexOf(token[0]); start !== -1; start = t.indexOf(token[0], start + 1)) {
    const idx = [start];
    let ti = start + 1;
    for (let qi = 1; qi < token.length; qi++) {
      const at = t.indexOf(token[qi], ti);
      if (at === -1) return best; // later starts can only fail too
      idx.push(at);
      ti = at + 1;
    }
    let score = 0;
    for (let k = 0; k < idx.length; k++) {
      const at = idx[k];
      const consecutive = k > 0 && at === idx[k - 1] + 1;
      if (at === 0) score += 10;
      else if (WORD_BREAK.test(t[at - 1])) score += 8;
      else if (!consecutive) score -= 3; // a lone letter picked from mid-word is a weak signal
      if (consecutive) score += 5;
      else if (k > 0) score -= at - idx[k - 1] - 1;
    }
    if (!best || score > best.score) best = { score, idx };
  }
  return best;
}

function scoreNormalized(q: Norm, t: Norm): { score: number; ranges: [number, number][] } | null {
  if (!q.text) return { score: 0, ranges: [] };
  let score = 0;
  const hits = new Set<number>();
  for (const token of q.text.split(" ")) {
    const m = matchToken(token, t.text);
    if (!m) return null;
    score += m.score;
    m.idx.forEach((i) => hits.add(i));
  }
  // consecutive normalised hits → one original-index range (spanning dropped marks in between)
  const sorted = [...hits].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (let k = 0; k < sorted.length; k++) {
    const from = sorted[k];
    while (k + 1 < sorted.length && sorted[k + 1] === sorted[k] + 1) k++;
    ranges.push([t.map[from], t.map[sorted[k]] + 1]);
  }
  return { score, ranges };
}

/**
 * Scores `query` against `target`: every whitespace token must appear as a
 * subsequence. +10 at the very start, +8 at a word start, +5 per consecutive
 * char, −1 per skipped char and −3 for a lone mid-word char. Ranges are [start, end) in ORIGINAL `target` indices.
 */
export function fuzzyScore(query: string, target: string): { score: number; ranges: [number, number][] } | null {
  return scoreNormalized(normalizeFa(query), normalizeFa(target));
}

/* ── Keyboard-layout recovery (QWERTY ↔ ISIRI 9147) ─── */

const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,";
const FA = "ضصثقفغعهخحجچشسیبلاتنمکگظطزرذدپو";
const EN_TO_FA = new Map<string, string>();
const FA_TO_EN = new Map<string, string>();
for (let i = 0; i < EN.length; i++) {
  EN_TO_FA.set(EN[i], FA[i]);
  FA_TO_EN.set(FA[i], EN[i]);
}

/** Re-types `q` as if the other layout had been active: "shdfv" ⇄ «سایبر». */
export function swapLayout(q: string): string {
  let out = "";
  for (const ch of q) {
    const lower = ch.toLowerCase();
    out += EN_TO_FA.get(lower) ?? FA_TO_EN.get(CHAR_MAP[ch] ?? ch) ?? ch;
  }
  return out;
}

export interface SearchHit<T> {
  item: T;
  score: number;
  ranges: [number, number][];
  /** the winning match came from the layout-swapped query */
  swapped: boolean;
}

/**
 * Ranks `items` against `q`. Each item keeps the better of its direct score and
 * 0.9 × its layout-swapped score; on equal scores a direct match always wins.
 * Matches with a score ≤ 0 (letters scattered across a long label) are dropped.
 * An empty query returns every item in its original order.
 */
export function search<T>(items: readonly T[], q: string, getText: (item: T) => string): SearchHit<T>[] {
  const direct = normalizeFa(q);
  const swappedQ = swapLayout(q);
  const alt = swappedQ !== q ? normalizeFa(swappedQ) : null;
  const hits: SearchHit<T>[] = [];

  for (const item of items) {
    const target = normalizeFa(getText(item));
    const d = scoreNormalized(direct, target);
    // scattered subsequences across a long sentence score ≤ 0; they are noise, not matches
    const s = alt ? scoreNormalized(alt, target) : null;
    const sScore = s && s.score > 0 ? s.score * 0.9 : -Infinity;
    // a direct match needs a positive score too, unless the query is a single character (then 0 = mid-word hit)
    const dOk = d && (d.score > 0 || direct.text.length < 2);
    if (dOk && d.score >= sScore) hits.push({ item, score: d.score, ranges: d.ranges, swapped: false });
    else if (s && sScore > -Infinity) hits.push({ item, score: sScore, ranges: s.ranges, swapped: true });
  }

  if (!direct.text) return hits;
  // hits are in item order; Array.prototype.sort is stable, so equal ranks keep it
  return hits.sort((a, b) => b.score - a.score || Number(a.swapped) - Number(b.swapped));
}
