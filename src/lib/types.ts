export type ThemeId = "dark" | "light" | "emerald" | "cyber";
export type RetrievalMode = "auto" | "manual";
export type ScopeId = "quick" | "standard" | "deep";

export type DocCategory = "structure" | "general" | "execution";

export interface SourceDoc {
  id: string;
  title: string;
  short: string;
  category: DocCategory;
  chunks: number;
}

/* ── Rich answer content ─────────────────────────────── */

export type Inline =
  | string
  | { b: string }
  | { cite: string; label: string };

export type FormulaPart = string | { sub: string };

export type Block =
  | { type: "p"; content: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | {
      type: "table";
      caption: string;
      head: string[];
      rows: string[][];
      /** column indexes rendered as LTR monospace */
      mono?: number[];
      /** column indexes rendered muted */
      muted?: number[];
      /** per-row source chunk id backing that row (its «مرجع» cell) */
      rowCites?: (string | undefined)[];
    }
  | { type: "formula"; expr: FormulaPart[]; legend: { sym: FormulaPart[]; desc: string }[] }
  | { type: "callout"; tone: "warning" | "info"; content: Inline[] };

/* ── Retrieval ───────────────────────────────────────── */

export type ChunkBody =
  | { type: "h"; text: string }
  | { type: "p"; text: string; highlight?: boolean }
  | { type: "formula"; expr: FormulaPart[] };

export interface RetrievedChunk {
  id: string;
  docId: string;
  docShort: string;
  docTitle: string;
  clause: string;
  topic: string;
  title: string;
  score: number;
  chapter: string;
  page: number;
  edition: string;
  tokens: number;
  chunkIndex: number;
  chunkTotal: number;
  categoryLabel: string;
  excerpt: { before: string; highlight: string; after: string };
  body: ChunkBody[];
}

/* ── Conversation ────────────────────────────────────── */

export type StepKey = "understand" | "rewrite" | "retrieve" | "compose";
export type StepStatus = "pending" | "running" | "success" | "failed" | "stopped";

export interface PipelineStep {
  key: StepKey;
  status: StepStatus;
  ms?: number;
  /** extra technical detail, e.g. "7/10" while retrieving */
  meta?: string;
}

/** A file attached to a question. Kept in the browser only; images carry an object URL for previews. */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
  time: string;
  filterLabel: string;
  attachments?: Attachment[];
}

export interface AnswerError {
  title: string;
  message: string;
  details: string;
  footer: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  questionId: string;
  status: "streaming" | "done" | "error";
  steps: PipelineStep[];
  refs: RetrievedChunk[];
  blocks: Block[];
  /** streaming cursor: blocks before `block` are complete, `chars` of the current one are shown */
  reveal: { block: number; chars: number };
  stream: { tokens: number; elapsedMs: number };
  meta?: { latencyMs: number; model: string; chunks: number; tokens: number };
  error?: AnswerError;
  feedback?: "up" | "down";
  /** the user stopped this answer mid-stream; blocks hold the frozen partial */
  stopped?: boolean;
}

export type Message = UserMessage | AssistantMessage;

/* ── AI providers ────────────────────────────────────── */

export type ProviderSlot = "primary" | "gateway" | "custom";

export interface ModelOption {
  id: string;
  ctx: string;
}

export interface ProviderConfig {
  slot: ProviderSlot;
  provider: string;
  description: string;
  host: string;
  apiKey: string;
  baseUrl: string;
  baseUrlRequired: boolean;
  models: ModelOption[];
  model: string;
  customModel: string;
  lastValidated?: string;
  health: "connected" | "idle" | "degraded";
}

export type ConnectionTest =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; latencyMs: number; sample: string }
  | { state: "slow"; latencyMs: number }
  | { state: "failed"; message: string; code: string };

/* ── Telemetry ───────────────────────────────────────── */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogLine {
  id: string;
  ts: string;
  level: LogLevel;
  service: string;
  message: string;
}

export type LogTab = "general" | "errors" | "rag" | "access";

export interface Release {
  version: string;
  badge: "latest" | "stable" | "demo";
  date: string;
  items: { kind: "new" | "improve" | "fix"; text: string }[];
}
