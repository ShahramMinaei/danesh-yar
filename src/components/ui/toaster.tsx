"use client";

import { CheckCircle, Info, X, XCircle } from "@phosphor-icons/react";
import { cx } from "@/lib/format";
import { useStore } from "@/state/store";

const TONE = {
  success: { icon: CheckCircle, cls: "text-success", ring: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--success)_35%,transparent),0_6px_18px_var(--shadow-color)]" },
  error: { icon: XCircle, cls: "text-error", ring: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--error)_35%,transparent),0_6px_18px_var(--shadow-color)]" },
  info: { icon: Info, cls: "text-accent-hi", ring: "shadow-pop" },
};

export function Toaster() {
  const { state, dismissToast } = useStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[132px] z-[60] flex flex-col items-center gap-2 px-4 max-md:bottom-[124px]"
    >
      {state.toasts.map((t) => {
        const { icon: Icon, cls, ring } = TONE[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={cx("pointer-events-auto flex animate-sheet-up items-center gap-2.5 rounded-[10px] bg-surface py-[11px] ps-[13px] pe-2", ring)}
          >
            <Icon weight="fill" className={cx("text-[17px]", cls)} />
            <span className="text-[12.5px]">{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  dismissToast(t.id);
                }}
                className={cx("ms-1 text-[11.5px] font-semibold", t.tone === "error" ? "text-error" : "text-accent")}
              >
                {t.action.label}
              </button>
            )}
            <button
              aria-label="بستن"
              onClick={() => dismissToast(t.id)}
              className="grid size-[22px] place-items-center rounded-[6px] text-[12px] text-fg/45 hover:bg-fg/8"
            >
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}
