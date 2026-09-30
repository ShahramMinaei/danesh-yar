"use client";

import { CaretLeft, CaretRight, Copy, DownloadSimple, FileText, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { cx, fa, faNum, pct } from "@/lib/format";
import { copyText, downloadBlob, useBreakpoint } from "@/lib/hooks";
import { chunkById } from "@/lib/mock-data";
import type { ChunkBody, RetrievedChunk } from "@/lib/types";
import { useStore } from "@/state/store";
import { Formula } from "../chat/answer-body";
import { Button, IconButton } from "../ui/button";
import { Badge, ScoreBar } from "../ui/primitives";

function chunkPlainText(c: RetrievedChunk) {
  return [
    `${c.docTitle} — ${c.clause}`,
    `${c.chapter} · صفحه ${fa(c.page)} · ${c.id}`,
    "",
    ...c.body.map((b) => (b.type === "formula" ? b.expr.map((p) => (typeof p === "string" ? p : `_${p.sub}`)).join("") : b.text)),
  ].join("\n");
}

function BodyView({ body, mobile }: { body: ChunkBody[]; mobile: boolean }) {
  return (
    <>
      {body.map((b, i) =>
        b.type === "h" ? (
          <div key={i} className={cx("text-[15px] font-semibold", i > 0 && "mt-1")}>
            {b.text}
          </div>
        ) : b.type === "formula" ? (
          <div
            key={i}
            className={cx(
              "overflow-x-auto rounded-[8px] bg-panel text-center font-mono whitespace-nowrap text-accent-fg-2 ltr",
              mobile ? "p-3 text-[13.5px]" : "p-3.5 text-[16px]",
            )}
          >
            <Formula parts={b.expr} subSize={mobile ? 10 : 11} />
          </div>
        ) : b.highlight ? (
          <p
            key={i}
            className={cx(
              "m-0 rounded-[8px] border-s-2 border-accent bg-accent/10 leading-[2.05] text-fg",
              mobile ? "px-3 py-[11px] text-[13.5px]" : "px-3.5 py-3 text-[14px]",
            )}
          >
            {b.text}
          </p>
        ) : (
          <p key={i} className={cx("m-0 leading-[2.05] text-fg/82", mobile ? "text-[13.5px]" : "text-[14px]")}>
            {b.text}
          </p>
        ),
      )}
    </>
  );
}

export function ChunkInspector({ chunkId, siblings }: { chunkId: string; siblings: string[] }) {
  const { openModal, closeModal, toast } = useStore();
  const bp = useBreakpoint();
  const mobile = bp === "mobile";
  const chunk = chunkById(chunkId)!;
  const idx = siblings.indexOf(chunkId);
  const rank = idx >= 0 ? idx + 1 : 1;
  const total = Math.max(siblings.length, 1);

  const go = (d: number) => {
    const next = siblings[idx + d];
    if (next) openModal({ type: "inspector", chunkId: next, siblings });
  };

  useEffect(() => {
    // RTL: ← goes forward (next), → goes back (previous)
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(1);
      if (e.key === "ArrowRight") go(-1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });

  const copy = async () => {
    const ok = await copyText(chunkPlainText(chunk));
    toast(ok ? "success" : "error", ok ? "متن قطعه کپی شد" : "کپی ناموفق بود");
  };
  const download = () => downloadBlob(`${chunk.id}.txt`, new Blob([chunkPlainText(chunk)], { type: "text/plain;charset=utf-8" }));
  const fullDoc = () => toast("info", `باز کردن «${chunk.docTitle}» — صفحه ${fa(chunk.page)}`);

  const header = (
    <div className={cx("flex shrink-0 items-start border-b border-fg/9", mobile ? "gap-2.5 px-3.5 pt-2 pb-3" : "gap-3.5 px-[18px] py-4")}>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge tone="accent" className="text-[10.5px] max-md:text-[10px]">
            {chunk.categoryLabel}
          </Badge>
          {mobile ? (
            <Badge className="font-latin ltr">{pct(chunk.score)}</Badge>
          ) : (
            <Badge className="text-[10.5px]">
              قطعه {faNum(chunk.chunkIndex)} از {faNum(chunk.chunkTotal)}
            </Badge>
          )}
        </div>
        <h2 className={cx("m-0 font-medium", mobile ? "text-[15.5px] leading-[1.35]" : "text-[20px] leading-[1.25]")}>
          {chunk.clause} — {chunk.title}
        </h2>
        <div className={cx("text-fg/45", mobile ? "mt-1 text-[10.5px]" : "mt-[5px] text-[12px]")}>
          {chunk.docTitle} · {chunk.chapter} · صفحه {fa(chunk.page)}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {!mobile && (
          <>
            <IconButton label="کپی متن" size={30} onClick={copy} className="text-[14px]">
              <Copy />
            </IconButton>
            <IconButton label="دانلود متن" size={30} onClick={download} className="text-[14px]">
              <DownloadSimple />
            </IconButton>
          </>
        )}
        <IconButton label="بستن" size={mobile ? 36 : 30} onClick={closeModal} className="text-[14px] text-fg/70">
          <X />
        </IconButton>
      </div>
    </div>
  );

  if (mobile) {
    return (
      <>
        {header}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5 [&>*]:shrink-0">
          <div className="kicker text-[9.5px]!">متن اصلی منبع</div>
          <BodyView body={chunk.body} mobile />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[8px] bg-panel px-2.5 py-[9px]">
              <div className="text-[10px] text-fg/45">امتیاز</div>
              <div className={cx("font-latin text-[15px] font-semibold ltr", chunk.score >= 0.8 ? "text-success" : "text-warning")}>
                {pct(chunk.score)}
              </div>
            </div>
            <div className="rounded-[8px] bg-panel px-2.5 py-[9px]">
              <div className="text-[10px] text-fg/45">قطعه</div>
              <div className="font-latin text-[15px] font-semibold ltr">
                {faNum(chunk.chunkIndex)} / {fa(chunk.chunkTotal)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-fg/9 px-3.5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button variant="primary" size="lg" className="flex-1" icon={<FileText className="text-[15px]" />} onClick={fullDoc}>
            سند کامل
          </Button>
          <IconButton label="کپی متن" size={46} onClick={copy} className="text-[17px]">
            <Copy />
          </IconButton>
        </div>
      </>
    );
  }

  const info: [string, string, boolean?][] = [
    ["منبع", chunk.docTitle],
    ["بخش", `${chunk.chapter} / ${chunk.clause.replace(/^.*· /, "")}`],
    ["صفحه", fa(chunk.page)],
    ["ویرایش", chunk.edition],
    ["توکن", String(chunk.tokens), true],
    ["شناسه", chunk.id, true],
  ];

  return (
    <>
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto p-[18px] [&>*]:shrink-0">
          <div className="kicker">متن اصلی منبع</div>
          <BodyView body={chunk.body} mobile={false} />
        </div>
        <aside className="flex w-[230px] shrink-0 flex-col gap-4 border-s border-fg/8 bg-panel p-[18px]">
          <div>
            <div className="kicker mb-2">امتیاز مرتبط‌بودن</div>
            <div className="flex items-baseline gap-1.5">
              <span className={cx("font-latin text-[26px] font-semibold ltr", chunk.score >= 0.8 ? "text-success" : "text-warning")}>
                {pct(chunk.score)}
              </span>
              <span className="text-[11px] text-fg/45">
                رتبه {faNum(rank)} از {faNum(total)}
              </span>
            </div>
            <ScoreBar score={chunk.score} height={3} className="mt-2" />
          </div>
          <dl className="m-0 flex flex-col gap-[9px]">
            <div className="kicker">اطلاعات سند</div>
            {info.map(([k, v, mono]) => (
              <div key={k} className="flex justify-between gap-3 text-[11.5px]">
                <dt className="text-fg/45">{k}</dt>
                <dd className={cx("m-0 truncate", mono && "font-mono ltr", k === "شناسه" && "text-[10.5px]")}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex flex-col gap-1.5">
            <Button variant="primary" size="md" className="h-[34px] text-[12.5px] font-medium" icon={<FileText className="text-[14px]" />} onClick={fullDoc}>
              سند کامل
            </Button>
            <div className="flex gap-1.5">
              <button
                aria-label="قطعه قبلی"
                disabled={idx <= 0}
                onClick={() => go(-1)}
                className="grid h-[30px] flex-1 place-items-center rounded-[8px] border border-fg/12 text-[13px] text-fg/60 hover:bg-fg/7 disabled:opacity-35"
              >
                <CaretRight />
              </button>
              <button
                aria-label="قطعه بعدی"
                disabled={idx < 0 || idx >= siblings.length - 1}
                onClick={() => go(1)}
                className="grid h-[30px] flex-1 place-items-center rounded-[8px] border border-fg/12 text-[13px] text-fg/60 hover:bg-fg/7 disabled:opacity-35"
              >
                <CaretLeft />
              </button>
            </div>
            <span className="text-center text-[10.5px] text-fg/35">قطعه قبلی / بعدی</span>
          </div>
        </aside>
      </div>
    </>
  );
}
