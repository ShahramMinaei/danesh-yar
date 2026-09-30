"use client";

import {
  BookOpenText,
  Brain,
  CaretDown,
  Check,
  DotsThreeOutline,
  GitBranch,
  Lightning,
  List,
  ListChecks,
  SidebarSimple,
  Sparkle,
  Stack,
  TerminalWindow,
  Trash,
} from "@phosphor-icons/react";
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx, faNum } from "@/lib/format";
import { useDismiss } from "@/lib/hooks";
import { APP_VERSION, SCOPES, modelDisplay, modelName, scopeById } from "@/lib/mock-data";
import type { ScopeId } from "@/lib/types";
import { useStore } from "@/state/store";
import { ThemePicker } from "../features/theme/theme-picker";
import { ThemeToggle } from "../features/theme/theme-toggle";
import { IconButton } from "../ui/button";
import { StatusDot, Tooltip } from "../ui/primitives";

export { ThemeToggle };

/* ── Filter badge ────────────────────────────────────── */

/** Retrieval-mode badge; clicking it toggles between auto and manual. */
export function FilterBadge({ short }: { short?: boolean }) {
  const { state, set } = useStore();
  const auto = state.mode === "auto";
  return (
    <Tooltip label={auto ? "تغییر به انتخاب دستی" : "تغییر به تشخیص خودکار"}>
      <button
        type="button"
        onClick={() => set({ mode: auto ? "manual" : "auto" })}
        aria-label="انتخاب دستی اسناد"
        aria-pressed={!auto}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[12px] font-medium whitespace-nowrap ring-1 ring-inset transition-colors max-lg:px-[9px] max-lg:py-1 max-lg:text-[11.5px]",
          auto
            ? "bg-accent-bg text-accent-fg ring-accent/40 hover:bg-accent/20"
            : "bg-surface text-fg/80 ring-fg/12 hover:bg-fg/8 hover:ring-fg/20",
        )}
      >
        {auto ? <Brain weight="fill" className="text-[13px]" /> : <ListChecks className="text-[13px] text-accent-hi" />}
        {auto ? (short ? "خودکار" : "تشخیص خودکار") : `${faNum(state.selectedDocs.length)} ${short ? "سند" : "سند فعال"}`}
      </button>
    </Tooltip>
  );
}

/* ── Scope selector ──────────────────────────────────── */

const SCOPE_ICON: Record<ScopeId, { icon: typeof Lightning; color: string }> = {
  quick: { icon: Lightning, color: "text-warning" },
  standard: { icon: Stack, color: "text-accent-hi" },
  deep: { icon: BookOpenText, color: "text-info" },
};

/** `inline` = small chip under the composer; its menu opens upward. */
export function ScopeSelector({ compact, inline }: { compact?: boolean; inline?: boolean }) {
  const { state, set } = useStore();
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);
  const current = scopeById(state.scope);

  const choose = (id: ScopeId) => {
    set({ scope: id });
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % SCOPES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i + SCOPES.length - 1) % SCOPES.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(SCOPES[focusIdx].id);
    }
  };

  return (
    <div ref={wrap} className="relative" onKeyDown={onKey}>
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setFocusIdx(SCOPES.findIndex((s) => s.id === state.scope));
          setOpen((o) => !o);
        }}
        className={cx(
          "inline-flex items-center gap-2 rounded-[8px] border font-medium whitespace-nowrap transition-colors",
          inline
            ? "h-[26px] rounded-[7px] px-[9px] text-[11px]"
            : compact
              ? "h-8 gap-1.5 px-[9px] text-[11.5px]"
              : "h-[34px] px-[11px] text-[12px]",
          open ? "border-accent bg-accent/10 text-accent-fg" : "border-fg/12 text-fg/75 hover:bg-fg/7",
        )}
      >
        <Stack className={inline ? "text-[13px]" : compact ? "text-[14px]" : "text-[15px]"} />
        {compact ? `${faNum(current.k)} بند` : `${current.label} · ${faNum(current.k)} بند`}
        <CaretDown className={cx("text-[12px] transition-transform", open ? "rotate-180 opacity-70" : "opacity-60")} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="عمق جستجو"
          className={cx(
            "absolute right-0 z-40 w-[300px] animate-pop-in rounded-[12px] bg-surface p-1.5 shadow-pop",
            inline ? "bottom-[34px]" : "top-[42px]",
          )}
        >
          <div className="kicker px-2.5 pt-2 pb-1.5">عمق جستجو</div>
          {SCOPES.map((s, i) => {
            const active = s.id === state.scope;
            const { icon: Icon, color } = SCOPE_ICON[s.id];
            return (
              <div
                key={s.id}
                role="option"
                aria-selected={active}
                onClick={() => choose(s.id)}
                onMouseEnter={() => setFocusIdx(i)}
                className={cx(
                  "flex cursor-pointer gap-2.5 rounded-[8px] px-2.5 py-[9px]",
                  active ? "bg-accent-bg ring-1 ring-inset ring-accent/40" : focusIdx === i ? "bg-fg/5" : "",
                )}
              >
                <Icon weight={active ? "fill" : "regular"} className={cx("mt-0.5 shrink-0 text-[16px]", color)} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cx("text-[13px] font-semibold", active && "text-accent-fg-2")}>{s.label}</span>
                    <span
                      className={cx(
                        "rounded-[5px] px-1.5 py-0.5 text-[10px]",
                        active ? "bg-accent-bg-2 text-accent-fg-2" : "bg-chip text-fg/60",
                      )}
                    >
                      {faNum(s.k)} بند
                    </span>
                  </div>
                  <div className={cx("mt-0.5 text-[11px]", active ? "text-fg/55" : "text-fg/45")}>{s.description}</div>
                </div>
                <Check className={cx("mt-[3px] shrink-0 text-[14px] text-accent", !active && "invisible")} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Model badge ─────────────────────────────────────── */

export const HEALTH_TONE = { connected: "success", degraded: "warning", idle: "idle" } as const;

export function ModelBadge({ compact, inline }: { compact?: boolean; inline?: boolean }) {
  const { activeProvider, openModal } = useStore();
  const tone = HEALTH_TONE[activeProvider.health];
  if (inline) {
    return (
      <button
        onClick={() => openModal({ type: "settings" })}
        aria-label="تنظیمات هوش مصنوعی و مدل"
        className="inline-flex h-[26px] shrink-0 items-center gap-[7px] rounded-[7px] border border-fg/12 px-[9px] whitespace-nowrap ltr hover:bg-fg/6"
      >
        <StatusDot tone={tone} size={6} />
        <span className="font-latin text-[11px] font-medium text-fg/50">{activeProvider.provider}</span>
        <span className="font-latin text-[11px] font-semibold">{modelDisplay(activeProvider)}</span>
        <CaretDown className="text-[10px] text-fg/45" />
      </button>
    );
  }
  if (compact) {
    return (
      <button
        onClick={() => openModal({ type: "settings" })}
        aria-label={`مدل فعال: ${activeProvider.provider} ${modelDisplay(activeProvider)}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-fg/12 bg-panel px-[9px] font-latin text-[11.5px] font-semibold whitespace-nowrap ltr hover:bg-surface"
      >
        <StatusDot tone={tone} size={6} halo={false} />
        {modelDisplay(activeProvider)}
      </button>
    );
  }
  return (
    <button
      onClick={() => openModal({ type: "settings" })}
      aria-label="تنظیمات هوش مصنوعی و مدل"
      className="inline-flex h-[34px] items-center gap-2 rounded-[8px] border border-fg/12 bg-panel px-[11px] hover:bg-surface"
    >
      <StatusDot tone={tone} />
      <span className="flex flex-col items-start leading-[1.15] ltr">
        <span className="font-latin text-[11px] font-medium text-fg/50">{activeProvider.provider}</span>
        <span className="font-latin text-[12px] font-semibold whitespace-nowrap">{modelDisplay(activeProvider)}</span>
      </span>
    </button>
  );
}

/* ── Overflow menu (tablet/mobile) ───────────────────── */

export function MenuItem({ icon, label, hint, onClick, danger, disabled }: {
  icon: ReactNode;
  label: string;
  hint?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex min-h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-start text-[13px] transition-colors disabled:opacity-40",
        danger ? "text-error hover:bg-error/10" : "hover:bg-fg/5",
      )}
    >
      <span className={cx("text-[16px]", danger ? "text-error" : "text-fg/60")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {hint}
    </button>
  );
}

function OverflowMenu({ onClose }: { onClose: () => void }) {
  const { state, openModal, clearConversation } = useStore();
  return (
    <div role="menu" className="absolute top-[calc(100%+8px)] left-0 z-40 w-[280px] animate-pop-in rounded-[12px] bg-surface p-1.5 shadow-pop">
      <MenuItem
        icon={<GitBranch />}
        label="تاریخچه نسخه‌ها"
        hint={<span className="font-mono text-[11px] text-fg/45">{APP_VERSION}</span>}
        onClick={() => openModal({ type: "releases" })}
      />
      <MenuItem icon={<TerminalWindow />} label="پایش سامانه و لاگ‌ها" onClick={() => openModal({ type: "telemetry" })} />
      <ThemePicker compact />
      <div className="my-1 h-px bg-fg/8" />
      <MenuItem
        icon={<Trash />}
        label="پاک‌کردن گفتگو"
        danger
        disabled={state.messages.length === 0}
        onClick={() => {
          clearConversation();
          onClose();
        }}
      />
    </div>
  );
}

function OverflowButton() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);
  return (
    <div ref={wrap} className="relative">
      <IconButton
        label="ابزارهای بیشتر"
        size={32}
        aria-haspopup="menu"
        aria-expanded={open}
        active={open}
        onClick={() => setOpen((o) => !o)}
        className="text-[15px]"
      >
        <DotsThreeOutline />
      </IconButton>
      {open && <OverflowMenu onClose={close} />}
    </div>
  );
}

/* ── Model menu (mobile) ─────────────────────────────── */

/**
 * Thick pill slider for search depth (Claude-style). The knob rides inside the
 * track, follows the pointer while dragging and snaps to the nearest scope on
 * release. RTL: the shallowest scope sits on the right (inline start).
 */
const TRACK_H = 36;
/** spark particles for deep mode: vertical position, travel time, stagger */
// negative delays: on open each spark is already mid-flight at a different point, so they
// never bunch up (or sit visibly waiting) at the start of the track
const SPARKS = [
  { top: "22%", dur: "1.3s", delay: "-0.2s" },
  { top: "62%", dur: "1.6s", delay: "-0.75s" },
  { top: "40%", dur: "1.1s", delay: "-0.45s" },
  { top: "74%", dur: "1.45s", delay: "-1.1s" },
  { top: "30%", dur: "1.25s", delay: "-0.95s" },
];

function DepthSlider() {
  const { state, set } = useStore();
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const max = SCOPES.length - 1;
  const idx = SCOPES.findIndex((s) => s.id === state.scope);
  const current = SCOPES[idx];
  const frac = drag ?? idx / max;
  const deep = current.id === "deep" && drag === null;
  /** position along the usable track, keeping the knob fully inside the pill */
  const at = (f: number, offset: number) => `calc(${f} * (100% - ${TRACK_H}px) + ${offset}px)`;
  const glide = drag === null ? "240ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "0ms";

  const commit = (i: number) => {
    const next = SCOPES[Math.min(max, Math.max(0, i))];
    if (next.id !== state.scope) set({ scope: next.id });
  };
  const move = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (r.right - x - TRACK_H / 2) / (r.width - TRACK_H)));
    setDrag(f);
    commit(Math.round(f * max));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 }[e.key];
    const to = step ? idx + step : e.key === "Home" ? 0 : e.key === "End" ? max : null;
    if (to === null) return;
    e.preventDefault();
    commit(to);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[12.5px] font-semibold">عمق جستجو</span>
        <span className="text-[11.5px] text-fg/50">{faNum(current.k)} بند</span>
      </div>

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="عمق جستجو"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={idx}
        aria-valuetext={`${current.label}، ${faNum(current.k)} بند`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => drag !== null && move(e.clientX)}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        style={{ height: TRACK_H }}
        className="relative mt-2.5 cursor-grab touch-none rounded-full bg-fg/8 ring-1 ring-inset ring-fg/8 select-none active:cursor-grabbing"
      >
        {/* stop marks on the empty part of the track */}
        {SCOPES.map((s, i) => (
          <span
            key={s.id}
            aria-hidden
            style={{ insetInlineStart: at(i / max, TRACK_H / 2) }}
            className="absolute top-1/2 size-1 -translate-y-1/2 translate-x-1/2 rounded-full bg-fg/25"
          />
        ))}
        {/* fill */}
        <div
          aria-hidden
          style={{ width: at(frac, TRACK_H), transition: `width ${glide}` }}
          className={cx(
            "absolute inset-y-0 start-0 overflow-hidden rounded-full bg-linear-to-l from-accent/65 to-accent shadow-[0_0_14px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
          )}
        >
          {/* deep mode: sparks racing along the fill to the knob */}
          {deep && (
            <span aria-hidden className="motion-reduce:hidden">
              {SPARKS.map((p, i) => (
                <span
                  key={i}
                  style={{ top: p.top, animationDuration: p.dur, animationDelay: p.delay }}
                  className="absolute size-[3px] animate-spark rounded-full bg-white opacity-0 shadow-[0_0_6px_2px_rgba(255,255,255,0.7)]"
                />
              ))}
            </span>
          )}
        </div>
        {/* knob, with pulsing aura rings and a one-off shockwave when deep mode kicks in */}
        <span
          aria-hidden
          style={{ insetInlineStart: at(frac, 4), transition: `inset-inline-start ${glide}, transform 150ms` }}
          className={cx("absolute top-1 size-7", drag !== null && "scale-90")}
        >
          {deep && (
            <span className="motion-reduce:hidden">
              <span className="absolute inset-0 animate-burst rounded-full bg-accent/60" />
              <span className="absolute inset-0 animate-aura rounded-full ring-2 ring-accent" />
              <span className="absolute inset-0 animate-aura rounded-full ring-2 ring-accent [animation-delay:0.8s]" />
            </span>
          )}
          <span
            className={cx(
              "absolute inset-0 rounded-full bg-white transition-shadow duration-300",
              deep
                ? "shadow-[0_0_0_3px_var(--accent),0_0_18px_4px_color-mix(in_srgb,var(--accent)_80%,transparent)]"
                : "shadow-[0_1px_5px_rgba(0,0,0,0.35)]",
            )}
          />
        </span>
      </div>

      <div className="mt-1.5 flex justify-between px-1">
        {SCOPES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            tabIndex={-1}
            onClick={() => commit(i)}
            className={cx("text-[11px] transition-colors", i === idx ? "font-semibold text-accent-fg" : "text-fg/40 hover:text-fg/70")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-2 px-0.5 text-[11px] leading-[1.6] text-fg/40">{current.description}</p>
    </div>
  );
}

/**
 * Chip showing the active model; opens model choice + search depth.
 * `up` = composer placement: the panel opens upward from the start edge.
 */
export function ModelMenu({ up }: { up?: boolean }) {
  const { activeProvider, updateProvider } = useStore();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);
  const custom = activeProvider.customModel.trim();

  return (
    <div ref={wrap} className="relative">
      <button
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`مدل فعال: ${modelDisplay(activeProvider)}`}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex h-8 max-w-[150px] items-center gap-1.5 rounded-full border ps-2 pe-2.5 transition-colors",
          open ? "border-accent bg-accent/10" : "border-fg/12 hover:bg-fg/6",
        )}
      >
        <CaretDown className={cx("shrink-0 text-[11px] text-fg/50 transition-transform", open !== !!up && "rotate-180")} />
        <span className="truncate font-latin text-[12px] font-semibold ltr">{modelDisplay(activeProvider)}</span>
        <Sparkle weight="fill" className="shrink-0 text-[14px] text-accent-hi" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="مدل و عمق جستجو"
          className={cx(
            "absolute z-40 w-[min(300px,calc(100vw-24px))] animate-pop-in rounded-[14px] bg-surface p-1.5 shadow-pop",
            up ? "right-0 bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)] left-0",
          )}
        >
          <div className="kicker px-2.5 pt-2 pb-1.5">مدل</div>
          <div role="listbox" aria-label="مدل">
            {activeProvider.models.map((m) => {
              const active = !custom && m.id === activeProvider.model;
              return (
                <div
                  key={m.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => updateProvider(activeProvider.slot, { model: m.id, customModel: "" })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateProvider(activeProvider.slot, { model: m.id, customModel: "" });
                    }
                  }}
                  className={cx(
                    "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5",
                    active ? "bg-accent-bg" : "hover:bg-fg/5",
                  )}
                >
                  <Check className={cx("shrink-0 text-[14px] text-accent", !active && "invisible")} />
                  {/* left-aligned, read LTR: name then context size */}
                  <span className="mr-auto flex items-baseline gap-2 font-latin ltr">
                    <span className={cx("text-[13px] whitespace-nowrap", active ? "font-semibold" : "text-fg/80")}>{modelName(m.id)}</span>
                    <span className="text-[10px] text-fg/40">{m.ctx}</span>
                  </span>
                  <Sparkle weight={active ? "fill" : "regular"} className={cx("shrink-0 text-[15px]", active ? "text-accent-hi" : "text-fg/40")} />
                </div>
              );
            })}
          </div>
          <div className="mx-1 my-1.5 h-px bg-fg/8" />
          <div className="px-2.5 pt-1.5 pb-2.5">
            <DepthSlider />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Top navigation ──────────────────────────────────── */

export function TopNav({ variant, onToggleSidebar }: { variant: "desktop" | "tablet" | "mobile"; onToggleSidebar: () => void }) {
  const { state } = useStore();

  if (variant === "mobile") {
    const scope = scopeById(state.scope);
    return (
      <header className="flex h-[50px] shrink-0 items-center gap-2 border-b border-fg/9 px-3">
        <IconButton label="فیلتر اسناد" size={32} onClick={onToggleSidebar} className="text-[16px] text-fg/70">
          <List />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">دانش‌یار</div>
          <div className="flex items-center gap-[5px] text-[10px] text-fg/45">
            <StatusDot tone="success" size={5} halo={false} />
            {state.mode === "auto" ? "خودکار" : `${faNum(state.selectedDocs.length)} سند`} · {faNum(scope.k)} بند
          </div>
        </div>
        <div className="shrink-0" data-tour="model">
          <ModelMenu />
        </div>
      </header>
    );
  }

  if (variant === "tablet") {
    return (
      <header className="flex h-[54px] shrink-0 items-center gap-2 border-b border-fg/9 px-3">
        <IconButton label="سایدبار" size={30} onClick={onToggleSidebar} className="text-[15px] text-fg/65">
          <SidebarSimple />
        </IconButton>
        <FilterBadge short />
        <div className="flex-1" />
        <div className="flex items-center gap-2" data-tour="model">
          <ScopeSelector compact />
          <ModelBadge compact />
        </div>
        <OverflowButton />
      </header>
    );
  }

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-fg/9 bg-app px-[18px]">
      <IconButton
        label={state.sidebarExpanded ? "جمع‌کردن سایدبار" : "باز کردن سایدبار"}
        size={32}
        tone="bare"
        onClick={onToggleSidebar}
        className="text-[16px] text-fg/65"
      >
        <SidebarSimple />
      </IconButton>
      <FilterBadge />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
