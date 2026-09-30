"use client";

import { Info, Warning } from "@phosphor-icons/react";
import { useState, type CSSProperties, type MouseEvent } from "react";
import { sliceInline } from "@/lib/answer";
import { cx } from "@/lib/format";
import { useBreakpoint } from "@/lib/hooks";
import { splitWords, wordSafeChars } from "@/lib/ink";
import type { Block, FormulaPart, Inline } from "@/lib/types";
import { useStore } from "@/state/store";

export function Formula({ parts, subSize = 12 }: { parts: FormulaPart[]; subSize?: number }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <sub key={i} style={{ fontSize: subSize }} className="opacity-70">
            {p.sub}
          </sub>
        ),
      )}
    </>
  );
}

/** Shared open behaviour for anything that points at a source chunk: sheet on mobile, popover elsewhere. */
function useSourceOpener(chunkId: string, siblings: string[]) {
  const { openCitation, openModal, state } = useStore();
  const bp = useBreakpoint();
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (bp === "mobile") openModal({ type: "inspector", chunkId, siblings });
    else openCitation(chunkId, e.currentTarget);
  };
  return { onClick, isOpen: state.popover?.chunkId === chunkId };
}

export function CitationBadge({ chunkId, label, siblings, active, tone = "accent", landing }: {
  chunkId: string;
  label: string;
  siblings: string[];
  active?: boolean;
  /** `warning` inside warning callouts so the badge matches the box. */
  tone?: "accent" | "warning";
  /** one-shot "lands in place" pop when the badge first appears in a streaming answer */
  landing?: boolean;
}) {
  const { onClick, isOpen: open } = useSourceOpener(chunkId, siblings);
  const isOpen = active ?? open;
  return (
    <button
      type="button"
      data-citation
      data-chunk={chunkId}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className={cx(
        "inline-flex items-center rounded-[5px] px-[7px] py-px align-[1px] text-[12px] leading-[1.6] transition-colors max-md:px-1.5 max-md:text-[11.5px]",
        landing && "ink-cite-land",
        landing && tone === "warning" && "[--ink-halo:var(--warning)]",
        tone === "warning"
          ? isOpen
            ? "bg-warning/28 text-warning ring-1 ring-inset ring-warning"
            : "bg-warning/14 text-warning ring-1 ring-inset ring-warning/45 hover:bg-warning/22"
          : isOpen
          ? "bg-accent/28 text-accent-fg-2 ring-1 ring-inset ring-accent"
          : "bg-accent/14 text-accent-fg ring-1 ring-inset ring-accent/40 hover:bg-accent/22",
      )}
    >
      {label}
    </button>
  );
}

/** Table «مرجع» cell: the row's source reference, opening the same popover as a citation badge. */
function RowCite({ chunkId, label, siblings }: { chunkId: string; label: string; siblings: string[] }) {
  const { onClick, isOpen } = useSourceOpener(chunkId, siblings);
  return (
    <button
      type="button"
      data-citation
      data-chunk={chunkId}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={`منبع: ${label}`}
      className={cx(
        "cursor-pointer rounded-[3px] text-start underline decoration-dotted underline-offset-4 transition-colors hover:text-accent-fg hover:decoration-accent/50",
        isOpen ? "text-accent-fg decoration-accent/50" : "text-fg/60 decoration-fg/30",
      )}
    >
      {label}
    </button>
  );
}

export function InlineContent({ parts, siblings, tone }: { parts: Inline[]; siblings: string[]; tone?: "accent" | "warning" }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : "b" in p ? (
          <strong key={i} className="font-semibold text-fg">
            {p.b}
          </strong>
        ) : (
          <CitationBadge key={i} chunkId={p.cite} label={p.label} siblings={siblings} tone={tone} />
        ),
      )}
    </>
  );
}

/**
 * Word-level inline renderer. Every node is keyed by its absolute offset in the
 * block's flat text (same counting as `sliceInline`), so a word keeps its DOM
 * node as the reveal grows and when the block completes: only new words ink in.
 */
function InkInline({ parts, siblings, tone, animate }: {
  parts: Inline[];
  siblings: string[];
  tone?: "accent" | "warning";
  animate: boolean;
}) {
  if (!animate) return <InlineContent parts={parts} siblings={siblings} tone={tone} />;
  const words = (text: string, at: number) =>
    splitWords(text, at).map((w) => (
      <span key={`w${w.key}`} className="ink-word">
        {w.text}
      </span>
    ));
  let o = 0;
  const nodes = parts.map((p) => {
    const at = o;
    if (typeof p === "string") {
      o += p.length;
      return words(p, at);
    }
    if ("b" in p) {
      o += p.b.length;
      return (
        <strong key={`b${at}`} className="font-semibold text-fg">
          {words(p.b, at)}
        </strong>
      );
    }
    o += p.label.length + 2;
    return <CitationBadge key={`c${at}`} chunkId={p.cite} label={p.label} siblings={siblings} tone={tone} landing />;
  });
  return <>{nodes}</>;
}

/** Streaming caret: a thin accent bar that breathes rather than blinks. */
function Caret() {
  return (
    <span
      aria-hidden
      className="ink-caret ms-[3px] inline-block h-4 w-[2px] rounded-full bg-accent align-[-2px] shadow-[0_0_8px_var(--accent)]"
    />
  );
}

/** Per-item stagger, inherited by the item's own `.ink-*` descendants via `--ink-d`. */
const stagger = (ms: number) => ({ "--ink-d": `${ms}ms` }) as CSSProperties;

/**
 * `index` = position in the answer; drives the data-claim keys (b{i}, b{i}.i{j}, b{i}.r{r}).
 * `partial` (paragraphs only) cuts the text at a word boundary and appends the caret;
 * the same <p> is reused when the paragraph completes, so nothing remounts.
 * `animate` adds the one-shot entrance choreography from styles/ink.css.
 */
function BlockView({ block, index, siblings, mobile, animate, partial }: {
  block: Block;
  index: number;
  siblings: string[];
  mobile: boolean;
  animate: boolean;
  partial?: number;
}) {
  switch (block.type) {
    case "p": {
      const parts = partial === undefined ? block.content : sliceInline(block.content, wordSafeChars(block.content, partial));
      return (
        <p data-claim={`b${index}`} className="m-0">
          <InkInline parts={parts} siblings={siblings} animate={animate} />
          {partial !== undefined && <Caret />}
        </p>
      );
    }
    case "ul":
      return (
        <ul className="m-0 flex list-disc flex-col gap-[7px] ps-5 marker:text-fg/40">
          {block.items.map((item, j) => (
            <li
              key={j}
              data-claim={`b${index}.i${j}`}
              className={animate ? "ink-rise" : undefined}
              style={animate ? stagger(j * 70) : undefined}
            >
              <InkInline parts={item} siblings={siblings} animate={animate} />
            </li>
          ))}
        </ul>
      );
    case "table": {
      const refCol = block.head.length - 1;
      return (
        <div
          className={cx(
            "overflow-hidden rounded-[10px] bg-panel ring-1 ring-inset ring-fg/8 max-lg:rounded-[9px]",
            animate && "ink-fade",
          )}
        >
          {mobile && (
            <div className="border-b border-fg/7 px-2.5 py-1.5 text-[10px] text-fg/40">{block.caption}</div>
          )}
          <div className="overflow-x-auto">
            <table className={cx("w-full border-collapse text-[13px] max-lg:text-[12px]", mobile && "min-w-[480px]")}>
              <caption className="sr-only">{block.caption}</caption>
              <thead>
                <tr className="bg-surface">
                  {block.head.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3.5 py-2.5 text-start font-latin text-[10px] font-semibold tracking-[.1em] whitespace-nowrap text-fg/55 uppercase max-lg:px-[11px] max-lg:py-2 max-lg:text-[9.5px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr
                    key={r}
                    data-claim={`b${index}.r${r}`}
                    className={cx("border-t border-fg/7", animate && "ink-rise")}
                    style={animate ? stagger(r * 45) : undefined}
                  >
                    {row.map((cell, c) => {
                      const cite = c === refCol ? block.rowCites?.[r] : undefined;
                      return (
                        <td
                          key={c}
                          className={cx(
                            "px-3.5 py-2.5 max-lg:px-[11px] max-lg:py-2",
                            block.mono?.includes(c) && "text-right font-mono text-[12px] whitespace-nowrap max-lg:text-[11px] [direction:ltr]",
                            block.muted?.includes(c) && "text-fg/60",
                          )}
                        >
                          {cite ? <RowCite chunkId={cite} label={cell} siblings={siblings} /> : cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    case "formula":
      return (
        <figure
          className={cx(
            "m-0 flex items-center gap-3.5 rounded-[10px] border-s-2 border-accent-line bg-panel px-[18px] py-4 ring-1 ring-inset ring-fg/8 max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:px-3.5",
            animate && "ink-rise",
          )}
          aria-label="فرمول"
        >
          <div
            className={cx(
              "flex-1 overflow-x-auto text-center font-mono text-[19px] whitespace-nowrap text-accent-fg-2 ltr max-md:text-[14px]",
              animate && "ink-sweep",
            )}
          >
            <Formula parts={block.expr} />
          </div>
          <div className="h-[34px] w-px bg-fg/10 max-md:hidden" />
          <figcaption className="shrink-0 text-[11px] leading-[1.8] text-fg/50">
            {block.legend.map((l, i) => (
              <div key={i}>
                <span className="font-mono ltr">
                  <Formula parts={l.sym} subSize={9} />
                </span>
                : {l.desc}
              </div>
            ))}
          </figcaption>
        </figure>
      );
    case "callout": {
      const warn = block.tone === "warning";
      const Icon = warn ? Warning : Info;
      return (
        <div
          role="note"
          data-claim={`b${index}`}
          className={cx(
            "flex gap-2.5 rounded-[10px] px-3.5 py-3 ring-1 ring-inset",
            warn ? "bg-warning/7 ring-warning/28" : "bg-info/7 ring-info/28",
            animate && "ink-slide",
          )}
        >
          <Icon className={cx("mt-[3px] shrink-0 text-[16px]", warn ? "text-warning" : "text-info", animate && "ink-nudge")} />
          <div className="text-[13px] leading-[1.8] text-fg/80">
            <InkInline parts={block.content} siblings={siblings} tone={warn ? "warning" : undefined} animate={animate} />
          </div>
        </div>
      );
    }
  }
}

/**
 * Rich answer renderer. While streaming, blocks before `reveal.block` are
 * shown in full and the current paragraph inks in word by word behind a
 * breathing caret; shimmer lines hint at what is still coming. Every block
 * lives in one keyed list, so completing a block or finishing the answer
 * never remounts (or re-animates) what is already on screen.
 */
export function AnswerBody({
  blocks,
  reveal,
  streaming,
  siblings,
  stopped,
}: {
  blocks: Block[];
  reveal: { block: number; chars: number };
  streaming: boolean;
  siblings: string[];
  /** frozen by «توقف»: suppresses the "answer ready" announcement */
  stopped?: boolean;
}) {
  const bp = useBreakpoint();
  const mobile = bp === "mobile";
  // Only answers that stream while mounted animate; restored / finished ones render static.
  const [animate, setAnimate] = useState(streaming);
  if (streaming && !animate) setAnimate(true);

  const count = streaming ? Math.min(reveal.block + 1, blocks.length) : blocks.length;
  const current = streaming ? blocks[reveal.block] : undefined;

  return (
    <div
      data-answer-body
      aria-busy={streaming}
      className="flex flex-col gap-3.5 text-[14.5px] leading-[1.95] text-fg/92 max-lg:gap-3 max-lg:text-[13.5px]"
    >
      {blocks.slice(0, count).map((b, i) =>
        streaming && i === reveal.block && b.type !== "p" ? null : (
          <BlockView
            key={i}
            block={b}
            index={i}
            siblings={siblings}
            mobile={mobile}
            animate={animate}
            partial={streaming && i === reveal.block ? reveal.chars : undefined}
          />
        ),
      )}
      {streaming && current?.type !== "p" && reveal.block < Math.max(blocks.length, 1) && (
        <p aria-hidden className={cx("m-0 h-4", blocks.length > 0 && "-mt-2")}>
          <Caret />
        </p>
      )}
      {streaming && (
        <div aria-hidden className="flex flex-col gap-[9px]">
          <div className="h-[11px] w-[78%] animate-shimmer rounded-[4px] bg-[linear-gradient(90deg,var(--panel),var(--chip),var(--panel))] bg-[length:200%_100%]" />
          <div className="h-[11px] w-[52%] animate-shimmer rounded-[4px] bg-[linear-gradient(90deg,var(--panel),var(--chip),var(--panel))] bg-[length:200%_100%]" />
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {animate && !streaming && !stopped ? "پاسخ آماده شد" : ""}
      </span>
    </div>
  );
}
