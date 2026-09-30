"use client";

import { Stop } from "@phosphor-icons/react";
import { cx } from "@/lib/format";
import type { Breakpoint } from "@/lib/hooks";
import type { AssistantMessage } from "@/lib/types";

/**
 * Quiet status line under an answer the user stopped. Regenerating lives in the
 * actions row right below, so this row only says what happened.
 */
export function StoppedRow({ message, bp }: { message: AssistantMessage; bp: Breakpoint }) {
  const partial = message.blocks.length > 0;
  return (
    <div
      role="status"
      className={cx("flex animate-fade-in items-center gap-2 text-fg/55", bp === "mobile" ? "text-[11.5px]" : "text-[12px]")}
    >
      <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-fg/8 text-fg/60">
        <Stop weight="fill" size={9} />
      </span>
      {partial ? (
        <span>
          پاسخ متوقف شد
          <span className="text-fg/40"> · بخشی از پاسخ نمایش داده شده است</span>
        </span>
      ) : (
        <span>پیش از تولید متن متوقف شد</span>
      )}
    </div>
  );
}
