"use client";

import {
  Brain,
  CaretDown,
  ChatCircle,
  ChatCircleText,
  ChatTeardropText,
  Files,
  GearSix,
  GitBranch,
  Keyboard,
  ListChecks,
  Plus,
  Question,
  TerminalWindow,
  SidebarSimple,
  X,
} from "@phosphor-icons/react";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx, faNum } from "@/lib/format";
import { useDismiss } from "@/lib/hooks";
import { APP_VERSION, CATEGORY_META, CHAT_HISTORY, DOCS, SCOPES, modelDisplay } from "@/lib/mock-data";
import type { RetrievalMode } from "@/lib/types";
import { useStore } from "@/state/store";
import { PaletteTrigger } from "../features/command/palette-trigger";
import { ThemePicker } from "../features/theme/theme-picker";
import { startTour } from "../features/tour/tour-store";
import { IconButton } from "../ui/button";
import { CheckboxBox, Kbd, Segmented, StatusDot, Tooltip } from "../ui/primitives";
import { HEALTH_TONE, MenuItem } from "./top-nav";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.53 }}
      className="grid shrink-0 place-items-center rounded-[9px] bg-accent-bg text-accent-hi ring-1 ring-inset ring-accent-line"
    >
      <Brain />
    </div>
  );
}

const MODES: { id: RetrievalMode; label: string; desc: string }[] = [
  { id: "auto", label: "تشخیص خودکار", desc: "سیستم اسناد مرتبط را خودش انتخاب می‌کند" },
  { id: "manual", label: "انتخاب دستی", desc: "اسناد مرجع را خودتان مشخص کنید" },
];

/** Retrieval-mode card. The manual card is framed by its parent `ManualPanel`. */
function ModeCard({ mode, active, onClick }: { mode: (typeof MODES)[number]; active: boolean; onClick: () => void }) {
  const Icon = mode.id === "auto" ? Brain : ListChecks;
  const framed = mode.id === "manual";
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cx(
        "flex w-full gap-2.5 p-[11px] text-start transition-colors",
        !framed && "rounded-[8px] ring-1 ring-inset",
        !framed && (active ? "bg-accent-bg ring-accent" : "ring-fg/10 hover:bg-fg/4"),
      )}
    >
      <Icon
        weight={active ? (mode.id === "auto" ? "fill" : "bold") : "regular"}
        className={cx("mt-px shrink-0 text-[17px]", active ? "text-accent-hi" : "text-fg/55")}
      />
      <div className="min-w-0 flex-1">
        <span className={cx("text-[13px] font-semibold", active ? "text-accent-fg-2" : "text-fg/80")}>{mode.label}</span>
        <div className={cx("mt-0.5 text-[11px] leading-[1.6]", active ? "text-fg/50" : "text-fg/45")}>{mode.desc}</div>
      </div>
    </button>
  );
}

/** Manual mode: the mode card smoothly expands into a panel holding the document list. */
function ManualPanel({ open }: { open: boolean }) {
  const { state, set, toggleDoc, setAllDocs } = useStore();
  const selected = state.selectedDocs;
  const allSelected = selected.length === DOCS.length;
  return (
    <div
      className={cx(
        "flex flex-col overflow-hidden ring-1 ring-inset transition-[background-color,box-shadow,border-radius] duration-300 ease-out motion-reduce:transition-none",
        open ? "rounded-[10px] bg-accent-bg/45 ring-accent" : "rounded-[8px] ring-fg/10 hover:bg-fg/4",
      )}
    >
      <ModeCard mode={MODES[1]} active={open} onClick={() => set({ mode: "manual" })} />
      <div
        inert={!open}
        className={cx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-t border-accent/25 px-[11px] py-2">
            <span className="text-[11px] text-fg/55">
              {faNum(selected.length)} از {faNum(DOCS.length)} سند انتخاب شده
            </span>
            <button onClick={() => setAllDocs(!allSelected)} className="text-[11px] text-accent hover:text-accent-hi">
              {allSelected ? "حذف انتخاب" : "انتخاب همه"}
            </button>
          </div>
          <div className="flex items-center gap-2.5 px-[11px] pt-0.5 pb-2 text-[10px] text-fg/40">
            {Object.values(CATEGORY_META).map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1">
                <span className={cx("size-[5px] rounded-full", c.color)} />
                {c.label}
              </span>
            ))}
            <span className="ms-auto">تعداد بند</span>
          </div>
          <div className="flex flex-col gap-[3px] px-1.5 pb-1.5" role="group" aria-label="اسناد مرجع">
            {DOCS.map((d) => {
              const on = selected.includes(d.id);
              const cat = CATEGORY_META[d.category];
              return (
                <button
                  key={d.id}
                  role="checkbox"
                  aria-checked={on}
                  title={`${cat.label} · ${faNum(d.chunks)} بند`}
                  onClick={() => toggleDoc(d.id)}
                  className={cx(
                    "flex items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-start transition-colors",
                    on ? "bg-surface ring-1 ring-inset ring-accent/35" : "ring-1 ring-inset ring-fg/8 hover:bg-fg/4",
                  )}
                >
                  <CheckboxBox checked={on} />
                  <span className={cx("size-1.5 shrink-0 rounded-full", cat.color)} />
                  <span className={cx("min-w-0 flex-1 truncate text-[12.5px] leading-[1.4] font-medium", !on && "text-fg/75")}>{d.title}</span>
                  <span className="shrink-0 text-[10px] whitespace-nowrap text-fg/40">{faNum(d.chunks)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kicker-style section heading that collapses its section (arrow turns sideways when closed). */
function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-expanded={open} className="inline-flex items-center gap-[5px] hover:opacity-80">
      <span className="kicker whitespace-nowrap">{label}</span>
      <CaretDown className={cx("text-[11px] text-fg/45 transition-transform duration-150", !open && "rotate-90")} />
    </button>
  );
}

function HistoryItem({ icon, title, when, active, onClick }: {
  icon: ReactNode;
  title: string;
  when: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active || undefined}
      className={cx(
        "flex items-center gap-2 rounded-[7px] px-[9px] py-[7px] text-start transition-colors",
        active ? "bg-surface" : "hover:bg-fg/5",
      )}
    >
      <span className={cx("shrink-0 text-[14px]", active ? "text-accent-hi" : "text-fg/40")}>{icon}</span>
      <span className={cx("min-w-0 flex-1 truncate text-[12.5px]", !active && "text-fg/75")}>{title}</span>
      <span className="shrink-0 text-[10px] text-fg/35">{when}</span>
    </button>
  );
}

/** Gear button in the sidebar footer; its settings menu opens upward. */
/** `side` = rail placement: the menu opens beside the rail (toward the content) instead of above. */
function SettingsMenu({ side, size = 32 }: { side?: boolean; size?: 32 | 34 | 36 }) {
  const { state, set, openModal, activeProvider } = useStore();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);

  // keep the menu fully on screen: the sidebar sits flush against the viewport edge, so nudge it back in
  // (margins, not transform, so the pop-in animation keeps working)
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = menu.current;
    if (!open || !el) return;
    const M = 8;
    const r = el.getBoundingClientRect();
    const dx = r.right > innerWidth - M ? innerWidth - M - r.right : r.left < M ? M - r.left : 0;
    const dy = r.top < M ? M - r.top : 0;
    el.style.marginLeft = `${dx}px`;
    el.style.marginBottom = `${-dy}px`;
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <IconButton
        label="تنظیمات"
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        tone="bare"
        onClick={() => setOpen((o) => !o)}
        className={cx("text-[18px]", open && "bg-fg/8 text-fg/85")}
      >
        <GearSix weight={open ? "fill" : "regular"} />
      </IconButton>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="تنظیمات"
          className={cx(
            "absolute z-40 w-[280px] animate-pop-in rounded-[12px] bg-surface p-1.5 shadow-pop [&_[role=menuitem]]:min-h-9",
            side ? "right-[calc(100%+12px)] bottom-0" : "bottom-[calc(100%+8px)] left-0",
          )}
        >
          <div className="kicker px-2.5 pt-2 pb-1">ظاهر و جستجو</div>
          <ThemePicker />
          <div className="px-2.5 pt-1 pb-2">
            <div className="mb-1.5 text-[11px] text-fg/50">عمق پیش‌فرض جستجو</div>
            <Segmented
              ariaLabel="عمق پیش‌فرض جستجو"
              value={state.scope}
              onChange={(v) => set({ scope: v })}
              className="w-full [&>button]:flex-1"
              options={SCOPES.map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>

          <div className="my-1 h-px bg-fg/8" />
          <div className="kicker px-2.5 pt-1.5 pb-1">هوش مصنوعی و سامانه</div>
          <MenuItem
            icon={<StatusDot tone={HEALTH_TONE[activeProvider.health]} />}
            label="مدل و سرویس هوش مصنوعی"
            hint={<span className="font-latin text-[11px] text-fg/45 ltr">{modelDisplay(activeProvider)}</span>}
            onClick={() => openModal({ type: "settings" })}
          />
          <MenuItem icon={<TerminalWindow />} label="پایش سامانه و لاگ‌ها" onClick={() => openModal({ type: "telemetry" })} />
          <MenuItem
            icon={<GitBranch />}
            label="تاریخچه نسخه‌ها"
            hint={<span className="font-mono text-[11px] text-fg/45">{APP_VERSION}</span>}
            onClick={() => openModal({ type: "releases" })}
          />

          <div className="my-1 h-px bg-fg/8" />
          <div className="kicker px-2.5 pt-1.5 pb-1">راهنما و پشتیبانی</div>
          <MenuItem
            icon={<Keyboard />}
            label="میان‌برهای صفحه‌کلید"
            hint={<Kbd>?</Kbd>}
            onClick={() => openModal({ type: "shortcuts" })}
          />
          <MenuItem
            icon={<Question />}
            label="راهنمای استفاده"
            onClick={() => {
              close();
              startTour();
            }}
          />
          <MenuItem icon={<ChatTeardropText />} label="ارسال بازخورد" onClick={() => openModal({ type: "feedback" })} />
        </div>
      )}
    </div>
  );
}

/**
 * Full sidebar panel. Same content everywhere: brand, one scrolling middle
 * (retrieval mode → documents → history) and a one-line status footer.
 *  - docked:  desktop, persistent 288px column
 *  - overlay: tablet, 320px panel over content
 *  - drawer:  mobile, full-width drawer with a close button
 */
export function SidebarPanel({ variant, onClose }: { variant: "docked" | "overlay" | "drawer"; onClose: () => void }) {
  const { state, set, clearConversation, openModal, toast } = useStore();
  const drawer = variant === "drawer";
  const [histOpen, setHistOpen] = useState(true);
  const currentQuestion = state.messages.find((m) => m.role === "user")?.text;
  const historyUnavailable = () => toast("info", "بارگذاری گفتگوهای قبلی هنوز در دسترس نیست");

  return (
    <aside
      aria-label="فیلتر پایگاه دانش"
      className={cx(
        "flex h-full flex-col bg-panel",
        drawer ? "w-full" : variant === "overlay" ? "w-[320px] border-e border-fg/9" : "w-[288px] border-e border-fg/9",
        variant === "overlay" && "shadow-[-16px_0_40px_var(--shadow-color)]",
      )}
    >
      {/* brand */}
      {/* 59px = the top nav's content height (60 − its 1px border), so both rows share one centre line */}
      {/* end padding is tighter so the header actions sit closer to the edge */}
      <div className={cx("flex shrink-0 items-center gap-2.5 ps-3.5 pe-2", drawer ? "py-3" : "h-[59px]")}>
        <BrandMark size={drawer ? 32 : 34} />
        <div className={cx("min-w-0 flex-1 leading-none font-semibold", drawer ? "text-[14px]" : "text-[15px]")}>دانش‌یار</div>
        {/* header actions, grouped tight */}
        <div className="flex shrink-0 items-center">
          <PaletteTrigger />
          {variant === "docked" && (
            // same panel icon as the navbar's open button, with the sidebar strip shaded: "the sidebar is showing"
            <IconButton label="جمع‌کردن سایدبار" size={32} tone="bare" onClick={onClose} className="text-[16px] text-fg/60">
              <SidebarSimple weight="duotone" />
            </IconButton>
          )}
          {drawer && (
            <IconButton label="بستن" size={32} onClick={onClose} className="ms-1.5 text-[14px] text-fg/70">
              <X />
            </IconButton>
          )}
        </div>
      </div>

      {/* scrolling middle */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-2.5">
        <div className="flex flex-col gap-2 px-3.5 pt-1.5 pb-2" role="radiogroup" aria-label="حالت بازیابی" data-tour="mode">
          <div className="kicker">حالت بازیابی</div>
          <div className="flex flex-col gap-1.5">
            <ModeCard mode={MODES[0]} active={state.mode === "auto"} onClick={() => set({ mode: "auto" })} />
            <ManualPanel open={state.mode === "manual"} />
          </div>
        </div>

        {/* conversation history */}
        <div className="mt-1.5 flex shrink-0 flex-col gap-1.5 px-3.5 pt-3">
          <div className="flex items-center justify-between">
            <SectionToggle label="تاریخچه گفتگوها" open={histOpen} onToggle={() => setHistOpen((o) => !o)} />
            <button
              onClick={() => {
                clearConversation();
                if (drawer) onClose();
              }}
              disabled={state.messages.length === 0}
              title="گفتگوی جدید"
              className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-fg/12 px-2 text-[11px] font-medium text-fg/70 hover:bg-fg/7 disabled:opacity-40"
            >
              <Plus className="text-[12px]" />
              جدید
            </button>
          </div>
          {histOpen && (
            <>
              <div className="flex flex-col gap-0.5">
                {currentQuestion && (
                  <HistoryItem icon={<ChatCircleText />} title={currentQuestion} when="اکنون" active onClick={() => drawer && onClose()} />
                )}
                {CHAT_HISTORY.map((h) => (
                  <HistoryItem key={h.id} icon={<ChatCircle />} title={h.title} when={h.when} onClick={historyUnavailable} />
                ))}
              </div>
              <button onClick={historyUnavailable} className="self-start px-[9px] pt-0.5 text-[11px] text-accent hover:text-accent-hi">
                مشاهده همه گفتگوها
              </button>
            </>
          )}
        </div>
      </div>

      {/* footer */}
      <div
        className={cx(
          "flex shrink-0 items-center gap-2 border-t border-fg/8 px-3.5",
          drawer ? "pt-3 pb-[max(12px,env(safe-area-inset-bottom))]" : "py-3",
        )}
      >
        <StatusDot tone="success" />
        <span className="text-[12px] font-medium whitespace-nowrap">پایگاه دانش آنلاین</span>
        <button
          onClick={() => openModal({ type: "releases" })}
          title="تاریخچه نسخه‌ها"
          className="ms-auto font-mono text-[10px] font-medium text-fg/35 ltr hover:text-accent-hi"
        >
          {APP_VERSION}
        </button>
        <SettingsMenu />
      </div>
    </aside>
  );
}

/** Collapsed icon rail (desktop 64px · tablet 56px). */
export function SidebarRail({ compact, onExpand }: { compact?: boolean; onExpand: () => void }) {
  const { state } = useStore();
  const btn = compact ? 34 : 36;
  const auto = state.mode === "auto";
  return (
    <aside
      aria-label="فیلتر پایگاه دانش (جمع‌شده)"
      style={{ width: compact ? 56 : 64 }}
      className={cx("flex h-full shrink-0 flex-col items-center gap-2 border-e border-fg/9 bg-panel", compact ? "py-3" : "py-3.5")}
    >
      <Tooltip label="دانش‌یار — باز کردن سایدبار" side="left">
        <button onClick={onExpand} aria-label="باز کردن سایدبار" className="rounded-[9px]">
          <BrandMark size={compact ? 32 : 34} />
        </button>
      </Tooltip>
      <div className={cx("h-px bg-fg/10", compact ? "my-1 w-[22px]" : "my-1.5 w-6")} />
      <PaletteTrigger size={btn} rail />
      {/* mirrors the retrieval mode: auto → brain, manual → documents with the selected count */}
      <Tooltip label={auto ? "تشخیص خودکار اسناد" : `${faNum(state.selectedDocs.length)} سند انتخاب‌شده`} side="left">
        <button
          onClick={onExpand}
          aria-label={auto ? "حالت بازیابی: تشخیص خودکار" : "اسناد مرجع"}
          style={{ width: btn, height: btn, fontSize: compact ? 15 : 16 }}
          className={cx(
            "relative grid place-items-center rounded-[9px] transition-colors",
            auto ? "bg-accent/12 text-accent-hi hover:bg-accent/20" : "bg-fg/6 text-fg/65 ring-1 ring-inset ring-fg/8 hover:bg-fg/10 hover:text-fg/90",
          )}
        >
          {auto ? <Brain weight="fill" /> : <Files />}
          {!auto && (
            <span
              className={cx(
                "absolute -top-[4px] -left-[4px] grid place-items-center rounded-[8px] bg-accent px-1 font-latin font-semibold text-on-accent ring-2 ring-panel",
                compact ? "h-[15px] min-w-[15px] text-[9px]" : "h-4 min-w-4 text-[10px]",
              )}
            >
              {faNum(state.selectedDocs.length)}
            </span>
          )}
        </button>
      </Tooltip>
      <Tooltip label="تاریخچه گفتگوها" side="left">
        <button
          onClick={onExpand}
          aria-label="تاریخچه گفتگوها"
          style={{ width: btn, height: btn, fontSize: compact ? 16 : 17 }}
          className="grid place-items-center rounded-[9px] text-fg/55 transition-colors hover:bg-fg/6 hover:text-fg/85"
        >
          <ChatCircleText />
        </button>
      </Tooltip>
      <div className="flex-1" />
      <SettingsMenu side size={btn} />
    </aside>
  );
}
