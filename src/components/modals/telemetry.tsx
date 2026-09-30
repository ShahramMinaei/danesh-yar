"use client";

import { ArrowsClockwise, FileZip, TerminalWindow, TrendUp } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clockStamp, cx, faNum, uid } from "@/lib/format";
import { downloadBlob, useBreakpoint } from "@/lib/hooks";
import { INITIAL_LOGS, TAIL_TEMPLATES } from "@/lib/mock-data";
import type { LogLevel, LogLine, LogTab } from "@/lib/types";
import { makeZip } from "@/lib/zip";
import { useStore } from "@/state/store";
import { Button } from "../ui/button";
import { ModalHeader } from "../ui/modal";
import { Segmented, StatusDot } from "../ui/primitives";

const LEVEL_COLOR: Record<LogLevel, string> = {
  DEBUG: "text-fg/40",
  INFO: "text-success",
  WARN: "text-warning",
  ERROR: "text-error",
};

const TAB_FILTER: Record<LogTab, (l: LogLine) => boolean> = {
  general: () => true,
  errors: (l) => l.level === "ERROR",
  rag: (l) => /^(rag|vector|index|llm)\./.test(l.service),
  access: (l) => /^(auth|api)\./.test(l.service),
};

const TAB_FILE: Record<LogTab, string> = {
  general: "app",
  errors: "error",
  rag: "rag",
  access: "access",
};

/** Cap on the in-memory live tail. */
const MAX_LINES = 400;

export function Telemetry() {
  const { closeModal, toast } = useStore();
  const bp = useBreakpoint();
  const mobile = bp === "mobile";
  const [tab, setTab] = useState<LogTab>("general");
  const [logs, setLogs] = useState<LogLine[]>(INITIAL_LOGS);
  const [refreshing, setRefreshing] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // live tail
  useEffect(() => {
    const t = setInterval(() => {
      const tpl = TAIL_TEMPLATES[Math.floor(Math.random() * TAIL_TEMPLATES.length)];
      setLogs((l) => [...l.slice(-MAX_LINES), { ...tpl, id: uid("log"), ts: clockStamp() }]);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(() => logs.filter(TAB_FILTER[tab]), [logs, tab]);
  const counts = useMemo(
    () => ({
      INFO: logs.filter((l) => l.level === "INFO").length + 206,
      WARN: logs.filter((l) => l.level === "WARN").length + 10,
      ERROR: logs.filter((l) => l.level === "ERROR").length + 5,
    }),
    [logs],
  );

  useLayoutEffect(() => {
    const el = viewport.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  // a pending refresh is dropped if the modal closes first
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const refresh = () => {
    setRefreshing(true);
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      setLogs((l) => [
        ...l,
        { id: uid("log"), ts: clockStamp(), level: "INFO", service: "api.gateway", message: "GET /v1/telemetry · 200 · 18ms" },
      ]);
      stick.current = true;
      setRefreshing(false);
    }, 600);
  };

  const download = () => {
    const date = new Date().toISOString().slice(0, 10);
    const files = (Object.keys(TAB_FILTER) as LogTab[]).map((t) => ({
      name: `${TAB_FILE[t]}-${date}.log`,
      content: logs
        .filter(TAB_FILTER[t])
        .map((l) => `${l.ts} ${l.level.padEnd(5)} ${l.service.padEnd(14)} ${l.message}`)
        .join("\n"),
    }));
    downloadBlob(`danesh-yar-logs-${date}.zip`, makeZip(files));
    toast("success", "فایل ZIP لاگ‌ها آماده شد");
  };

  const errorCount = counts.ERROR;

  return (
    <>
      <ModalHeader
        icon={<TerminalWindow />}
        title="پایش سامانه و لاگ‌ها"
        subtitle="وضعیت زنده سرویس‌ها و رخدادهای ثبت‌شده"
        onClose={closeModal}
        extra={
          !mobile && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-[5px] text-[11.5px] font-medium text-success ring-1 ring-inset ring-success/30">
              <StatusDot tone="success" size={6} halo={false} pulse />
              سامانه سالم
            </span>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className={cx("grid gap-2.5 px-5 py-4 max-md:px-3.5", mobile ? "grid-cols-2" : "grid-cols-4")}>
          <Stat label="استعلام‌های امروز" value="۱٬۲۴۸" foot={<span className="inline-flex items-center gap-1 text-success"><TrendUp />۱۲٪ بیش از دیروز</span>} />
          <Stat label="میانگین زمان پاسخ" value="۲٫۱s" foot="p95 · ۴٫۸s" />
          <Stat label="خطاهای ثبت‌شده" value={faNum(errorCount)} tone="warning" foot="۵ مورد timeout بازیابی" />
          <Stat label="حجم فایل‌های لاگ" value="۳۴٫۲ MB" foot="۹ فایل · چرخش روزانه" />
        </div>

        <div className={cx("flex items-center gap-2 px-5 pb-3 max-md:px-3.5", mobile && "flex-wrap")}>
          <Segmented<LogTab>
            ariaLabel="دسته لاگ"
            value={tab}
            onChange={(t) => {
              stick.current = true;
              setTab(t);
            }}
            className={mobile ? "w-full [&>button]:flex-1" : undefined}
            options={[
              { value: "general", label: "عمومی" },
              {
                value: "errors",
                label: (
                  <>
                    خطاها <span className="text-[10px] text-error">{faNum(errorCount)}</span>
                  </>
                ),
              },
              { value: "rag", label: <span className="ltr">RAG</span> },
              { value: "access", label: "دسترسی" },
            ]}
          />
          <div className="flex-1" />
          <Button size="sm" className="h-8 px-[11px]" loading={refreshing} icon={<ArrowsClockwise className="text-[14px]" />} onClick={refresh}>
            بازخوانی
          </Button>
          <Button variant="primary" size="sm" className="h-8 px-[11px] font-medium" icon={<FileZip className="text-[14px]" />} onClick={download}>
            دانلود ZIP
          </Button>
        </div>

        <div className="mx-5 mb-5 overflow-hidden rounded-[10px] bg-sunken ring-1 ring-inset ring-fg/8 max-md:mx-3.5">
          <div className="flex items-center justify-between border-b border-fg/7 bg-app px-3 py-2 ltr">
            <span className="font-mono text-[10.5px] font-medium text-fg/45">
              {TAB_FILE[tab]}-{new Date().toISOString().slice(0, 10)}.log · tail -f
            </span>
            <div className="flex items-center gap-2.5 font-mono text-[10px]">
              <span className="text-success">INFO {counts.INFO}</span>
              <span className="text-warning">WARN {counts.WARN}</span>
              <span className="text-error">ERROR {counts.ERROR}</span>
            </div>
          </div>
          <div
            ref={viewport}
            role="log"
            aria-label="لاگ‌ها"
            tabIndex={0}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            className={cx("overflow-auto px-3 py-2.5 text-left font-mono text-[11.5px] leading-[1.95] ltr", mobile ? "h-[320px] text-[10.5px]" : "h-[250px]")}
          >
            {shown.length === 0 && <div className="text-fg/35">— no entries —</div>}
            {shown.map((l) => (
              <div key={l.id} className={cx("flex gap-2.5", mobile && "flex-wrap gap-x-2 gap-y-0 pb-1")}>
                <span className="shrink-0 text-fg/30">{l.ts}</span>
                <span className={cx("w-11 shrink-0", LEVEL_COLOR[l.level])}>{l.level}</span>
                <span className="w-[104px] shrink-0 text-info">{l.service}</span>
                <span className={cx(mobile ? "w-full" : "min-w-0", l.level === "ERROR" ? "text-error-fg" : l.level === "DEBUG" ? "text-fg/55" : "text-fg/70")}>
                  {l.message}
                </span>
              </div>
            ))}
            <div className="flex gap-2.5">
              <span className="text-accent-hi">›</span>
              <span className="mt-1 h-[15px] w-[7px] animate-blink bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, foot, tone }: { label: string; value: string; foot: ReactNode; tone?: "warning" }) {
  return (
    <div className={cx("flex flex-col gap-[7px] rounded-[10px] bg-panel p-[13px] ring-1 ring-inset", tone === "warning" ? "ring-warning/25" : "ring-fg/8")}>
      <span className="text-[11px] text-fg/50">{label}</span>
      <span className={cx("font-latin text-[24px] leading-none font-semibold ltr max-md:text-[20px]", tone === "warning" && "text-warning")}>{value}</span>
      <span className="text-[10.5px] text-fg/45">{foot}</span>
    </div>
  );
}
