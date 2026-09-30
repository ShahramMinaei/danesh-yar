const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert Latin digits in a string/number to Persian digits. */
export function fa(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Persian number with Persian thousands separator (٬) and decimal mark (٫). */
export function faNum(n: number, fractionDigits = 0): string {
  const fixed = n.toFixed(fractionDigits);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return fa(frac ? `${grouped}٫${frac}` : grouped);
}

/** Latin number with comma grouping, for LTR technical metadata. */
export function enNum(n: number): string {
  return n.toLocaleString("en-US");
}

export function faTime(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return fa(`${h}:${m}`);
}

export function clockStamp(date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}`;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Score → semantic color class (≥ 80% success, else warning). */
export function scoreTone(score: number): "success" | "warning" {
  return score >= 0.8 ? "success" : "warning";
}

export function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}
