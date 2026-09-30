"use client";

import { Keyboard } from "@phosphor-icons/react";
import { Fragment, useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { SHORTCUT_GROUPS, SHORTCUTS, formatKeys, matches, useIsMac } from "@/lib/keymap";
import { useStore } from "@/state/store";
import { ModalHeader } from "../../ui/modal";
import { Kbd } from "../../ui/primitives";

/** Key caps for one shortcut joined by «+»; `held` lights up the caps currently pressed. */
export function KeyCombo({ keys, labels, held, className }: {
  keys: string[];
  labels?: string[];
  held?: Set<string>;
  className?: string;
}) {
  const isMac = useIsMac();
  const caps = labels ?? formatKeys(keys, isMac);
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 ltr", className)}>
      {caps.map((cap, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="text-[10px] text-fg/30">
              +
            </span>
          )}
          <Kbd pressed={held?.has(keys[i])}>{cap}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}

const MODS = ["mod", "shift", "alt"];

/** Pressed physical keys (e.code) plus the logical modifiers "mod" / "shift" / "alt". */
function useHeldKeys(): Set<string> {
  const [held, setHeld] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const codes = new Set<string>();
    const publish = (e: KeyboardEvent | null) => {
      const next = new Set(codes);
      if (e?.ctrlKey || e?.metaKey) next.add("mod");
      if (e?.shiftKey) next.add("shift");
      if (e?.altKey) next.add("alt");
      setHeld(next);
    };
    const down = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      codes.add(e.code);
      publish(e);
      // try-it mode: keep the browser from acting on registered combos (the palette's ⌘K still passes through)
      const hit = SHORTCUTS.find((s) => !s.display && s.id !== "palette" && matches(e, s.keys));
      if (hit && (e.ctrlKey || e.metaKey || e.altKey)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      codes.delete(e.code);
      // macOS swallows keyup of other keys while ⌘ is held, so releasing ⌘ clears everything
      if (e.key === "Meta") codes.clear();
      publish(e);
    };
    const reset = () => {
      codes.clear();
      publish(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);

  return held;
}

/** «میان‌برهای صفحه‌کلید» sheet. Caps light up as you press them; nothing is executed here. */
export function ShortcutsSheet() {
  const { closeModal } = useStore();
  const held = useHeldKeys();

  return (
    <>
      <ModalHeader
        icon={<Keyboard />}
        title="میان‌برهای صفحه‌کلید"
        subtitle="کلیدها بر اساس جای فیزیکی کار می‌کنند؛ با صفحه‌کلید فارسی هم فعال‌اند"
        onClose={closeModal}
      />
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto px-5 py-4 max-md:grid-cols-1 max-md:px-3.5">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`sc-${group}`} className="flex min-w-0 flex-col gap-0.5">
            <h3 id={`sc-${group}`} className="kicker m-0 px-2 pb-1.5">
              {group}
            </h3>
            {SHORTCUTS.filter((s) => s.group === group).map((s) => {
              // exact combo: every key held and no extra modifier (Shift+/ must not light «/» too)
              const full = s.keys.every((k) => held.has(k)) && MODS.every((m) => !held.has(m) || s.keys.includes(m));
              return (
                <div
                  key={s.id}
                  className={cx(
                    "shortcut-row flex min-h-[34px] items-center justify-between gap-3 rounded-[7px] px-2",
                    full && "bg-accent/8",
                  )}
                >
                  <span className={cx("min-w-0 truncate text-[13px]", full ? "text-fg" : "text-fg/75")}>{s.label}</span>
                  <KeyCombo keys={s.keys} labels={s.display} held={held} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-fg/9 px-5 py-3 text-[11.5px] text-fg/45 max-md:px-3.5 max-md:pb-[max(12px,env(safe-area-inset-bottom))]">
        در هر جای برنامه <Kbd>؟</Kbd> را بزنید تا این راهنما باز شود
      </div>
    </>
  );
}
