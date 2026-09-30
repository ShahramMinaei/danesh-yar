"use client";

import { ArrowUp, Clock, Microphone, Stop, X } from "@phosphor-icons/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { cx } from "@/lib/format";
import type { Breakpoint } from "@/lib/hooks";
import { streamProgress } from "@/lib/stream-control";
import type { AssistantMessage, Attachment } from "@/lib/types";
import { useStore } from "@/state/store";
import { ModelMenu } from "../layout/top-nav";
import { ACCEPT, AttachMenu, AttachmentChips, MAX_BYTES, MAX_FILES, toAttachment, type AttachKind } from "./attachments";

export interface ComposerHandle {
  fill: (text: string) => void;
  focus: () => void;
}

const MAX_HEIGHT = 200;

/** Pause between an answer finishing and its queued follow-up being sent. */
const FLUSH_DELAY = 420;

/** Minimal shape of the (vendor-prefixed) Web Speech API recognizer. */
interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Multi-line input. Auto-resizes up to 200px; Enter sends, Shift+Enter adds a
 * line. While an answer streams the send button becomes a Stop control ringed
 * by live progress, and Enter queues the draft as the next question instead.
 */
export const Composer = forwardRef<ComposerHandle, { bp: Breakpoint }>(function Composer({ bp }, handle) {
  const { ask, stop, isStreaming, state, toast } = useStore();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [queued, setQueued] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const recognizer = useRef<Recognizer | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const [pickKind, setPickKind] = useState<AttachKind>("image");
  /** opens the system file picker filtered to the kind chosen in the attach menu */
  const openPicker = (kind: AttachKind) => {
    const el = picker.current;
    if (!el) return;
    setPickKind(kind);
    el.accept = ACCEPT[kind]; // set synchronously: the picker opens before React re-renders
    el.click();
  };

  useEffect(() => () => recognizer.current?.stop(), []);

  /* unsent image previews are released on unmount (sent ones stay alive for the message bubble) */
  const draftFiles = useRef(files);
  draftFiles.current = files;
  useEffect(() => () => draftFiles.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)), []);

  /** Attach from the picker, a drop or a paste; enforces the count and size limits. */
  const addFiles = (list: FileList | globalThis.File[]) => {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast("error", `حجم هر فایل حداکثر ۱۰ مگابایت است (${tooBig[0].name})`);
    const room = MAX_FILES - files.length;
    const ok = incoming.filter((f) => f.size <= MAX_BYTES);
    if (ok.length > room) toast("error", `حداکثر ${MAX_FILES.toLocaleString("fa-IR")} فایل می‌توانید پیوست کنید`);
    const added = ok.slice(0, Math.max(room, 0)).map(toAttachment);
    if (added.length === 0) return;
    setFiles((prev) => [...prev, ...added]);
    announce(`${added.length.toLocaleString("fa-IR")} فایل پیوست شد`);
    ta.current?.focus();
  };

  const removeFile = (id: string) =>
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === id);
      if (gone?.url) URL.revokeObjectURL(gone.url);
      return prev.filter((f) => f.id !== id);
    });

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // leaving into a child still counts as inside the box
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
  /** Pasting a screenshot or copied file attaches it; plain text pastes as usual. */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length === 0) return;
    e.preventDefault();
    addFiles(e.clipboardData.files);
  };

  /* last assistant turn: drives the ring while streaming and the auto-flush after */
  let last: AssistantMessage | undefined;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m.role === "assistant") {
      last = m;
      break;
    }
  }
  const outcome = !last ? null : last.status === "streaming" ? "streaming" : last.stopped ? "stopped" : last.status;

  /* progress ring value, kept monotonic per answer (never runs backwards) */
  const raw = last && outcome === "streaming" ? streamProgress(last) : 0;
  const [ring, setRing] = useState({ id: "", value: 0 });
  if (last && outcome === "streaming" && (ring.id !== last.id || raw > ring.value)) {
    setRing({ id: last.id, value: ring.id === last.id ? Math.max(ring.value, raw) : raw });
  }
  const progress = last && outcome === "streaming" && ring.id === last.id ? ring.value : 0;

  /* a cleared conversation takes its queued follow-up with it */
  if (state.messages.length === 0 && queued !== null) setQueued(null);

  /* auto-send the queued question once the answer before it completes cleanly;
     after a stop or an error the chip stays so the user decides */
  useEffect(() => {
    if (outcome !== "done" || queued === null) return;
    const t = setTimeout(() => {
      ask(queued);
      setQueued(null);
    }, FLUSH_DELAY);
    return () => clearTimeout(t);
  }, [outcome, queued, ask]);

  /** polite screen-reader note; an invisible ZWNJ makes a repeat a new text so it is re-read */
  const announce = (msg: string) => setLive((prev) => (prev === msg ? `${msg}‌` : msg));

  /** Voice input: Persian speech is transcribed and appended to the draft. */
  const toggleVoice = () => {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const rec = createRecognizer();
    if (!rec) {
      toast("error", "مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند");
      return;
    }
    const base = text.trim();
    rec.lang = "fa-IR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const heard = Array.from(e.results, (r) => r[0].transcript).join("");
      setText(base ? `${base} ${heard}` : heard);
    };
    rec.onend = () => {
      setListening(false);
      recognizer.current = null;
      ta.current?.focus();
    };
    rec.onerror = () => toast("error", "ورودی صوتی ناموفق بود");
    recognizer.current = rec;
    setListening(true);
    rec.start();
  };

  const noDocs = state.mode === "manual" && state.selectedDocs.length === 0;
  const canSend = text.trim().length > 0 && !isStreaming && !noDocs;

  useImperativeHandle(handle, () => ({
    fill: (t) => {
      setText(t);
      requestAnimationFrame(() => ta.current?.focus());
    },
    focus: () => ta.current?.focus(),
  }));

  const send = () => {
    if (!canSend) return;
    ask(text, files);
    setText("");
    setFiles([]);
  };

  /** Type-ahead: one slot; a newer draft replaces the waiting one. */
  const enqueue = () => {
    const q = text.trim();
    if (!q || noDocs) return;
    if (queued !== null) toast("info", "پرسش در صف جایگزین شد");
    else announce("پرسش در صف قرار گرفت");
    setQueued(q);
    setText("");
  };

  const sendQueued = () => {
    if (queued === null || isStreaming || noDocs) return;
    ask(queued);
    setQueued(null);
  };

  const onStop = () => {
    stop();
    announce("پاسخ متوقف شد");
    // keep the keyboard flow in the draft (on touch this would pop the keyboard)
    if (bp !== "mobile") ta.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (isStreaming) enqueue();
      else send();
    }
  };

  const mobile = bp === "mobile";
  const desktop = bp === "desktop";
  const btn = mobile ? 44 : bp === "tablet" ? 36 : 38;
  const mic = mobile ? 40 : 34;
  // rendered height of a one-line textarea (py-2.5 + one 1.7 line); buttons sit centred on that line
  const lineH = 44;

  const placeholder = isStreaming
    ? mobile
      ? "پرسش بعدی را بنویسید..."
      : "پرسش بعدی را بنویسید؛ پس از پایان پاسخ ارسال می‌شود"
    : noDocs
      ? "برای پرسش در حالت دستی، دست‌کم یک سند انتخاب کنید"
      : desktop
        ? "سوال خود را درباره اسناد و مقررات وارد کنید..."
        : "سوال خود را وارد کنید...";

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text, bp, placeholder]);

  return (
    <div
      className={cx(
        "shrink-0 bg-app",
        desktop ? "px-16 pt-3.5 pb-[18px]" : bp === "tablet" ? "px-5 pt-3 pb-3.5" : "px-3 pt-2.5 pb-[max(14px,env(safe-area-inset-bottom))]",
      )}
    >
      <div className={cx(desktop && "mx-auto max-w-[880px]")}>
        {queued !== null && (
          <div
            className={cx(
              "mb-2 flex animate-sheet-up items-center gap-2 rounded-[9px] bg-accent/8 ring-1 ring-inset ring-accent/30",
              mobile ? "py-1 ps-3 pe-1 text-[12.5px]" : "py-1 ps-2.5 pe-1 text-[12px]",
            )}
          >
            <Clock aria-hidden className="shrink-0 text-[14px] text-accent-hi" />
            <span className="shrink-0 text-fg/55">در صف:</span>
            <span className="line-clamp-1 min-w-0 flex-1 text-fg/85" title={queued}>
              {queued}
            </span>
            {!isStreaming && (
              <button
                type="button"
                onClick={sendQueued}
                disabled={noDocs}
                className={cx(
                  "shrink-0 rounded-[7px] px-2 font-medium text-accent-hi transition-colors hover:bg-accent/14 disabled:cursor-not-allowed disabled:opacity-45",
                  mobile ? "h-9 text-[12px]" : "h-[26px] text-[11.5px]",
                )}
              >
                ارسال اکنون
              </button>
            )}
            <button
              type="button"
              onClick={() => setQueued(null)}
              aria-label="حذف از صف"
              className={cx(
                "grid shrink-0 place-items-center rounded-[7px] text-fg/45 transition-colors hover:bg-fg/8 hover:text-fg/85",
                mobile ? "size-9 text-[15px]" : "size-[26px] text-[13px]",
              )}
            >
              <X />
            </button>
          </div>
        )}
        <AttachmentChips items={files} onRemove={removeFile} className="mb-2" />
        <div
          data-composer-box
          data-tour="composer"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cx(
            // bottom-aligned: as the textarea grows, the mic and send buttons stay on its last line
            "flex items-end rounded-[12px] bg-panel ring-1 ring-inset transition-shadow",
            mobile ? "gap-2 px-2.5 py-2" : bp === "tablet" ? "gap-[9px] px-[11px] py-[9px]" : "gap-2.5 px-3 py-2.5",
            dragging
              ? "bg-accent/6 ring-2 ring-accent"
              : focused
                ? "ring-accent"
                : isStreaming
                  ? "ring-accent/40"
                  : "ring-fg/12 hover:ring-fg/22",
          )}
        >
          {/* mic and attach sit together (no gap), so the + stays next to the mic, not out in the field */}
          <div className="flex shrink-0 items-end">
            <button
              type="button"
              onClick={toggleVoice}
              disabled={isStreaming}
              aria-label={listening ? "توقف ورودی صوتی" : "ورودی صوتی"}
              aria-pressed={listening}
              style={{ width: mic, height: mic, marginBottom: (lineH - mic) / 2 }}
              className={cx(
                "grid shrink-0 place-items-center rounded-[9px] border text-[17px] transition-colors disabled:opacity-40",
                listening ? "animate-pulse border-accent bg-accent/12 text-accent-hi" : "border-transparent text-fg/55 hover:bg-fg/7 hover:text-fg",
              )}
            >
              <Microphone weight={listening ? "fill" : "regular"} />
            </button>
            <AttachMenu size={mic} marginBottom={(lineH - mic) / 2} disabled={files.length >= MAX_FILES} onPick={openPicker} />
          </div>
          <input
            ref={picker}
            type="file"
            multiple
            accept={ACCEPT[pickKind]}
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = ""; // picking the same file again still fires change
            }}
          />
          <label htmlFor="composer" className="sr-only">
            پرسش
          </label>
          <textarea
            id="composer"
            ref={ta}
            rows={1}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cx(
              "block flex-1 resize-none border-0 bg-transparent py-2.5 leading-[1.7] outline-none placeholder:text-fg/35 focus-visible:outline-none",
              desktop ? "min-h-11 text-[14px]" : "min-h-10 text-[13.5px]",
              mobile && "min-h-11",
            )}
          />
          {/* one button, two modes: send ⇄ stop (ringed by answer progress) */}
          <button
            type="button"
            onClick={isStreaming ? onStop : send}
            disabled={!isStreaming && !canSend}
            aria-label={isStreaming ? "توقف پاسخ (Esc)" : "ارسال"}
            aria-keyshortcuts={isStreaming ? "Escape" : undefined}
            title={isStreaming ? "توقف پاسخ (Esc)" : undefined}
            data-mode={isStreaming ? "stop" : "send"}
            style={{ width: btn, height: btn, marginBottom: (lineH - btn) / 2 }}
            className={cx(
              "sc-btn relative grid shrink-0 place-items-center border transition-colors",
              mobile ? "rounded-[10px] text-[18px]" : "rounded-[9px] text-[17px]",
              isStreaming
                ? "border-transparent bg-transparent text-fg/75 hover:bg-fg/7 hover:text-fg active:bg-fg/10"
                : canSend
                  ? "border-accent bg-accent text-on-accent hover:border-accent-hi hover:bg-accent-hi active:brightness-95"
                  : "cursor-not-allowed border-fg/12 bg-transparent text-fg/30",
            )}
          >
            <svg aria-hidden viewBox="0 0 36 36" className="sc-ring pointer-events-none absolute inset-0 size-full">
              <circle cx="18" cy="18" r="16" className="sc-track" />
              <circle cx="18" cy="18" r="16" pathLength={1} className="sc-arc" style={{ strokeDashoffset: 1 - progress }} />
            </svg>
            <span aria-hidden className="sc-icon sc-send">
              <ArrowUp weight="bold" />
            </span>
            <span aria-hidden className="sc-icon sc-stop">
              <Stop weight="fill" size={13} />
            </span>
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {live}
        </span>
        {desktop ? (
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="shrink-0" data-tour="model">
              <ModelMenu up />
            </div>
            <div className="max-w-[520px] text-left text-[11px] leading-[1.6] text-fg/35">
              پاسخ‌ها بر اساس منابع موجود در پایگاه دانش تولید می‌شوند؛ صحت نهایی اطلاعات را با متن اصلی منبع بررسی کنید.
            </div>
          </div>
        ) : bp === "tablet" ? (
          <div className="mt-[7px] text-[10.5px] text-fg/35">
            پاسخ‌ها بر اساس منابع پایگاه دانش تولید می‌شوند؛ صحت نهایی را با متن اصلی بررسی کنید.
          </div>
        ) : (
          <div className="mt-1.5 text-center text-[10px] text-fg/30">صحت اطلاعات را با متن اصلی منبع بررسی کنید.</div>
        )}
      </div>
    </div>
  );
});
