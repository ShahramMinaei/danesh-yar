"use client";

import { CaretDown, Check, CheckCircle, CircleNotch, Eye, EyeSlash, Key, Plugs, SlidersHorizontal, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx, faNum, faTime } from "@/lib/format";
import { useBreakpoint, useDismiss } from "@/lib/hooks";
import { SLOT_LABELS } from "@/lib/mock-data";
import type { ConnectionTest, ProviderConfig, ProviderSlot } from "@/lib/types";
import { useStore } from "@/state/store";
import { Button } from "../ui/button";
import { Segmented, StatusDot } from "../ui/primitives";
import { ModalHeader } from "../ui/modal";

/* ── Simulated connection test ───────────────────────── */

async function testConnection(p: ProviderConfig): Promise<ConnectionTest> {
  await new Promise((r) => setTimeout(r, 1300));
  const key = p.apiKey.trim();
  const needsKey = p.slot !== "custom";
  if (p.baseUrlRequired && !/^https?:\/\/\S+$/.test(p.baseUrl.trim())) {
    return { state: "failed", message: "آدرس پایه معتبر نیست.", code: `ERR_INVALID_URL · provider ${p.provider.toLowerCase()}` };
  }
  if (needsKey && !key) {
    return { state: "failed", message: "کلید API وارد نشده است.", code: `401 missing_api_key · provider ${p.provider.toLowerCase()}` };
  }
  if (needsKey && (key.length < 12 || /invalid|wrong/i.test(key))) {
    return { state: "failed", message: "کلید API نامعتبر است یا اعتبار آن پایان یافته.", code: `401 invalid_api_key · provider ${p.provider.toLowerCase()}` };
  }
  if (p.slot === "custom") return { state: "slow", latencyMs: 3200 };
  return { state: "success", latencyMs: p.slot === "gateway" ? 610 : 420, sample: "اتصال با موفقیت برقرار شد." };
}

/* ── Fields ──────────────────────────────────────────── */

function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className={cx("mb-1.5 block text-[11.5px]", error ? "text-error" : "text-fg/65")}>{label}</label>
      {children}
      {(error || hint) && <div className={cx("mt-[5px] text-[10.5px]", error ? "text-error" : "text-fg/35")}>{error ?? hint}</div>}
    </div>
  );
}

const inputShell = (focus: boolean, error?: boolean) =>
  cx(
    "flex h-[38px] items-center gap-2 rounded-[8px] bg-panel px-2.5 ring-1 ring-inset transition-shadow max-md:h-11",
    error ? "ring-error" : focus ? "ring-accent" : "ring-fg/12 hover:ring-fg/42",
  );

function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  icon,
  trailing,
  type = "text",
  error,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  type?: string;
  error?: boolean;
  ariaLabel: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div className={inputShell(focus, error)}>
      {icon}
      <input
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        type={type}
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={cx(
          "h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-fg/30 focus-visible:outline-none",
          mono && "font-mono ltr text-left",
        )}
      />
      {trailing}
    </div>
  );
}

function ModelSelect({ provider, onChange }: { provider: ProviderConfig; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);
  const current = provider.models.find((m) => m.id === provider.model) ?? provider.models[0];
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(inputShell(open), "w-full")}
      >
        <span className="flex-1 text-left font-latin text-[13px] font-medium ltr">{current.id}</span>
        <span className="rounded-[4px] bg-chip px-1.5 py-0.5 font-latin text-[10px] text-fg/55 ltr">{current.ctx}</span>
        <CaretDown className={cx("text-[12px] text-fg/50 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" className="absolute top-[calc(100%+6px)] right-0 left-0 z-10 animate-pop-in rounded-[10px] bg-surface p-1 shadow-pop">
          {provider.models.map((m) => {
            const active = m.id === provider.model;
            return (
              <div
                key={m.id}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-2",
                  active ? "bg-accent-bg" : "hover:bg-fg/5",
                )}
              >
                <Check className={cx("text-[13px] text-accent", !active && "invisible")} />
                <span className="flex-1 text-left font-latin text-[13px] ltr">{m.id}</span>
                <span className="font-latin text-[10px] text-fg/45 ltr">{m.ctx}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Test result panel ───────────────────────────────── */

/** One-line connection status; only a failure expands to show its technical code. */
function TestStatus({ test, lastValidated }: { test: ConnectionTest; lastValidated?: string }) {
  const line = "flex items-center gap-1.5 text-[12px]";
  switch (test.state) {
    case "idle":
      return <div className="text-[11.5px] text-fg/40">{lastValidated ? `آخرین تست: ${lastValidated}` : "هنوز تست نشده"}</div>;
    case "loading":
      return (
        <div className={cx(line, "text-fg/55")} role="status">
          <CircleNotch className="animate-spin text-[14px] text-accent-hi" />
          در حال تست اتصال…
        </div>
      );
    case "success":
      return (
        <div className={cx(line, "text-success")} role="status">
          <CheckCircle weight="fill" className="text-[15px]" />
          اتصال برقرار است
          <span className="font-latin text-[11px] text-fg/40 ltr">{test.latencyMs} ms</span>
        </div>
      );
    case "slow":
      return (
        <div className={cx(line, "text-warning")} role="status">
          <WarningCircle weight="fill" className="text-[15px]" />
          اتصال کند است
          <span className="font-latin text-[11px] text-fg/40 ltr">{faNum(test.latencyMs)} ms</span>
        </div>
      );
    case "failed":
      return (
        <div className="flex flex-col gap-1" role="alert">
          <div className={cx(line, "text-error")}>
            <XCircle weight="fill" className="text-[15px]" />
            {test.message}
          </div>
          <code className="font-mono text-[10.5px] text-fg/40 ltr text-left">{test.code}</code>
        </div>
      );
  }
}

/* ── Modal ───────────────────────────────────────────── */

const SLOTS: ProviderSlot[] = ["primary", "gateway", "custom"];

export function ModelSettings() {
  const { state, updateProvider, set, closeModal, toast } = useStore();
  const bp = useBreakpoint();
  const mobile = bp === "mobile";
  const [tab, setTab] = useState<ProviderSlot>(state.activeSlot);
  const [drafts, setDrafts] = useState<Record<ProviderSlot, ProviderConfig>>(
    () => Object.fromEntries(state.providers.map((p) => [p.slot, p])) as Record<ProviderSlot, ProviderConfig>,
  );
  const [tests, setTests] = useState<Record<ProviderSlot, ConnectionTest>>({
    primary: { state: "success", latencyMs: 420, sample: "اتصال با موفقیت برقرار شد." },
    gateway: { state: "idle" },
    custom: { state: "idle" },
  });
  const [showKey, setShowKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const p = drafts[tab];
  const test = tests[tab];
  const runId = useRef(0);

  useEffect(() => setShowKey(false), [tab]);

  const patch = (patch: Partial<ProviderConfig>) => {
    setDrafts((d) => ({ ...d, [tab]: { ...d[tab], ...patch } }));
    if (test.state !== "loading") setTests((t) => ({ ...t, [tab]: { state: "idle" } }));
  };

  const runTest = async (): Promise<ConnectionTest> => {
    const id = ++runId.current;
    const slot = tab;
    setTests((t) => ({ ...t, [slot]: { state: "loading" } }));
    const result = await testConnection(drafts[slot]);
    if (id === runId.current) setTests((t) => ({ ...t, [slot]: result }));
    return result;
  };

  const save = async () => {
    setSaving(true);
    const result = test.state === "success" || test.state === "slow" ? test : await runTest();
    setSaving(false);
    if (result.state === "failed") {
      toast("error", "ذخیره تنظیمات ناموفق بود", { label: "تلاش مجدد", run: () => void save() });
      return;
    }
    const health = result.state === "slow" ? "degraded" : "connected";
    updateProvider(tab, { ...p, health, lastValidated: `امروز ${faTime()}` });
    set({ activeSlot: tab });
    toast("success", `${SLOT_LABELS[tab]} ذخیره و فعال شد`);
    closeModal();
  };

  const maskedKey = p.apiKey ? `${p.apiKey.slice(0, 3)}${"•".repeat(Math.max(0, Math.min(22, p.apiKey.length - 7)))}${p.apiKey.slice(-4)}` : "";
  const keyError = test.state === "failed" && /key/.test(test.code);
  const urlError = test.state === "failed" && /URL/.test(test.code);

  const keyInput = showKey ? (
    <TextInput
      ariaLabel="کلید API"
      value={p.apiKey}
      onChange={(v) => patch({ apiKey: v })}
      placeholder="sk-…"
      mono
      error={keyError}
      icon={<Key className="shrink-0 text-[15px] text-fg/40" />}
      trailing={
        <button type="button" aria-label="پنهان کردن کلید" onClick={() => setShowKey(false)} className="grid size-6 place-items-center rounded-[6px] text-[14px] text-fg/50 hover:bg-fg/8">
          <EyeSlash />
        </button>
      }
    />
  ) : (
    <div className={inputShell(false, keyError)}>
      <Key className="shrink-0 text-[15px] text-fg/40" />
      <button
        type="button"
        onClick={() => setShowKey(true)}
        className={cx("h-full flex-1 truncate text-left font-mono text-[13px] ltr", p.apiKey ? "text-fg/85" : "text-fg/30")}
      >
        {maskedKey || "sk-…"}
      </button>
      <button type="button" aria-label="نمایش کلید" onClick={() => setShowKey(true)} className="grid size-6 place-items-center rounded-[6px] text-[14px] text-fg/50 hover:bg-fg/8">
        <Eye />
      </button>
    </div>
  );

  const baseUrlField = (
    <Field
      label={
        <>
          آدرس پایه {!p.baseUrlRequired && <span className="opacity-50">(اختیاری)</span>}
        </>
      }
      error={urlError ? "آدرس باید با http:// یا https:// شروع شود." : undefined}
    >
      <TextInput ariaLabel="آدرس پایه" value={p.baseUrl} onChange={(v) => patch({ baseUrl: v })} placeholder="https://…/v1" mono error={urlError} />
    </Field>
  );
  const showAdvanced = advancedOpen || (urlError && !p.baseUrlRequired);

  return (
    <>
      <ModalHeader icon={<SlidersHorizontal />} title="مدل و سرویس هوش مصنوعی" onClose={closeModal} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5 max-md:px-3.5">
        {/* service picker */}
        <div className="flex flex-col gap-2">
          <Segmented
            ariaLabel="سرویس"
            value={tab}
            onChange={setTab}
            className="w-full [&>button]:flex-1 [&>button]:px-2"
            options={SLOTS.map((s) => ({
              value: s,
              label: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  {state.activeSlot === s && <StatusDot tone="success" size={6} halo={false} />}
                  {SLOT_LABELS[s]}
                </span>
              ),
            }))}
          />
          <div className="flex items-center gap-1.5 px-0.5 text-[11.5px] text-fg/45" title={p.description}>
            <span className="font-latin font-semibold text-fg/75 ltr">{p.provider}</span>
            <span className="opacity-50">·</span>
            <span className="font-mono text-[11px] ltr">{p.host}</span>
            {state.activeSlot === tab && <span className="ms-auto text-success">سرویس فعال</span>}
          </div>
        </div>

        <Field label="مدل">
          <ModelSelect provider={p} onChange={(id) => patch({ model: id })} />
        </Field>
        <Field
          label={
            <>
              کلید API {p.slot === "custom" && <span className="opacity-50">(اختیاری)</span>}
            </>
          }
          error={keyError ? "قالب یا اعتبار کلید API صحیح نیست." : undefined}
        >
          {keyInput}
        </Field>
        {p.baseUrlRequired && baseUrlField}

        {/* advanced */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setAdvancedOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 self-start text-[12px] font-medium text-fg/55 hover:text-fg/80"
          >
            <CaretDown className={cx("text-[11px] transition-transform", !showAdvanced && "rotate-90")} />
            تنظیمات پیشرفته
          </button>
          {showAdvanced && (
            <div className="flex animate-fade-in flex-col gap-4">
              {!p.baseUrlRequired && baseUrlField}
              <Field label="مدل سفارشی" hint={p.customModel ? "به‌جای مدل انتخاب‌شده استفاده می‌شود." : undefined}>
                <TextInput ariaLabel="مدل سفارشی" value={p.customModel} onChange={(v) => patch({ customModel: v })} placeholder={`e.g. ${p.models[0].id}-2026-01`} mono />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div
        className={cx(
          "flex shrink-0 gap-3 border-t border-fg/9 px-5 py-3.5 max-md:px-3.5 max-md:pb-[max(14px,env(safe-area-inset-bottom))]",
          mobile ? "flex-col" : "items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          <TestStatus test={test} lastValidated={p.lastValidated} />
        </div>
        <div className="flex gap-2">
          <Button
            size={mobile ? "lg" : "md"}
            className={cx(mobile && "flex-1")}
            icon={<Plugs className="text-[15px]" />}
            loading={test.state === "loading" && !saving}
            disabled={saving}
            onClick={() => void runTest()}
          >
            تست اتصال
          </Button>
          <Button
            variant="primary"
            size={mobile ? "lg" : "md"}
            className={cx("px-4", mobile && "flex-1")}
            icon={<Check className="text-[15px]" />}
            loading={saving}
            disabled={test.state === "loading" && !saving}
            onClick={() => void save()}
          >
            ذخیره
          </Button>
        </div>
      </div>
    </>
  );
}
