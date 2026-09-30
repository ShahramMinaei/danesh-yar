"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { streamAnswer, type AskEvent } from "@/lib/api";
import { faNum, faTime, uid } from "@/lib/format";
import { DEFAULT_SELECTED_DOCS, DOCS, PROVIDERS, STEP_ORDER, modelDisplay } from "@/lib/mock-data";
import { freezePartial } from "@/lib/stream-control";
import type {
  AssistantMessage,
  Attachment,
  Message,
  ProviderConfig,
  ProviderSlot,
  RetrievalMode,
  ScopeId,
  ThemeId,
  UserMessage,
} from "@/lib/types";

/* ── State ───────────────────────────────────────────── */

export type ModalState =
  | null
  | { type: "inspector"; chunkId: string; siblings: string[] }
  | { type: "settings" }
  | { type: "telemetry" }
  | { type: "releases" }
  | { type: "shortcuts" }
  | { type: "feedback" };

export interface Toast {
  id: string;
  tone: "success" | "error" | "info";
  text: string;
  action?: { label: string; run: () => void };
}

interface State {
  theme: ThemeId;
  /** desktop: expanded vs rail · tablet: overlay open · mobile: drawer open */
  sidebarExpanded: boolean;
  drawerOpen: boolean;
  mode: RetrievalMode;
  selectedDocs: string[];
  scope: ScopeId;
  providers: ProviderConfig[];
  activeSlot: ProviderSlot;
  messages: Message[];
  modal: ModalState;
  popover: { chunkId: string; anchor: { x: number; y: number; w: number; h: number } } | null;
  toasts: Toast[];
  hydrated: boolean;
}

const initialState: State = {
  theme: "dark",
  sidebarExpanded: true,
  drawerOpen: false,
  mode: "auto",
  selectedDocs: DEFAULT_SELECTED_DOCS,
  scope: "standard",
  providers: PROVIDERS,
  activeSlot: "primary",
  messages: [],
  modal: null,
  popover: null,
  toasts: [],
  hydrated: false,
};

type Action =
  | { type: "hydrate"; patch: Partial<State> }
  | { type: "set"; patch: Partial<State> }
  | { type: "toggleDoc"; id: string }
  | { type: "setAllDocs"; all: boolean }
  | { type: "updateProvider"; slot: ProviderSlot; patch: Partial<ProviderConfig> }
  | { type: "addMessages"; messages: Message[] }
  | { type: "replaceMessage"; id: string; message: Message }
  | { type: "updateAssistant"; id: string; update: (m: AssistantMessage) => AssistantMessage }
  | { type: "pushToast"; toast: Toast }
  | { type: "dismissToast"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.patch, hydrated: true };
    case "set":
      return { ...state, ...action.patch };
    case "toggleDoc": {
      const has = state.selectedDocs.includes(action.id);
      return {
        ...state,
        selectedDocs: has ? state.selectedDocs.filter((d) => d !== action.id) : [...state.selectedDocs, action.id],
      };
    }
    case "setAllDocs":
      return { ...state, selectedDocs: action.all ? DOCS.map((d) => d.id) : [] };
    case "updateProvider":
      return {
        ...state,
        providers: state.providers.map((p) => (p.slot === action.slot ? { ...p, ...action.patch } : p)),
      };
    case "addMessages":
      return { ...state, messages: [...state.messages, ...action.messages] };
    case "replaceMessage":
      return { ...state, messages: state.messages.map((m) => (m.id === action.id ? action.message : m)) };
    case "updateAssistant":
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id && m.role === "assistant" ? action.update(m) : m)),
      };
    case "pushToast":
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

/* ── Event → message reducer ─────────────────────────── */

function applyEvent(m: AssistantMessage, e: AskEvent): AssistantMessage {
  switch (e.type) {
    case "step":
      return {
        ...m,
        steps: m.steps.map((s) => (s.key === e.key ? { ...s, status: e.status, ms: e.ms ?? s.ms, meta: e.meta ?? s.meta } : s)),
      };
    case "refs":
      return { ...m, refs: e.refs };
    case "answer":
      return { ...m, blocks: e.blocks, reveal: { block: 0, chars: 0 } };
    case "progress":
      return { ...m, reveal: { block: e.block, chars: e.chars }, stream: { tokens: e.tokens, elapsedMs: e.elapsedMs } };
    case "done":
      return { ...m, status: "done", meta: e.meta, reveal: { block: m.blocks.length, chars: 0 } };
    case "error":
      return { ...m, status: "error", error: e.error };
  }
}

function freshAssistant(questionId: string): AssistantMessage {
  return {
    id: uid("a"),
    role: "assistant",
    questionId,
    status: "streaming",
    steps: STEP_ORDER.map((key) => ({ key, status: "pending" })),
    refs: [],
    blocks: [],
    reveal: { block: 0, chars: 0 },
    stream: { tokens: 0, elapsedMs: 0 },
  };
}

/* ── Persistence ─────────────────────────────────────── */

const THEMES = ["dark", "light", "emerald", "cyber"] as const;
const MODES = ["auto", "manual"] as const;
const SCOPE_IDS = ["quick", "standard", "deep"] as const;
const SLOTS = ["primary", "gateway", "custom"] as const;

/**
 * localStorage is user-controlled input: only the known preference keys are
 * restored, and only when each value has the right type and range. Anything
 * else (a corrupted or tampered entry, keys such as `messages` or
 * `providers`) is ignored, so it can neither crash the app nor inject state.
 */
function readPrefs(raw: string | null): Partial<State> {
  if (!raw) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const p = v as Record<string, unknown>;
  const out: Partial<State> = {};
  const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T => typeof x === "string" && (list as readonly string[]).includes(x);
  if (oneOf(THEMES, p.theme)) out.theme = p.theme;
  if (oneOf(MODES, p.mode)) out.mode = p.mode;
  if (oneOf(SCOPE_IDS, p.scope)) out.scope = p.scope;
  if (oneOf(SLOTS, p.activeSlot)) out.activeSlot = p.activeSlot;
  if (typeof p.sidebarExpanded === "boolean") out.sidebarExpanded = p.sidebarExpanded;
  if (Array.isArray(p.selectedDocs)) {
    const known = new Set(DOCS.map((d) => d.id));
    out.selectedDocs = [...new Set(p.selectedDocs.filter((id): id is string => typeof id === "string" && known.has(id)))];
  }
  return out;
}

/* ── Context ─────────────────────────────────────────── */

interface Api {
  state: State;
  activeProvider: ProviderConfig;
  isStreaming: boolean;
  filterLabel: string;
  set: (patch: Partial<State>) => void;
  toggleDoc: (id: string) => void;
  setAllDocs: (all: boolean) => void;
  updateProvider: (slot: ProviderSlot, patch: Partial<ProviderConfig>) => void;
  ask: (question: string, attachments?: Attachment[]) => void;
  regenerate: (assistantId: string, scope?: ScopeId) => void;
  /** aborts a streaming answer (default: the last one) and freezes its partial content */
  stop: (id?: string) => void;
  clearConversation: () => void;
  setFeedback: (assistantId: string, v: "up" | "down") => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  openCitation: (chunkId: string, el: HTMLElement) => void;
  closePopover: () => void;
  toast: (tone: Toast["tone"], text: string, action?: Toast["action"]) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<Api | null>(null);

const STORAGE_KEY = "danesh-yar:prefs";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const aborters = useRef(new Map<string, AbortController>());
  const stateRef = useRef(state);
  stateRef.current = state;

  /* persistence */
  useEffect(() => {
    let patch: Partial<State> = {};
    try {
      patch = readPrefs(localStorage.getItem(STORAGE_KEY));
    } catch {}
    if (typeof window !== "undefined" && window.innerWidth < 1024) patch.sidebarExpanded = false;
    dispatch({ type: "hydrate", patch });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { theme, mode, selectedDocs, scope, sidebarExpanded, activeSlot } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, mode, selectedDocs, scope, sidebarExpanded, activeSlot }));
    } catch {}
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const activeProvider = state.providers.find((p) => p.slot === state.activeSlot)!;
  const isStreaming = state.messages.some((m) => m.role === "assistant" && m.status === "streaming");
  const filterLabel = state.mode === "auto" ? "تشخیص خودکار" : `${faNum(state.selectedDocs.length)} سند فعال`;

  const toast = useCallback((tone: Toast["tone"], text: string, action?: Toast["action"]) => {
    const id = uid("t");
    dispatch({ type: "pushToast", toast: { id, tone, text, action } });
    setTimeout(() => dispatch({ type: "dismissToast", id }), action ? 6000 : 3200);
  }, []);

  const run = useCallback((assistant: AssistantMessage, question: string, scopeOverride?: ScopeId) => {
    const s = stateRef.current;
    const provider = s.providers.find((p) => p.slot === s.activeSlot)!;
    const ctrl = new AbortController();
    aborters.current.set(assistant.id, ctrl);
    streamAnswer(
      {
        question,
        scope: scopeOverride ?? s.scope,
        mode: s.mode,
        docIds: s.selectedDocs,
        model: modelDisplay(provider),
      },
      // a stopped (frozen) answer ignores events that were already in flight
      (e) => dispatch({ type: "updateAssistant", id: assistant.id, update: (m) => (m.stopped ? m : applyEvent(m, e)) }),
      ctrl.signal,
    ).finally(() => aborters.current.delete(assistant.id));
  }, []);

  const ask = useCallback(
    (question: string, attachments?: Attachment[]) => {
      const s = stateRef.current;
      const text = question.trim();
      if (!text) return;
      const user: UserMessage = {
        id: uid("u"),
        role: "user",
        text,
        time: faTime(),
        filterLabel: s.mode === "auto" ? "تشخیص خودکار" : `${faNum(s.selectedDocs.length)} سند فعال`,
        ...(attachments?.length ? { attachments } : {}),
      };
      const assistant = freshAssistant(user.id);
      dispatch({ type: "addMessages", messages: [user, assistant] });
      run(assistant, text);
    },
    [run],
  );

  const regenerate = useCallback(
    (assistantId: string, scope?: ScopeId) => {
      const s = stateRef.current;
      const old = s.messages.find((m) => m.id === assistantId) as AssistantMessage | undefined;
      if (!old) return;
      const question = s.messages.find((m) => m.id === old.questionId) as UserMessage | undefined;
      if (!question) return;
      aborters.current.get(assistantId)?.abort();
      if (scope) dispatch({ type: "set", patch: { scope } });
      const next = freshAssistant(old.questionId);
      dispatch({ type: "replaceMessage", id: assistantId, message: next });
      run(next, question.text, scope);
    },
    [run],
  );

  const stop = useCallback((id?: string) => {
    if (!id) {
      const list = stateRef.current.messages;
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        if (m.role === "assistant" && m.status === "streaming") {
          id = m.id;
          break;
        }
      }
    }
    if (!id) return;
    aborters.current.get(id)?.abort();
    aborters.current.delete(id);
    dispatch({ type: "updateAssistant", id, update: freezePartial });
  }, []);

  const clearConversation = useCallback(() => {
    const previous = stateRef.current.messages;
    if (previous.length === 0) return;
    aborters.current.forEach((c) => c.abort());
    aborters.current.clear();
    const restorable = previous.filter((m) => m.role === "user" || m.status !== "streaming");
    dispatch({ type: "set", patch: { messages: [], popover: null } });
    toast("info", "گفتگو پاک شد", {
      label: "بازگردانی",
      run: () => dispatch({ type: "set", patch: { messages: restorable } }),
    });
  }, [toast]);

  const api = useMemo<Api>(
    () => ({
      state,
      activeProvider,
      isStreaming,
      filterLabel,
      set: (patch) => dispatch({ type: "set", patch }),
      toggleDoc: (id) => dispatch({ type: "toggleDoc", id }),
      setAllDocs: (all) => dispatch({ type: "setAllDocs", all }),
      updateProvider: (slot, patch) => dispatch({ type: "updateProvider", slot, patch }),
      ask,
      regenerate,
      stop,
      clearConversation,
      setFeedback: (id, v) =>
        dispatch({ type: "updateAssistant", id, update: (m) => ({ ...m, feedback: m.feedback === v ? undefined : v }) }),
      openModal: (modal) => dispatch({ type: "set", patch: { modal, popover: null, drawerOpen: false } }),
      closeModal: () => dispatch({ type: "set", patch: { modal: null } }),
      openCitation: (chunkId, el) => {
        if (state.popover?.chunkId === chunkId) return dispatch({ type: "set", patch: { popover: null } });
        const r = el.getBoundingClientRect();
        dispatch({ type: "set", patch: { popover: { chunkId, anchor: { x: r.left, y: r.top, w: r.width, h: r.height } } } });
      },
      closePopover: () => dispatch({ type: "set", patch: { popover: null } }),
      toast,
      dismissToast: (id) => dispatch({ type: "dismissToast", id }),
    }),
    [state, activeProvider, isStreaming, filterLabel, ask, regenerate, stop, clearConversation, toast],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}
