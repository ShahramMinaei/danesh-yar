"use client";

import { CaretLeft, CaretRight, File, FileDoc, FilePdf, FileText, FileXls, ImageSquare, Plus, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx, faNum, uid } from "@/lib/format";
import { useDismiss } from "@/lib/hooks";
import type { Attachment } from "@/lib/types";

/** The picker is opened for one kind at a time, chosen from the attach menu. */
export const ACCEPT = {
  image: "image/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md",
} as const;
export type AttachKind = keyof typeof ACCEPT;
export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;

/** Keeps the file in the browser only (no backend): images get an object URL for the preview. */
export function toAttachment(file: globalThis.File): Attachment {
  const image = file.type.startsWith("image/");
  return { id: uid("f"), name: file.name, size: file.size, type: file.type, url: image ? URL.createObjectURL(file) : undefined };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${faNum(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faNum(Math.round(bytes / 1024))} کیلوبایت`;
  return `${faNum(Math.round((bytes / (1024 * 1024)) * 10) / 10)} مگابایت`;
}

function FileGlyph({ a }: { a: Attachment }) {
  const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
  if (a.type === "application/pdf" || ext === "pdf") return <FilePdf className="text-error" />;
  if (["doc", "docx"].includes(ext)) return <FileDoc className="text-info" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileXls className="text-success" />;
  if (["txt", "md"].includes(ext) || a.type.startsWith("text/")) return <FileText className="text-fg/60" />;
  return <File className="text-fg/60" />;
}

/**
 * In-app image viewer (native <dialog>: top layer, focus trap, Esc to close).
 * Clicking the dark area closes it; with several images, arrows or ←/→ step
 * through them (RTL: ← is next).
 */
function Lightbox({ images, start, onClose }: { images: Attachment[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  const a = images[i];
  const many = images.length > 1;
  const go = useCallback((d: number) => setI((n) => (n + d + images.length) % images.length), [images.length]);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={a.name}
      onClose={onClose}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") go(1);
        else if (e.key === "ArrowRight") go(-1);
      }}
      onClick={(e) => {
        // only the dark surround closes, never the image or the controls
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.lbStage !== undefined) ref.current?.close();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none animate-fade-in bg-transparent p-0 text-white backdrop:bg-black/85"
    >
      <div data-lb-stage className="flex h-full flex-col items-center justify-center gap-3 px-4 py-5">
        <div className="flex w-full max-w-[min(1100px,92vw)] items-center gap-3">
          <div className="min-w-0 flex-1 leading-[1.4]">
            <div className="truncate text-[13.5px] font-medium">
              <bdi>{a.name}</bdi>
            </div>
            <div className="text-[11.5px] text-white/60">
              {formatSize(a.size)}
              {many && ` · ${faNum(i + 1)} از ${faNum(images.length)}`}
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => ref.current?.close()}
            aria-label="بستن"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-[16px] transition-colors hover:bg-white/20"
          >
            <X />
          </button>
        </div>
        <div data-lb-stage className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={a.id}
            src={a.url}
            alt={a.name}
            className="max-h-full max-w-[min(1100px,92vw)] animate-pop-in rounded-[10px] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          />
          {many && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="تصویر قبلی"
                className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-[18px] transition-colors hover:bg-white/20"
              >
                <CaretRight />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="تصویر بعدی"
                className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-[18px] transition-colors hover:bg-white/20"
              >
                <CaretLeft />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

/**
 * Attachment chips: an image thumbnail or a file-type glyph, then name and size.
 * Image chips open the in-app viewer. With `onRemove` (the composer draft) each
 * chip gets a remove button.
 */
export function AttachmentChips({
  items,
  onRemove,
  className,
}: {
  items: Attachment[];
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const images = items.filter((a) => a.url);
  const [viewing, setViewing] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <>
      <ul aria-label="پیوست‌ها" className={cx("m-0 flex list-none flex-wrap gap-1.5 p-0", className)}>
        {items.map((a) => (
          <li
            key={a.id}
            className="flex max-w-[240px] animate-pop-in items-center gap-2 rounded-[9px] bg-surface py-1 ps-1 pe-2 ring-1 ring-inset ring-fg/10"
          >
            {a.url ? (
              <button
                type="button"
                onClick={() => setViewing(images.indexOf(a))}
                aria-label={`نمایش تصویر ${a.name}`}
                className="group/img flex min-w-0 flex-1 cursor-zoom-in items-center gap-2 rounded-[6px] text-start"
              >
                {/* local object URL preview; next/image can't optimise blob: URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt=""
                  className="size-9 shrink-0 rounded-[6px] object-cover ring-1 ring-inset ring-fg/10 transition-transform duration-150 group-hover/img:scale-105"
                />
                <ChipText a={a} />
              </button>
            ) : (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-chip text-[18px]">
                  <FileGlyph a={a} />
                </span>
                <ChipText a={a} />
              </>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                aria-label={`حذف ${a.name}`}
                className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[12px] text-fg/45 transition-colors hover:bg-fg/8 hover:text-fg/85"
              >
                <X />
              </button>
            )}
          </li>
        ))}
      </ul>
      {viewing !== null && images[viewing] && <Lightbox images={images} start={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ChipText({ a }: { a: Attachment }) {
  return (
    <span className="min-w-0 flex-1 leading-[1.35]">
      <span className="block truncate text-[12px] font-medium text-fg/85" title={a.name}>
        <bdi>{a.name}</bdi>
      </span>
      <span className="block text-[10.5px] text-fg/45">{formatSize(a.size)}</span>
    </span>
  );
}

const KINDS: { kind: AttachKind; label: string; hint: string; icon: typeof Plus }[] = [
  { kind: "image", label: "عکس و تصویر", hint: "نقشه، عکس یا اسکرین‌شات", icon: ImageSquare },
  { kind: "document", label: "سند و فایل", hint: "PDF، Word، Excel یا متن", icon: FileText },
];

/**
 * «+» button that first asks what to attach (like chat assistants' attach menu),
 * then opens the file picker filtered to that kind. Opens upward from the composer.
 */
export function AttachMenu({
  size,
  marginBottom,
  disabled,
  onPick,
}: {
  size: number;
  marginBottom: number;
  disabled?: boolean;
  onPick: (kind: AttachKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss([wrap], open, close);

  return (
    <div ref={wrap} className="relative shrink-0" style={{ marginBottom }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="افزودن پیوست"
        title="افزودن پیوست"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ width: size, height: size }}
        className={cx(
          "grid place-items-center rounded-[9px] text-[18px] transition-colors disabled:opacity-40",
          open ? "bg-fg/8 text-fg" : "text-fg/55 hover:bg-fg/7 hover:text-fg",
        )}
      >
        <Plus className={cx("transition-transform duration-200", open && "rotate-45")} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="افزودن پیوست"
          className="absolute right-0 bottom-[calc(100%+10px)] z-40 w-[230px] animate-pop-in rounded-[12px] bg-surface p-1.5 shadow-pop"
        >
          {KINDS.map(({ kind, label, hint, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onPick(kind);
              }}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-start transition-colors hover:bg-fg/5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-accent/10 text-[17px] text-accent-hi">
                <Icon />
              </span>
              <span className="min-w-0 leading-[1.4]">
                <span className="block text-[13px] font-medium">{label}</span>
                <span className="block text-[11px] text-fg/45">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
