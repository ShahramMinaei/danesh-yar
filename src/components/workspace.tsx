"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/format";
import { useBreakpoint, usePresence } from "@/lib/hooks";
import { useStore } from "@/state/store";
import { CitationPopover } from "./chat/citation-popover";
import { Composer, type ComposerHandle } from "./chat/composer";
import { AssistantTurn, UserBubble } from "./chat/messages";
import { Welcome } from "./chat/welcome";
import { CommandPalette } from "./features/command/command-palette";
import { GlobalShortcuts } from "./features/command/global-shortcuts";
import { ShortcutsSheet } from "./features/command/shortcuts-sheet";
import { FeedbackForm } from "./features/feedback/feedback-form";
import { StopHotkey } from "./features/stream/stop-hotkey";
import { ThemeColorMeta } from "./features/theme/theme-color-meta";
import { Tour } from "./features/tour/tour";
import { TourOffer } from "./features/tour/tour-offer";
import { SidebarPanel, SidebarRail } from "./layout/sidebar";
import { TopNav } from "./layout/top-nav";
import { ChunkInspector } from "./modals/chunk-inspector";
import { ModelSettings } from "./modals/model-settings";
import { Releases } from "./modals/releases";
import { Telemetry } from "./modals/telemetry";
import { Modal } from "./ui/modal";
import { Toaster } from "./ui/toaster";

/**
 * App shell.
 *  desktop ≥1024: persistent sidebar (288px expanded ⇄ 64px rail)
 *  tablet 768–1023: 56px rail; toggle opens the full sidebar over content
 *  mobile <768: simplified header; sidebar becomes a drawer; modals become sheets
 */
export function Workspace() {
  const { state, set, closeModal } = useStore();
  const bp = useBreakpoint();
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const overlay = usePresence(bp === "tablet" && state.sidebarExpanded, 300);
  const drawer = usePresence(bp === "mobile" && state.drawerOpen, 300);
  // clip the docked sidebar only while expanded or collapsing, so the rail's popovers can overflow
  const docked = usePresence(state.sidebarExpanded, 300);
  const toggleSidebar = () => {
    if (bp === "mobile") set({ drawerOpen: !state.drawerOpen });
    else set({ sidebarExpanded: !state.sidebarExpanded });
  };

  // when entering tablet, start with the rail; leaving mobile closes the drawer
  const prevBp = useRef(bp);
  useEffect(() => {
    if (prevBp.current !== bp) {
      if (bp === "tablet") set({ sidebarExpanded: false });
      if (bp !== "mobile" && state.drawerOpen) set({ drawerOpen: false });
      prevBp.current = bp;
    }
  }, [bp, set, state.drawerOpen]);

  // keep the conversation pinned to the bottom while streaming, unless the user scrolled up
  // (never on the empty welcome screen: that must open from its top)
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current && state.messages.length > 0) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  const lastLen = useRef(0);
  useEffect(() => {
    if (state.messages.length > lastLen.current) stick.current = true;
    lastLen.current = state.messages.length;
  }, [state.messages.length]);

  const empty = state.messages.length === 0;

  return (
    <div className="flex h-dvh overflow-hidden bg-app">
      {/* sidebar (start side = right in RTL) */}
      {/* desktop: width glides 288 ⇄ 64px while the panel and rail crossfade, both pinned to the start edge */}
      {bp === "desktop" && (
        <div
          style={{ width: state.sidebarExpanded ? 288 : 64 }}
          className={cx(
            "relative z-10 h-full shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            docked.mounted && "overflow-hidden",
          )}
        >
          <div
            inert={!state.sidebarExpanded}
            className={cx(
              "absolute inset-y-0 right-0 transition-opacity motion-reduce:transition-none",
              state.sidebarExpanded ? "opacity-100 delay-100 duration-250" : "pointer-events-none opacity-0 duration-150",
            )}
          >
            <SidebarPanel variant="docked" onClose={() => set({ sidebarExpanded: false })} />
          </div>
          <div
            inert={state.sidebarExpanded}
            className={cx(
              "absolute inset-y-0 right-0 transition-opacity motion-reduce:transition-none",
              state.sidebarExpanded ? "opacity-0 duration-150" : "opacity-100 delay-100 duration-250",
            )}
          >
            <SidebarRail onExpand={() => set({ sidebarExpanded: true })} />
          </div>
        </div>
      )}
      {bp === "tablet" && <SidebarRail compact onExpand={() => set({ sidebarExpanded: true })} />}

      <main className="flex min-w-0 flex-1 flex-col" aria-label="میزکار گفتگو">
        {bp === "mobile" && <div className="h-[env(safe-area-inset-top)] shrink-0" />}
        <TopNav variant={bp} onToggleSidebar={toggleSidebar} />

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          data-chat-scroller
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {empty ? (
            <Welcome bp={bp} onPick={(q) => composer.current?.fill(q)} />
          ) : (
            <div
              className={cx(
                "mx-auto flex flex-col",
                bp === "desktop" ? "max-w-[880px] gap-[22px] px-6 py-[26px]" : bp === "tablet" ? "gap-4 px-5 py-[18px]" : "gap-3.5 px-3 py-3.5",
              )}
            >
              {state.messages.map((m) =>
                m.role === "user" ? <UserBubble key={m.id} message={m} bp={bp} /> : <AssistantTurn key={m.id} message={m} bp={bp} />,
              )}
            </div>
          )}
        </div>

        <Composer ref={composer} bp={bp} />
      </main>

      {/* tablet overlay sidebar */}
      {overlay.mounted && (
        <div className={cx("fixed inset-0 z-30", overlay.closing && "pointer-events-none")}>
          <div
            className={cx("absolute inset-0 bg-(--backdrop)", overlay.closing ? "animate-fade-out" : "animate-fade-in")}
            onClick={() => set({ sidebarExpanded: false })}
          />
          <div className={cx("absolute inset-y-0 right-0", overlay.closing ? "animate-drawer-out" : "animate-drawer-in")}>
            <SidebarPanel variant="overlay" onClose={() => set({ sidebarExpanded: false })} />
          </div>
        </div>
      )}

      {/* mobile drawer */}
      {drawer.mounted && (
        <div className={cx("fixed inset-0 z-30", drawer.closing && "pointer-events-none")} role="dialog" aria-modal="true" aria-label="فیلتر اسناد">
          <div
            className={cx("absolute inset-0 bg-(--backdrop) backdrop-blur-[2px]", drawer.closing ? "animate-fade-out" : "animate-fade-in")}
            onClick={() => set({ drawerOpen: false })}
          />
          <div
            className={cx(
              "absolute inset-y-0 right-0 left-14 flex flex-col bg-panel pt-[env(safe-area-inset-top)] shadow-[-16px_0_40px_var(--shadow-color)]",
              drawer.closing ? "animate-drawer-out" : "animate-drawer-in",
            )}
          >
            <SidebarPanel variant="drawer" onClose={() => set({ drawerOpen: false })} />
          </div>
        </div>
      )}

      <CitationPopover />
      <CommandPalette composer={composer} />
      <GlobalShortcuts composer={composer} onToggleSidebar={toggleSidebar} />

      {state.modal?.type === "inspector" && (
        <Modal label="بازرس قطعه سند" width={780} onClose={closeModal} className="md:h-[min(620px,100%)]">
          <ChunkInspector chunkId={state.modal.chunkId} siblings={state.modal.siblings} />
        </Modal>
      )}
      {state.modal?.type === "settings" && (
        <Modal label="تنظیمات هوش مصنوعی و مدل" width={820} onClose={closeModal}>
          <ModelSettings />
        </Modal>
      )}
      {state.modal?.type === "telemetry" && (
        <Modal label="پایش سامانه و لاگ‌ها" width={900} onClose={closeModal}>
          <Telemetry />
        </Modal>
      )}
      {state.modal?.type === "releases" && (
        <Modal label="تاریخچه نسخه‌ها" width={440} onClose={closeModal}>
          <Releases />
        </Modal>
      )}
      {state.modal?.type === "shortcuts" && (
        <Modal label="میان‌برهای صفحه‌کلید" width={600} onClose={closeModal}>
          <ShortcutsSheet />
        </Modal>
      )}
      {state.modal?.type === "feedback" && (
        <Modal label="ارسال بازخورد" width={520} onClose={closeModal}>
          <FeedbackForm />
        </Modal>
      )}

      <Toaster />
      <StopHotkey />
      <ThemeColorMeta />
      <Tour />
      <TourOffer />
    </div>
  );
}
