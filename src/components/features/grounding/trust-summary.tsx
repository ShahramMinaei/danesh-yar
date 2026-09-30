"use client";

import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { cx, faNum } from "@/lib/format";
import { suggest, summarize, type Claim, type Grade } from "@/lib/grounding";
import { useReducedMotion, type Breakpoint } from "@/lib/hooks";
import { chunkById } from "@/lib/mock-data";
import type { AssistantMessage, RetrievedChunk } from "@/lib/types";
import { useStore } from "@/state/store";
import { Button } from "../../ui/button";

/* ── «ممیزی استناد» preference: per viewer, shared by every answer on the page ── */

const AUDIT_KEY = "danesh-yar:audit";
const auditListeners = new Set<() => void>();
let auditOn: boolean | null = null;

function readAudit(): boolean {
  if (auditOn === null) {
    try {
      auditOn = localStorage.getItem(AUDIT_KEY) === "on";
    } catch {
      auditOn = false;
    }
  }
  return auditOn;
}

function writeAudit(on: boolean) {
  auditOn = on;
  try {
    localStorage.setItem(AUDIT_KEY, on ? "on" : "off");
  } catch {}
  auditListeners.forEach((l) => l());
}

function subscribeAudit(cb: () => void) {
  auditListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== AUDIT_KEY) return;
    auditOn = e.newValue === "on";
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    auditListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const useAudit = () => useSyncExternalStore(subscribeAudit, readAudit, () => false);

/* ── grades ──────────────────────────────────────────── */

const GRADE: Record<Grade, { label: string; bar: string; chip: string }> = {
  strong: { label: "مستند قوی", bar: "bg-success", chip: "bg-success/12 text-success" },
  moderate: { label: "مستند متوسط", bar: "bg-warning", chip: "bg-warning/14 text-warning" },
  uncited: { label: "بدون ارجاع", bar: "bg-error/70", chip: "bg-error/12 text-error" },
  orphan: { label: "خارج از بازیابی", bar: "border border-dashed border-error/80", chip: "border-dashed border-error/55 text-error" },
};
const GRADES = Object.keys(GRADE) as Grade[];

const source = (c: Pick<RetrievedChunk, "docShort" | "clause">) => `${c.docShort} — ${c.clause}`;
const pct = (x: number) => `${faNum(Math.round(x * 100))}٪`;

/**
 * Claim text as shown in the detail line. Row cells are isolated so an LTR cell
 * («ℓ / 28») can't pull its neighbours into its run; a cited row drops its
 * «مرجع» cell, which the line names anyway.
 */
function ClaimText({ claim }: { claim: Claim }) {
  if (claim.kind !== "row") return <>{claim.text}</>;
  const cells = claim.text.split(" · ");
  return (
    <>
      {(claim.cites.length ? cells.slice(0, -1) : cells).map((cell, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <bdi>{cell}</bdi>
        </span>
      ))}
    </>
  );
}

/**
 * Grounding audit under a finished answer: a coverage ring, one strip segment
 * per claim graded by the evidence behind it, and the «ممیزی استناد» toggle
 * that marks the answer itself. Every mark on the answer is a data-* attribute
 * set from here (DOM only), so the answer never re-renders and copy is untouched.
 */
export function TrustSummary({ message, bp }: { message: AssistantMessage; bp: Breakpoint }) {
  const { openCitation, openModal } = useStore();
  const reduced = useReducedMotion();
  const audit = useAudit();
  const mobile = bp === "mobile";

  const rootRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const { id, blocks, refs } = message;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarize(blocks, refs), [id, blocks, refs]);
  const { claims, grades } = summary;
  const n = claims.length;
  const coverage = Math.round(summary.coverage * 100);

  // `sel` persists after the pointer leaves so the detail line (and its «نمایش») stays reachable
  const [sel, setSel] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const firstWeak = grades.findIndex((g) => g !== "strong");
  const shown = sel !== null && sel < n ? sel : firstWeak >= 0 ? firstWeak : null;
  const live = (hovering || focused) && sel !== null && sel < n;
  const hotKey = live ? claims[sel!].key : null;

  const scopeEl = () => rootRef.current?.closest<HTMLElement>("[data-evidence-scope]") ?? null;
  const claimEl = (key: string) =>
    scopeEl()?.querySelector<HTMLElement>(`[data-answer-body] [data-claim="${CSS.escape(key)}"]`) ?? null;

  /* ring: start from the registered 0% and fill on the next frame */
  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    getComputedStyle(el).getPropertyValue("--cov"); // commit the start value so the change transitions
    const raf = requestAnimationFrame(() => el.style.setProperty("--cov", `${coverage}%`));
    return () => cancelAnimationFrame(raf);
  }, [coverage]);

  /* the claim under the pointer / focus is outlined in the answer */
  useEffect(() => {
    if (!hotKey) return;
    const el = rootRef.current?.closest("[data-evidence-scope]")?.querySelector<HTMLElement>(
      `[data-answer-body] [data-claim="${CSS.escape(hotKey)}"]`,
    );
    if (!el) return;
    el.dataset.claimHot = "";
    return () => {
      delete el.dataset.claimHot;
    };
  }, [hotKey]);

  /* audit mode: grade every claim in place */
  useEffect(() => {
    const scope = rootRef.current?.closest<HTMLElement>("[data-evidence-scope]");
    if (!scope || !audit) return;
    scope.dataset.audit = "on";
    const marked: HTMLElement[] = [];
    summary.claims.forEach((c, i) => {
      const el = scope.querySelector<HTMLElement>(`[data-answer-body] [data-claim="${CSS.escape(c.key)}"]`);
      if (!el) return;
      el.dataset.grade = summary.grades[i];
      marked.push(el);
    });
    return () => {
      delete scope.dataset.audit;
      for (const el of marked) delete el.dataset.grade;
    };
  }, [audit, summary, bp]);

  /* ── strip interaction ─────────────────────────────── */

  const rover = shown ?? 0;

  // a mouse press focuses first; the click that follows must not scroll a second time
  const focusedByPress = useRef(false);

  const onSegFocus = (i: number) => {
    focusedByPress.current = true;
    setSel(i);
    setFocused(true);
    claimEl(claims[i].key)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  };

  // touch browsers may not focus a tapped button; route the tap through focus so it selects and scrolls
  const onSegClick = (e: MouseEvent<HTMLButtonElement>, i: number) => {
    if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
    else if (focusedByPress.current) focusedByPress.current = false;
    else onSegFocus(i);
  };

  const onSegEnter = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (e.pointerType === "touch") return;
    setSel(i);
    setHovering(true);
  };

  const onSegKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // RTL: ArrowLeft walks forward through the answer
    const next =
      e.key === "ArrowLeft" ? i + 1 : e.key === "ArrowRight" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    stripRef.current?.querySelectorAll<HTMLButtonElement>("[data-seg]")[Math.max(0, Math.min(n - 1, next))]?.focus();
  };

  const onStripBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  const show = (chunkId: string, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (mobile) openModal({ type: "inspector", chunkId, siblings: refs.map((r) => r.id) });
    else openCitation(chunkId, e.currentTarget);
  };

  /* ── detail line ───────────────────────────────────── */

  const detail = useMemo(() => {
    if (shown === null) return null;
    const claim = claims[shown];
    const g = grades[shown];
    if (g === "uncited") {
      const s = suggest(claim, refs);
      const ref = s && refs.find((r) => r.id === s.chunkId);
      return { claim, g, suggestion: ref ? { ref, overlap: s.overlap } : null };
    }
    if (g === "orphan") {
      const missing = claim.cites.find((c) => !refs.some((r) => r.id === c))!;
      return { claim, g, orphan: chunkById(missing) ?? null };
    }
    const cited = refs.filter((r) => claim.cites.includes(r.id)).sort((a, b) => b.score - a.score)[0];
    return { claim, g, cited };
  }, [shown, claims, grades, refs]);

  if (n === 0) return null;

  const sub = mobile
    ? [`${faNum(summary.supported)} از ${faNum(n)} ادعا`, `${faNum(summary.used.length)} بند`, summary.used.length > 0 && `ارتباط ${pct(summary.avgScore)}`]
    : [
        `${faNum(summary.supported)} از ${faNum(n)} ادعا`,
        `${faNum(summary.used.length)} از ${faNum(refs.length)} بند استفاده شد`,
        summary.used.length > 0 && `میانگین ارتباط ${pct(summary.avgScore)}`,
      ];

  const toggle = (
    <Button
      size="sm"
      aria-pressed={audit}
      onClick={() => writeAudit(!audit)}
      icon={<ShieldCheck weight={audit ? "fill" : "regular"} className="text-[14px]" />}
      className={cx(
        "aria-pressed:border-accent/70 aria-pressed:bg-accent/12 aria-pressed:text-accent-fg",
        mobile && "h-9 self-start px-3 text-[12.5px]",
      )}
    >
      ممیزی استناد
    </Button>
  );

  return (
    <section
      ref={rootRef}
      aria-label="پوشش استناد پاسخ"
      className="flex animate-fade-in flex-col gap-2.5 rounded-[10px] bg-panel px-3.5 py-2.5 ring-1 ring-fg/7 ring-inset max-md:gap-3 max-md:px-3"
    >
      {/* coverage */}
      <div className="flex items-center gap-3 max-md:gap-2.5">
        <div
          ref={ringRef}
          aria-hidden
          data-low={summary.coverage < 0.7 || undefined}
          className="ga-ring size-[34px] shrink-0 max-md:size-[30px]"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-[1.5] font-semibold text-fg">{pct(summary.coverage)} مستند</div>
          <div className="truncate text-[11px] leading-[1.6] text-fg/45">{sub.filter(Boolean).join(" · ")}</div>
        </div>
        {!mobile && toggle}
      </div>

      {/* claim strip */}
      <div
        ref={stripRef}
        role="toolbar"
        aria-label="ادعاهای پاسخ"
        data-live={live || undefined}
        className="ga-strip flex gap-[3px]"
        onPointerLeave={() => setHovering(false)}
        onBlur={onStripBlur}
      >
        {claims.map((c, i) => (
          <button
            key={c.key}
            type="button"
            data-seg
            data-active={i === shown || undefined}
            tabIndex={i === rover ? 0 : -1}
            aria-label={`ادعای ${faNum(i + 1)} از ${faNum(n)}: ${GRADE[grades[i]].label}`}
            onPointerEnter={(e) => onSegEnter(e, i)}
            onFocus={() => onSegFocus(i)}
            onClick={(e) => onSegClick(e, i)}
            onKeyDown={(e) => onSegKey(e, i)}
            className="ga-seg flex h-5 min-w-[10px] flex-1 items-center rounded-full focus-visible:outline-offset-1 max-md:h-7"
          >
            <span className={cx("ga-bar block h-2 w-full rounded-full", GRADE[grades[i]].bar)} />
          </button>
        ))}
      </div>

      {/* active claim */}
      <div aria-live="polite" className="flex min-h-[22px] min-w-0 items-center gap-2 text-[12px] leading-[1.7] max-md:flex-wrap max-md:gap-y-1">
        {detail ? (
          <>
            <span
              className={cx(
                "shrink-0 rounded-[5px] border border-transparent px-1.5 text-[10.5px] leading-[1.8] font-medium",
                GRADE[detail.g].chip,
              )}
            >
              {GRADE[detail.g].label}
            </span>
            <span className="min-w-0 truncate text-fg/70 max-md:flex-1"><ClaimText claim={detail.claim} /></span>
            <span className="shrink-0 text-[11.5px] whitespace-nowrap text-fg/45 max-md:basis-full max-md:whitespace-normal">
              {"cited" in detail && detail.cited && (
                <span>
                  {source(detail.cited)} · ارتباط {pct(detail.cited.score)}
                </span>
              )}
              {"orphan" in detail && (
                <span>
                  به بندی ارجاع داده که در نتایج بازیابی نبود{detail.orphan && ` (${source(detail.orphan)})`}
                </span>
              )}
              {"suggestion" in detail &&
                (detail.suggestion ? (
                  <>
                    <span>
                      منبع پیشنهادی: {source(detail.suggestion.ref)} ({pct(detail.suggestion.overlap)} هم‌پوشانی واژگانی)
                    </span>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={(e) => show(detail.suggestion!.ref.id, e)}
                      className="ms-1.5 rounded-[4px] font-medium text-accent-fg underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      نمایش
                    </button>
                  </>
                ) : (
                  <span>منبع هم‌خوانی در نتایج بازیابی پیدا نشد</span>
                ))}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-fg/55">
            <CheckCircle weight="fill" className="text-[14px] text-success" />
            همه ادعاها مستند هستند
          </span>
        )}
      </div>

      {audit && (
        <div className="flex animate-fade-in flex-wrap items-center gap-x-4 gap-y-1.5 border-t max-md:grid max-md:grid-cols-2 border-fg/7 pt-2.5 text-[11px] text-fg/50">
          {GRADES.map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cx("h-1.5 w-3.5 rounded-full", GRADE[g].bar)} />
              {GRADE[g].label}
            </span>
          ))}
        </div>
      )}

      {mobile && toggle}
    </section>
  );
}
