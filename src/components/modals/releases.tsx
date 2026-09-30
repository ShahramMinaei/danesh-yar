"use client";

import { GitBranch } from "@phosphor-icons/react";
import { cx } from "@/lib/format";
import { RELEASES } from "@/lib/mock-data";
import type { Release } from "@/lib/types";
import { useStore } from "@/state/store";
import { ModalHeader } from "../ui/modal";
import { Badge } from "../ui/primitives";

const BADGE: Record<Release["badge"], { label: string; tone: "accent" | "neutral" }> = {
  latest: { label: "آخرین", tone: "accent" },
  stable: { label: "پایدار", tone: "neutral" },
  demo: { label: "نمایشی", tone: "neutral" },
};

const KIND: Record<Release["items"][number]["kind"], { label: string; tone: "success" | "info" | "error" }> = {
  new: { label: "جدید", tone: "success" },
  improve: { label: "بهبود", tone: "info" },
  fix: { label: "رفع", tone: "error" },
};

export function Releases() {
  const { closeModal } = useStore();
  return (
    <>
      <ModalHeader compact icon={<GitBranch />} title="تاریخچه نسخه‌ها" subtitle="آخرین تغییرات سامانه" onClose={closeModal} />
      <ol className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-[18px]">
        {RELEASES.map((r, i) => {
          const latest = i === 0;
          const last = i === RELEASES.length - 1;
          return (
            <li key={r.version} className="flex gap-3.5">
              <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1" aria-hidden>
                <span
                  className={cx(
                    "size-[11px] rounded-full",
                    latest
                      ? "bg-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]"
                      : i === 1
                        ? "bg-line ring-1 ring-inset ring-idle"
                        : "bg-chip ring-1 ring-inset ring-line-strong",
                  )}
                />
                {!last && (
                  <span className={cx("w-px flex-1", latest ? "bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--fg)_16%,transparent),color-mix(in_oklab,var(--fg)_6%,transparent))]" : "bg-fg/8")} />
                )}
              </div>
              <div className={cx("flex-1", !last && "pb-[22px]")}>
                <div className="flex items-center gap-2">
                  <span className={cx("font-latin font-semibold ltr", latest ? "text-[16px]" : i === 1 ? "text-[15px] text-fg/80" : "text-[15px] text-fg/70")}>
                    {r.version}
                  </span>
                  <Badge tone={BADGE[r.badge].tone} className={cx(r.badge === "demo" && "text-fg/50")}>
                    {BADGE[r.badge].label}
                  </Badge>
                  <time className="ms-auto text-[10.5px] text-fg/35 ltr">{r.date}</time>
                </div>
                <ul className="m-0 mt-2.5 flex list-none flex-col gap-[7px] p-0">
                  {r.items.map((it, j) => (
                    <li key={j} className="flex gap-2 text-[12.5px] leading-[1.75]">
                      <Badge tone={KIND[it.kind].tone} className="h-[18px] rounded-[4px] px-1.5 text-[9.5px]">
                        {KIND[it.kind].label}
                      </Badge>
                      <span className={latest ? "text-fg/75" : i === 1 ? "text-fg/70" : "text-fg/65"}>{it.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
