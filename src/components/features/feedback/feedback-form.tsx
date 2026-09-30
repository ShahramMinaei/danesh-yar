"use client";

import {
  Bug,
  ChatTeardropText,
  Check,
  Copy,
  DotsThreeCircle,
  Lightbulb,
  PaperPlaneTilt,
  Star,
  Target,
} from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx, fa, faNum } from "@/lib/format";
import { copyText, useBreakpoint } from "@/lib/hooks";
import { useStore } from "@/state/store";
import { Button, IconButton } from "../../ui/button";
import { ModalHeader } from "../../ui/modal";
import { CheckboxBox } from "../../ui/primitives";

/* ── Model ───────────────────────────────────────────── */

type Category = "accuracy" | "bug" | "idea" | "other";

const CATEGORIES: { id: Category; label: string; icon: ReactNode }[] = [
  { id: "accuracy", label: "دقت پاسخ", icon: <Target /> },
  { id: "bug", label: "مشکل فنی", icon: <Bug /> },
  { id: "idea", label: "پیشنهاد", icon: <Lightbulb /> },
  { id: "other", label: "سایر", icon: <DotsThreeCircle /> },
];

const RATING_LABELS = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "عالی"];

const MIN_LEN = 10;
const MAX_LEN = 1000;
const WARN_LEN = 900;
const SUBMIT_MS = 900;

const DRAFT_KEY = "danesh-yar:feedback-draft";
const STORE_KEY = "danesh-yar:feedback";

interface Draft {
  category: Category | null;
  rating: number;
  text: string;
  attach: boolean;
  email: string;
}

const EMPTY: Draft = { category: null, rating: 0, text: "", attach: false, email: "" };

/** Restores a saved draft field by field, keeping only values of the right type (storage is untrusted). */
function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return EMPTY;
    const d = v as Record<string, unknown>;
    return {
      category: CATEGORIES.some((c) => c.id === d.category) ? (d.category as Category) : null,
      rating: typeof d.rating === "number" && Number.isInteger(d.rating) && d.rating >= 0 && d.rating <= 5 ? d.rating : 0,
      text: typeof d.text === "string" ? d.text.slice(0, 4000) : "",
      attach: d.attach === true,
      email: typeof d.email === "string" ? d.email.slice(0, 254) : "",
    };
  } catch {
    return EMPTY;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Errors = Partial<Record<"category" | "text" | "email", string>>;

function validate(d: Draft): Errors {
  const e: Errors = {};
  const len = d.text.trim().length;
  if (!d.category) e.category = "نوع بازخورد را انتخاب کنید";
  if (len === 0) e.text = "متن بازخورد را بنویسید";
  else if (len < MIN_LEN) e.text = `دست‌کم ${fa(MIN_LEN)} نویسه بنویسید`;
  if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) e.email = "ایمیل معتبر نیست";
  return e;
}

/** Arrow-key target within a horizontal RTL radio row (left = forward). */
function rovingTarget(key: string, i: number, n: number): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.min(n - 1, i + 1);
    case "ArrowRight":
    case "ArrowUp":
      return Math.max(0, i - 1);
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}

/* ── Fields ──────────────────────────────────────────── */

function FieldLabel({ id, htmlFor, error, children, extra }: { id?: string; htmlFor?: string; error?: boolean; children: ReactNode; extra?: ReactNode }) {
  const cls = cx("text-[11.5px]", error ? "text-error" : "text-fg/65");
  return (
    <div className="mb-2 flex items-baseline gap-2">
      {htmlFor ? (
        <label id={id} htmlFor={htmlFor} className={cls}>
          {children}
        </label>
      ) : (
        <span id={id} className={cls}>
          {children}
        </span>
      )}
      {extra}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <div id={id} className="mt-[5px] animate-fade-in text-[11px] text-error">
      {children}
    </div>
  );
}

function CategoryChips({
  value,
  onChange,
  labelId,
  errorId,
  invalid,
  firstRef,
}: {
  value: Category | null;
  onChange: (c: Category) => void;
  labelId: string;
  errorId: string;
  invalid: boolean;
  firstRef: (el: HTMLButtonElement | null) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = CATEGORIES.findIndex((c) => c.id === value);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = rovingTarget(e.key, Math.max(0, idx), CATEGORIES.length);
    if (next === null) return;
    e.preventDefault();
    onChange(CATEGORIES[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-required
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onKeyDown={onKey}
      className="flex flex-wrap gap-2"
    >
      {CATEGORIES.map((c, i) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
              if (i === Math.max(0, idx)) firstRef(el);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === Math.max(0, idx) ? 0 : -1}
            onClick={() => onChange(c.id)}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] ring-1 ring-inset transition-colors max-md:h-9",
              on
                ? "bg-accent/12 font-semibold text-accent-fg ring-accent"
                : cx("font-medium text-fg/70 hover:bg-fg/5 hover:text-fg/90", invalid ? "ring-error/60" : "ring-fg/14 hover:ring-fg/28"),
            )}
          >
            <span className={cx("text-[14px]", on ? "text-accent-hi" : "text-fg/45")}>{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function StarRating({ value, onChange, labelId }: { value: number; onChange: (v: number) => void; labelId: string }) {
  const [hover, setHover] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = rovingTarget(e.key, Math.max(0, value - 1), 5);
    if (next === null) return;
    e.preventDefault();
    onChange(next + 1);
    refs.current[next]?.focus();
  };
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKey}
        onPointerLeave={() => setHover(0)}
        className="flex items-center"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${fa(n)} از ${fa(5)}`}
              tabIndex={n === Math.max(1, value) ? 0 : -1}
              onClick={() => onChange(n)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(n)}
              className="grid size-9 place-items-center rounded-[8px] max-md:size-10"
            >
              <Star
                weight={filled ? "fill" : "regular"}
                className={cx(
                  "fb-star text-[22px]",
                  filled ? (hover && hover !== value ? "text-accent-hi/70" : "text-accent-hi") : "text-fg/25",
                )}
              />
            </button>
          );
        })}
      </div>
      <span aria-hidden className={cx("text-[12px] transition-colors", hover && hover !== value ? "text-fg/45" : "text-fg/70")}>
        {shown ? RATING_LABELS[shown - 1] : ""}
      </span>
    </div>
  );
}

function inputRing(error: boolean) {
  return cx(
    "rounded-[8px] bg-panel ring-1 ring-inset transition-shadow focus-within:ring-accent",
    error ? "ring-error" : "ring-fg/12 hover:ring-fg/28",
  );
}

/* ── Success view ────────────────────────────────────── */

function Success({ code, onClose, mobile, minHeight }: { code: string; onClose: () => void; mobile: boolean; minHeight?: number }) {
  const { toast } = useStore();
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // the submit button unmounted with the form; keep focus inside the dialog
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    // keeps the form's height so the dialog doesn't jump when the view swaps
    <div style={mobile ? undefined : { minHeight }} className="flex min-h-0 flex-1 flex-col">
      <div role="status" className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center max-md:px-3.5">
        <svg viewBox="0 0 64 64" className="size-16 text-success" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {/* slightly open, uneven loop reads as hand-drawn */}
          <path
            className="fb-draw"
            pathLength={1}
            strokeWidth={2.4}
            d="M34.5 6.2C48.6 7 58.3 18.4 57.8 32.6 57.3 46.9 45.9 58.1 31.6 57.8 17.3 57.5 6.1 46 6.3 31.7 6.5 18.6 16.5 7.6 29.4 6.4"
          />
          <path className="fb-draw fb-draw-check" pathLength={1} strokeWidth={3} d="M21.5 33.2l7.3 7.1L43.2 24.6" />
        </svg>
        <div className="fb-rise mt-4 text-[16px] font-semibold">سپاس! بازخورد شما ثبت شد</div>
        <div className="fb-rise mt-4 flex flex-col items-center gap-1.5">
          <span className="text-[11.5px] text-fg/50">کد پیگیری</span>
          <div className="flex items-center gap-1 rounded-[9px] bg-panel py-1 ps-3 pe-1 ring-1 ring-inset ring-fg/12">
            <code className="font-mono text-[13.5px] font-medium tracking-[0.06em] ltr">{code}</code>
            <IconButton
              label={copied ? "کپی شد" : "کپی کد پیگیری"}
              size={28}
              tone="bare"
              onClick={async () => {
                const ok = await copyText(code);
                if (ok) setCopied(true);
                else toast("error", "کپی ناموفق بود");
              }}
              className={cx("text-[14px]", copied && "text-success!")}
            >
              {copied ? <Check weight="bold" /> : <Copy />}
            </IconButton>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 justify-end border-t border-fg/9 px-5 py-3.5 max-md:px-3.5 max-md:pb-[max(14px,env(safe-area-inset-bottom))]">
        <Button ref={closeRef} variant="primary" size={mobile ? "touch" : "md"} className={cx("px-5", mobile && "w-full")} onClick={onClose}>
          بستن
        </Button>
      </div>
    </div>
  );
}

/* ── Form ────────────────────────────────────────────── */

/** Feedback form rendered inside the «ارسال بازخورد» modal. */
export function FeedbackForm() {
  const { state, closeModal } = useStore();
  const mobile = useBreakpoint() === "mobile";
  const uid = useId();
  const ids = {
    category: `${uid}-cat`,
    categoryErr: `${uid}-cat-err`,
    rating: `${uid}-rate`,
    text: `${uid}-text`,
    textErr: `${uid}-text-err`,
    counter: `${uid}-count`,
    email: `${uid}-email`,
    emailErr: `${uid}-email-err`,
  };

  const [draft, setDraft] = useState<Draft>(readDraft);
  const [submitted, setSubmitted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [formH, setFormH] = useState<number>();

  const categoryRef = useRef<HTMLButtonElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const lastQuestion = [...state.messages].reverse().find((m) => m.role === "user")?.text;
  const canAttach = state.messages.length > 0 && !!lastQuestion;
  const attach = draft.attach && canAttach;

  const errors = validate(draft);
  const show: Errors = {
    category: submitted ? errors.category : undefined,
    text: submitted ? errors.text : undefined,
    email: submitted || emailTouched ? errors.email : undefined,
  };
  const len = draft.text.length;

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // debounced session draft; skipped once submitted so it is not rewritten after clearing
  useEffect(() => {
    if (code) return;
    const t = setTimeout(() => {
      try {
        if (JSON.stringify(draft) === JSON.stringify(EMPTY)) sessionStorage.removeItem(DRAFT_KEY);
        else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [draft, code]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const submit = () => {
    if (loading) return;
    setSubmitted(true);
    if (errors.category) return categoryRef.current?.focus();
    if (errors.text) return textRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();

    setLoading(true);
    timer.current = setTimeout(() => {
      const tracking = `FB-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
        const prev = Array.isArray(stored) ? stored : [];
        prev.push({
          code: tracking,
          at: new Date().toISOString(),
          category: draft.category,
          rating: draft.rating || null,
          text: draft.text.trim(),
          email: draft.email.trim() || null,
          question: attach ? lastQuestion : null,
          theme: state.theme,
        });
        localStorage.setItem(STORE_KEY, JSON.stringify(prev.slice(-50)));
      } catch {}
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      setFormH(formRef.current?.offsetHeight);
      setLoading(false);
      setCode(tracking);
    }, SUBMIT_MS);
  };

  const header = (
    <ModalHeader
      icon={<ChatTeardropText weight="fill" />}
      title="ارسال بازخورد"
      subtitle="نظر شما مستقیماً به تیم توسعه می‌رسد"
      onClose={closeModal}
    />
  );

  if (code) {
    return (
      <>
        {header}
        <Success code={code} onClose={closeModal} mobile={mobile} minHeight={formH} />
      </>
    );
  }

  return (
    <>
      {header}
      <form
        ref={formRef}
        noValidate
        aria-busy={loading || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <fieldset disabled={loading} className="m-0 flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto border-0 px-5 pt-4 pb-5 max-md:px-3.5">
          <div>
            <FieldLabel id={ids.category} error={!!show.category}>
              نوع بازخورد
            </FieldLabel>
            <CategoryChips
              value={draft.category}
              onChange={(category) => patch({ category })}
              labelId={ids.category}
              errorId={ids.categoryErr}
              invalid={!!show.category}
              firstRef={(el) => {
                categoryRef.current = el;
              }}
            />
            <FieldError id={ids.categoryErr}>{show.category}</FieldError>
          </div>

          <div>
            <FieldLabel id={ids.rating}>میزان رضایت از پاسخ‌ها</FieldLabel>
            <div className="-ms-1.5">
              <StarRating value={draft.rating} onChange={(rating) => patch({ rating })} labelId={ids.rating} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor={ids.text} error={!!show.text}>
              توضیحات
            </FieldLabel>
            <div className={inputRing(!!show.text)}>
              <textarea
                ref={textRef}
                id={ids.text}
                required
                rows={4}
                maxLength={MAX_LEN}
                value={draft.text}
                placeholder="چه چیزی خوب بود یا باید بهتر شود؟"
                aria-invalid={!!show.text || undefined}
                aria-describedby={cx(show.text && ids.textErr, ids.counter) || undefined}
                onChange={(e) => patch({ text: e.target.value })}
                className="block h-[112px] w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-[13.5px] leading-[1.8] outline-none placeholder:text-fg/30 focus-visible:outline-none max-md:text-[16px]"
              />
              <div className="flex justify-end px-3 pb-1.5">
                <span
                  id={ids.counter}
                  aria-live={len > WARN_LEN ? "polite" : "off"}
                  className={cx("text-[10.5px] tabular-nums transition-colors", len > WARN_LEN ? "text-warning" : "text-fg/35")}
                >
                  {faNum(len)}/{fa(MAX_LEN)}
                </span>
              </div>
            </div>
            <FieldError id={ids.textErr}>{show.text}</FieldError>
          </div>

          <div>
            <button
              type="button"
              role="checkbox"
              aria-checked={attach}
              disabled={!canAttach}
              onClick={() => patch({ attach: !draft.attach })}
              className="-mx-1 flex max-w-full items-center gap-2.5 rounded-[7px] px-1 py-1 text-start text-[13px] disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11"
            >
              <CheckboxBox checked={attach} />
              پیوست آخرین پرسش و پاسخ
            </button>
            {attach && lastQuestion && (
              <div className="mt-1 ms-[26px] animate-fade-in truncate text-[12px] text-fg/45" title={lastQuestion}>
                «{lastQuestion}»
              </div>
            )}
          </div>

          <div>
            <FieldLabel htmlFor={ids.email} error={!!show.email}>
              ایمیل (اختیاری)
            </FieldLabel>
            <div className={cx(inputRing(!!show.email), "flex h-[38px] items-center px-3 max-md:h-11")}>
              <input
                ref={emailRef}
                id={ids.email}
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={draft.email}
                placeholder="name@example.com"
                aria-invalid={!!show.email || undefined}
                aria-describedby={show.email ? ids.emailErr : undefined}
                onChange={(e) => patch({ email: e.target.value })}
                onBlur={() => setEmailTouched(true)}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-left font-latin text-[13px] outline-none placeholder:text-fg/30 focus-visible:outline-none max-md:text-[16px]"
              />
            </div>
            <FieldError id={ids.emailErr}>{show.email}</FieldError>
          </div>
        </fieldset>

        <div
          className={cx(
            "flex shrink-0 gap-2 border-t border-fg/9 px-5 py-3.5 max-md:px-3.5 max-md:pb-[max(14px,env(safe-area-inset-bottom))]",
            mobile ? "flex-col-reverse" : "justify-end",
          )}
        >
          <Button type="button" size={mobile ? "touch" : "md"} className={cx(mobile && "w-full")} onClick={closeModal} disabled={loading}>
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            size={mobile ? "touch" : "md"}
            className={cx("px-4", mobile && "w-full")}
            icon={<PaperPlaneTilt className="text-[15px] -scale-x-100" />}
            loading={loading}
          >
            ارسال
          </Button>
        </div>
      </form>
    </>
  );
}
