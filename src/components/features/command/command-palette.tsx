"use client";

import {
  BookOpenText,
  Brain,
  ChatCircleText,
  ChatTeardropText,
  Check,
  GearSix,
  GitBranch,
  Keyboard,
  Lightning,
  ListChecks,
  MagnifyingGlass,
  Plus,
  Question,
  Quotes,
  SidebarSimple,
  Stack,
  TerminalWindow,
} from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { search, swapLayout } from "@/lib/fa-search";
import { cx, faNum, pct } from "@/lib/format";
import { useBreakpoint, usePresence, type Breakpoint } from "@/lib/hooks";
import { shortcutById, type ShortcutId } from "@/lib/keymap";
import { CATEGORY_META, DOCS, SAMPLE_QUESTIONS, SCOPES, THEMES } from "@/lib/mock-data";
import type { ScopeId, ThemeId } from "@/lib/types";
import { useStore } from "@/state/store";
import type { ComposerHandle } from "../../chat/composer";
import { CheckboxBox, Kbd } from "../../ui/primitives";
import { useApplyTheme } from "../theme/use-apply-theme";
import { startTour } from "../tour/tour-store";
import { closePalette, usePaletteOpen } from "./palette-store";
import { KeyCombo } from "./shortcuts-sheet";

/* ── Model ───────────────────────────────────────────── */

type GroupId = "suggest" | "commands" | "theme" | "depth" | "docs" | "refs";

const GROUPS: { id: GroupId | "recent"; label: string }[] = [
  { id: "recent", label: "اخیر" },
  { id: "suggest", label: "پیشنهادها" },
  { id: "commands", label: "فرمان‌ها" },
  { id: "theme", label: "تم" },
  { id: "depth", label: "عمق جستجو" },
  { id: "docs", label: "اسناد" },
  { id: "refs", label: "ارجاع‌های این گفتگو" },
];

interface Cmd {
  /** stable id, also stored in the recents list */
  id: string;
  group: GroupId;
  label: string;
  sub?: string;
  /** small mark right after the label (a document's category dot) */
  badge?: ReactNode;
  /** extra searchable words that are never shown */
  keywords?: string;
  icon: ReactNode;
  /** keymap shortcut shown as a trailing hint */
  shortcut?: ShortcutId;
  trailing?: ReactNode;
  theme?: ThemeId;
  /** checkbox-like rows (documents) report their state and keep the palette open */
  checked?: boolean;
  keepOpen?: boolean;
  run: () => void;
}

interface Row {
  cmd: Cmd;
  ranges: [number, number][];
}

const MAX_RESULTS = 50;
const PAGE = 8;

const SCOPE_ICON: Record<ScopeId, { icon: typeof Lightning; color: string; shortcut: ShortcutId }> = {
  quick: { icon: Lightning, color: "text-warning", shortcut: "depthQuick" },
  standard: { icon: Stack, color: "text-accent-hi", shortcut: "depthStandard" },
  deep: { icon: BookOpenText, color: "text-info", shortcut: "depthDeep" },
};

/* ── Recents (per-viewer convenience, never required) ── */

const RECENT_KEY = "danesh-yar:recent-cmds";

function readRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecents().filter((r) => r !== id)].slice(0, 5)));
  } catch {}
}

/* ── Highlight ───────────────────────────────────────── */

/** Wraps the [start, end) ranges that fall inside text[offset, offset + text.length) in <mark>. */
function highlight(text: string, ranges: [number, number][], offset = 0): ReactNode {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [s0, e0] of ranges) {
    const s = Math.max(0, s0 - offset);
    const e = Math.min(text.length, e0 - offset);
    if (e <= s || s < at) continue;
    if (s > at) out.push(text.slice(at, s));
    out.push(
      <mark key={s} className="rounded-[3px] bg-accent/20 text-fg">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  if (!out.length) return text;
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/* ── Shell ───────────────────────────────────────────── */

/**
 * Ctrl/⌘K command palette on a native modal <dialog> (top layer, inert page,
 * built-in focus return). The body mounts only while open (plus the exit
 * fade), so the palette costs nothing while an answer streams.
 */
export function CommandPalette({ composer }: { composer: RefObject<ComposerHandle | null> }) {
  const open = usePaletteOpen();
  const { state, closeModal, closePopover } = useStore();
  const bp = useBreakpoint();
  const dialog = useRef<HTMLDialogElement>(null);
  const presence = usePresence(open, 200);
  const downOnBackdrop = useRef(false);

  const latest = useRef({ state, closeModal, closePopover });
  useEffect(() => {
    latest.current = { state, closeModal, closePopover };
  });

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) {
      const { state, closeModal, closePopover } = latest.current;
      if (state.modal) closeModal();
      if (state.popover) closePopover();
      if (!el.open) el.showModal();
      el.querySelector("input")?.focus();
      return;
    }
    if (el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClose = () => closePalette();
    el.addEventListener("close", onClose);
    el.addEventListener("cancel", onClose);
    return () => {
      el.removeEventListener("close", onClose);
      el.removeEventListener("cancel", onClose);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label="جستجو و فرمان‌ها"
      // the dialog box itself is covered by content, so a hit on the element is a hit on ::backdrop
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) closePalette();
        downOnBackdrop.current = false;
      }}
      className={cx(
        "cmdk fixed inset-x-0 top-[12vh] bottom-auto mx-auto my-0 max-w-none flex-col overflow-hidden border-0 bg-surface p-0 text-fg shadow-modal open:flex",
        "w-[min(640px,calc(100vw-32px))] max-h-[min(560px,76vh)] rounded-[14px]",
        "max-md:top-0 max-md:max-h-[80dvh] max-md:w-full max-md:rounded-t-none max-md:rounded-b-[16px] max-md:pt-[env(safe-area-inset-top)]",
      )}
    >
      {presence.mounted && <PaletteBody composer={composer} bp={bp} dialog={dialog} />}
    </dialog>
  );
}

/* ── Body ────────────────────────────────────────────── */

function PaletteBody({
  composer,
  bp,
  dialog,
}: {
  composer: RefObject<ComposerHandle | null>;
  bp: Breakpoint;
  dialog: RefObject<HTMLDialogElement | null>;
}) {
  const { state, set, toggleDoc, openModal, clearConversation } = useStore();
  const applyTheme = useApplyTheme();
  const open = usePaletteOpen();
  const mobile = bp === "mobile";
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState(readRecents);
  // reopened during the exit fade (body still mounted): start fresh
  const [session, setSession] = useState(open);
  if (session !== open) {
    setSession(open);
    if (open) {
      setQuery("");
      setActive(0);
      setRecents(readRecents());
    }
  }
  const list = useRef<HTMLDivElement>(null);
  const fromKeyboard = useRef(false);
  const lastPointer = useRef({ x: -1, y: -1 });

  /* commands */
  const cmds = useMemo<Cmd[]>(() => {
    const auto = state.mode === "auto";
    const center = () => {
      const r = dialog.current?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
    };
    const out: Cmd[] = [];

    SAMPLE_QUESTIONS.forEach((q, i) =>
      out.push({
        id: `q:${i}`,
        group: "suggest",
        label: q,
        icon: <ChatCircleText />,
        run: () => composer.current?.fill(q),
      }),
    );

    out.push(
      { id: "cmd:new", group: "commands", label: "گفتگوی جدید", keywords: "new chat پاک کردن", icon: <Plus />, shortcut: "newChat", run: clearConversation },
      { id: "cmd:settings", group: "commands", label: "تنظیمات مدل", keywords: "model ai هوش مصنوعی سرویس کلید", icon: <GearSix />, run: () => openModal({ type: "settings" }) },
      { id: "cmd:telemetry", group: "commands", label: "پایش سامانه", keywords: "telemetry log لاگ", icon: <TerminalWindow />, run: () => openModal({ type: "telemetry" }) },
      { id: "cmd:releases", group: "commands", label: "تاریخچه نسخه‌ها", keywords: "release changelog version", icon: <GitBranch />, run: () => openModal({ type: "releases" }) },
      { id: "cmd:shortcuts", group: "commands", label: "میان‌برها", keywords: "keyboard shortcuts کلید", icon: <Keyboard />, shortcut: "shortcuts", run: () => openModal({ type: "shortcuts" }) },
      { id: "cmd:tour", group: "commands", label: "راهنمای استفاده", keywords: "tour guide help", icon: <Question />, run: startTour },
      { id: "cmd:feedback", group: "commands", label: "ارسال بازخورد", keywords: "feedback نظر", icon: <ChatTeardropText />, run: () => openModal({ type: "feedback" }) },
      {
        id: "cmd:mode",
        group: "commands",
        label: "تغییر حالت بازیابی",
        sub: auto ? "اکنون: تشخیص خودکار" : "اکنون: انتخاب دستی",
        keywords: "mode retrieval",
        icon: auto ? <Brain /> : <ListChecks />,
        run: () => set({ mode: auto ? "manual" : "auto" }),
      },
      {
        id: "cmd:sidebar",
        group: "commands",
        label: "باز/بسته کردن سایدبار",
        keywords: "sidebar",
        icon: <SidebarSimple />,
        shortcut: "sidebar",
        run: () => (bp === "mobile" ? set({ drawerOpen: !state.drawerOpen }) : set({ sidebarExpanded: !state.sidebarExpanded })),
      },
    );

    THEMES.forEach((t) =>
      out.push({
        id: `theme:${t.id}`,
        group: "theme",
        label: t.label,
        keywords: `تم theme ${t.id}`,
        theme: t.id,
        icon: (
          <span data-theme={t.id} className="grid size-4 place-items-center rounded-full bg-app ring-1 ring-line">
            <span className="size-[7px] rounded-full bg-accent" />
          </span>
        ),
        trailing: state.theme === t.id ? <Check weight="bold" className="text-[13px] text-accent" /> : undefined,
        checked: state.theme === t.id,
        // themes change only when chosen (click / Enter), never on hover
        run: () => applyTheme(t.id, center()),
      }),
    );

    SCOPES.forEach((s) => {
      const { icon: Icon, color, shortcut } = SCOPE_ICON[s.id];
      out.push({
        id: `depth:${s.id}`,
        group: "depth",
        label: s.label,
        sub: `${faNum(s.k)} بند`,
        keywords: `عمق depth ${s.description}`,
        icon: <Icon className={color} />,
        shortcut,
        trailing: state.scope === s.id ? <Check weight="bold" className="text-[13px] text-accent" /> : undefined,
        checked: state.scope === s.id,
        run: () => set({ scope: s.id }),
      });
    });

    DOCS.forEach((d) => {
      const on = state.selectedDocs.includes(d.id);
      const cat = CATEGORY_META[d.category];
      out.push({
        id: `doc:${d.id}`,
        group: "docs",
        label: d.title,
        keywords: `${d.short} ${cat.label} سند`,
        icon: <CheckboxBox checked={on} size={15} />,
        badge: <span aria-hidden title={cat.label} className={cx("size-1.5 shrink-0 self-center rounded-full", cat.color)} />,
        checked: on,
        keepOpen: true,
        run: () => {
          set({ mode: "manual" });
          toggleDoc(d.id);
        },
      });
    });

    const seen = new Set<string>();
    for (const m of state.messages) {
      if (m.role !== "assistant") continue;
      const siblings = m.refs.map((r) => r.id);
      for (const r of m.refs) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          id: `ref:${r.id}`,
          group: "refs",
          label: `${r.docShort} — ${r.clause}`,
          sub: r.topic,
          keywords: r.title,
          icon: <Quotes />,
          trailing: <span className="font-latin text-[11px] text-fg/40 ltr">{pct(r.score)}</span>,
          run: () => openModal({ type: "inspector", chunkId: r.id, siblings }),
        });
      }
    }
    return out;
  }, [state, set, toggleDoc, openModal, clearConversation, applyTheme, composer, dialog, bp]);

  /* ranked, grouped rows */
  const { sections, rows, swappedQuery } = useMemo(() => {
    const q = query.trim();
    const sections: { id: string; label: string; rows: Row[] }[] = [];
    let swappedQuery: string | null = null;

    if (!q) {
      const byId = new Map(cmds.map((c) => [c.id, c]));
      const recent = recents.map((id) => byId.get(id)).filter((c): c is Cmd => !!c);
      if (recent.length) sections.push({ id: "recent", label: "اخیر", rows: recent.map((cmd) => ({ cmd, ranges: [] })) });
      for (const g of GROUPS.slice(1)) {
        const inGroup = cmds.filter((c) => c.group === g.id);
        if (inGroup.length) sections.push({ id: g.id, label: g.label, rows: inGroup.map((cmd) => ({ cmd, ranges: [] })) });
      }
    } else {
      const hits = search(cmds, q, (c) => `${c.label} ${c.sub ?? ""} ${c.keywords ?? ""}`).slice(0, MAX_RESULTS);
      if (hits[0]?.swapped) swappedQuery = swapLayout(q);
      // groups ordered by their best hit, rows by score inside each group
      for (const h of hits) {
        let sec = sections.find((s) => s.id === h.item.group);
        if (!sec) {
          sec = { id: h.item.group, label: GROUPS.find((g) => g.id === h.item.group)!.label, rows: [] };
          sections.push(sec);
        }
        sec.rows.push({ cmd: h.item, ranges: h.ranges });
      }
    }
    return { sections, rows: sections.flatMap((s) => s.rows), swappedQuery };
  }, [cmds, query, recents]);

  const current = rows[Math.min(active, rows.length - 1)];
  const activeIdx = current ? Math.min(active, rows.length - 1) : -1;

  // keep the keyboard-selected row visible
  useEffect(() => {
    if (!fromKeyboard.current) return;
    fromKeyboard.current = false;
    list.current?.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const execute = (row: Row | undefined) => {
    if (!row) return;
    pushRecent(row.cmd.id);
    if (!row.cmd.keepOpen) closePalette();
    row.cmd.run();
  };

  const move = (to: number) => {
    fromKeyboard.current = true;
    setActive(to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = rows.length;
    const at = Math.max(0, activeIdx);
    switch (e.key) {
      case "ArrowDown":
        if (n) move((at + 1) % n);
        break;
      case "ArrowUp":
        if (n) move((at - 1 + n) % n);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(Math.max(0, n - 1));
        break;
      case "PageDown":
        move(Math.min(n - 1, at + PAGE));
        break;
      case "PageUp":
        move(Math.max(0, at - PAGE));
        break;
      case "Enter":
        execute(current);
        break;
      case "Escape":
        closePalette();
        break;
      case "Tab":
        break; // focus stays in the input; the list is navigated with arrows
      default:
        return;
    }
    e.preventDefault();
  };

  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;
  let index = -1;

  return (
    <>
      {/* input row */}
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-fg/9 ps-4 pe-3 max-md:h-14">
        <MagnifyingGlass aria-hidden className="shrink-0 text-[17px] text-fg/45" />
        <input
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIdx >= 0 ? optId(activeIdx) : undefined}
          aria-autocomplete="list"
          aria-label="جستجو یا اجرای فرمان"
          placeholder="جستجو یا اجرای فرمان…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            list.current?.scrollTo({ top: 0 });
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] outline-none placeholder:text-fg/35 focus-visible:outline-none max-md:text-[16px]"
        />
        {mobile ? (
          <button type="button" onClick={closePalette} className="shrink-0 rounded-[8px] px-2 py-1.5 text-[13px] text-accent hover:text-accent-hi">
            لغو
          </button>
        ) : (
          // the Esc keycap doubles as a close button for mouse users
          <button
            type="button"
            onClick={closePalette}
            aria-label="بستن (Esc)"
            title="بستن"
            className="shrink-0 rounded-[6px] transition-opacity hover:opacity-70"
          >
            <Kbd>Esc</Kbd>
          </button>
        )}
      </div>

      {/* results */}
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label="نتایج"
        onPointerDown={(e) => e.preventDefault()} // keep the caret in the input
        onPointerMove={(e) => {
          // only a real pointer move picks a row, not the list scrolling under a still cursor
          if (e.clientX === lastPointer.current.x && e.clientY === lastPointer.current.y) return;
          lastPointer.current = { x: e.clientX, y: e.clientY };
          const idx = Number((e.target as HTMLElement).closest<HTMLElement>("[data-idx]")?.dataset.idx ?? -1);
          if (idx >= 0 && idx !== activeIdx) setActive(idx);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {sections.map((sec) => (
          <div key={sec.id} role="group" aria-labelledby={`${baseId}-g-${sec.id}`}>
            <div id={`${baseId}-g-${sec.id}`} className="kicker px-2.5 pt-3 pb-1.5">
              {sec.label}
            </div>
            {sec.rows.map((row) => {
              index += 1;
              const i = index;
              const { cmd } = row;
              const on = i === activeIdx;
              const subOffset = cmd.label.length + 1;
              return (
                <div
                  key={`${sec.id}:${cmd.id}`}
                  id={optId(i)}
                  data-idx={i}
                  role="option"
                  aria-selected={on}
                  aria-checked={cmd.checked === undefined ? undefined : cmd.checked}
                  onClick={() => execute(row)}
                  className={cx(
                    "flex min-h-10 cursor-pointer items-center gap-3 rounded-[8px] px-2.5 py-1.5 max-md:min-h-11",
                    on && "bg-fg/6",
                  )}
                >
                  <span aria-hidden className={cx("grid size-5 shrink-0 place-items-center text-[16px]", on ? "text-accent-hi" : "text-fg/50")}>
                    {cmd.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className={cx("truncate text-[13px]", on ? "text-fg" : "text-fg/80")}>{highlight(cmd.label, row.ranges)}</span>
                    {cmd.badge}
                    {cmd.sub && (
                      <span className="shrink-0 truncate text-[11.5px] text-fg/40 max-md:hidden">{highlight(cmd.sub, row.ranges, subOffset)}</span>
                    )}
                  </span>
                  {cmd.trailing}
                  {cmd.shortcut && !mobile && <KeyCombo keys={shortcutById(cmd.shortcut).keys} />}
                </div>
              );
            })}
          </div>
        ))}

        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
            <div className="text-[13.5px] text-fg/75">نتیجه‌ای یافت نشد</div>
            <div className="text-[12px] text-fg/40">املای دیگری امتحان کنید یا واژهٔ کوتاه‌تری بنویسید</div>
          </div>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {query.trim() ? `${faNum(rows.length)} نتیجه` : ""}
      </div>

      {/* footer */}
      {(!mobile || swappedQuery) && (
        <div className="flex h-9 shrink-0 items-center gap-3 border-t border-fg/9 px-4 text-[11px] text-fg/40">
          {swappedQuery && (
            <span className="min-w-0 truncate">
              نتایج برای «<span className="text-fg/75">{swappedQuery}</span>»
            </span>
          )}
          {!mobile && (
            <span className="ms-auto flex shrink-0 items-center gap-1.5">
              <Kbd>↑↓</Kbd> انتخاب
              <span className="text-fg/20">·</span>
              <Kbd>↵</Kbd> اجرا
              <span className="text-fg/20">·</span>
              <Kbd>Esc</Kbd> بستن
            </span>
          )}
        </div>
      )}
    </>
  );
}
