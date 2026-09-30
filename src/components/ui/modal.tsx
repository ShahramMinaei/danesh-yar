"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { useBreakpoint } from "@/lib/hooks";
import { IconButton } from "./button";

/**
 * Modal shell. Desktop/tablet: centered over a blurred, dimmed backdrop.
 * Mobile: near-full-screen bottom sheet (44px top gap, grabber, 20px radius).
 */
export function Modal({
  onClose,
  width,
  label,
  children,
  className,
}: {
  onClose: () => void;
  width: number;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const bp = useBreakpoint();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, []);

  const sheet = bp === "mobile";

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        className={cx("absolute inset-0 animate-fade-in bg-(--backdrop)", sheet ? "backdrop-blur-[3px]" : "backdrop-blur-[6px]")}
      />
      <div
        className={cx(
          "pointer-events-none absolute inset-0 flex",
          sheet ? "items-end pt-11" : "items-center justify-center p-5",
        )}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          style={sheet ? undefined : { width, maxWidth: "100%" }}
          className={cx(
            "pointer-events-auto flex flex-col overflow-hidden bg-surface outline-none",
            sheet
              ? "h-full w-full animate-sheet-up rounded-t-[20px] shadow-[0_-1px_0_var(--line-modal),0_-16px_40px_var(--shadow-color-lg)]"
              : "max-h-full animate-pop-in rounded-[14px] shadow-modal",
            className,
          )}
        >
          {sheet && (
            <div className="flex shrink-0 justify-center pt-2 pb-1">
              <span className="h-1 w-9 rounded-full bg-fg/20" />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({
  icon,
  title,
  subtitle,
  extra,
  onClose,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  onClose: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center gap-3.5 border-b border-fg/9",
        compact ? "gap-3 px-[18px] py-4" : "px-5 py-4 max-md:px-3.5 max-md:pt-2 max-md:pb-3",
      )}
    >
      {icon && (
        <div
          className={cx(
            "grid shrink-0 place-items-center rounded-[9px] bg-accent-bg text-accent-hi ring-1 ring-inset ring-accent-line",
            compact ? "size-8 text-[16px]" : "size-[34px] text-[17px]",
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={cx("font-medium", compact ? "text-[17px]" : "text-[19px] max-md:text-[16px]")}>{title}</div>
        {subtitle && <div className="mt-[3px] text-[12px] text-fg/45 max-md:text-[11px]">{subtitle}</div>}
      </div>
      {extra}
      <IconButton label="بستن" size={compact ? 28 : 30} onClick={onClose} className="max-md:size-9! text-[14px] text-fg/70">
        <X />
      </IconButton>
    </div>
  );
}
