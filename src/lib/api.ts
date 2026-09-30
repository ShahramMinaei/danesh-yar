/**
 * Answer API.
 *
 * `streamAnswer` is the single seam between the UI and the RAG backend. The
 * implementation below is a local simulation that emits the same event stream a
 * real server would (pipeline step updates → retrieved chunks → streamed answer
 * → done/error). To connect a real backend, replace the body with a fetch to
 * your SSE / NDJSON endpoint and forward each parsed event to `onEvent`.
 *
 * Demo triggers: a question containing «خطا» or "timeout" simulates a
 * retrieval timeout.
 */
import { streamLength } from "./answer";
import { ALL_CHUNKS, SLAB_ANSWER, scopeById } from "./mock-data";
import type { AnswerError, Block, RetrievalMode, RetrievedChunk, ScopeId, StepKey, StepStatus } from "./types";

export interface AskRequest {
  question: string;
  scope: ScopeId;
  mode: RetrievalMode;
  docIds: string[];
  model: string;
}

export type AskEvent =
  | { type: "step"; key: StepKey; status: StepStatus; ms?: number; meta?: string }
  | { type: "refs"; refs: RetrievedChunk[] }
  | { type: "answer"; blocks: Block[] }
  | { type: "progress"; block: number; chars: number; tokens: number; elapsedMs: number }
  | { type: "done"; meta: { latencyMs: number; model: string; chunks: number; tokens: number } }
  | { type: "error"; error: AnswerError };

class Aborted extends Error {}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Aborted());
    const onAbort = () => {
      clearTimeout(t);
      reject(new Aborted());
    };
    // detach on normal completion too, so a long stream doesn't pile up listeners on one signal
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const SCOPE_FACTOR: Record<ScopeId, number> = { quick: 0.7, standard: 1, deep: 1.6 };

export async function streamAnswer(req: AskRequest, onEvent: (e: AskEvent) => void, signal: AbortSignal): Promise<void> {
  const started = performance.now();
  const f = SCOPE_FACTOR[req.scope];
  const k = scopeById(req.scope).k;
  const shouldFail = /خطا|timeout/i.test(req.question);
  // Each step reports its real wall-clock duration (running → success).
  let t0 = 0;
  const begin = () => (t0 = performance.now());
  const took = () => Math.round(performance.now() - t0);

  try {
    // 1 · understand
    begin();
    onEvent({ type: "step", key: "understand", status: "running" });
    await sleep(420, signal);
    onEvent({ type: "step", key: "understand", status: "success", ms: took() });

    // 2 · rewrite & enrich
    begin();
    onEvent({ type: "step", key: "rewrite", status: "running" });
    await sleep(520, signal);
    onEvent({ type: "step", key: "rewrite", status: "success", ms: took() });

    // 3 · retrieve
    const pool = req.mode === "manual" ? ALL_CHUNKS.filter((c) => req.docIds.includes(c.docId)) : ALL_CHUNKS;
    const refs = pool.slice(0, k);
    begin();
    onEvent({ type: "step", key: "retrieve", status: "running", meta: `0/${k}` });
    const target = shouldFail ? Math.round(k * 0.7) : k;
    for (let i = 1; i <= target; i++) {
      await sleep((90 * f * 10) / k, signal);
      onEvent({ type: "step", key: "retrieve", status: "running", meta: `${i}/${k}` });
    }

    if (shouldFail) {
      await sleep(1400, signal);
      onEvent({ type: "step", key: "retrieve", status: "failed" });
      onEvent({
        type: "error",
        error: {
          title: "بازیابی اسناد ناتمام ماند",
          message:
            "ارتباط با سرویس جستجوی برداری در مهلت مقرر پاسخ نداد. پاسخی تولید نشد تا مطلبی بدون منبع ارائه نشود. می‌توانید دوباره تلاش کنید یا عمق جستجو را به «سریع» کاهش دهید.",
          details: `RetrievalTimeout: vector store did not respond\n  service   rag.retriever\n  request   req_8f42c1ad\n  timeout   8000ms · attempts 2/2\n  at ${new Date().toTimeString().slice(0, 8)} · trace 4d9c…e18`,
          footer: `failed after ${((performance.now() - started) / 1000).toFixed(1)}s · ${req.model} · 0 chunks`,
        },
      });
      return;
    }

    if (refs.length === 0) {
      onEvent({ type: "step", key: "retrieve", status: "failed" });
      onEvent({
        type: "error",
        error: {
          title: "منبع مرتبطی یافت نشد",
          message: "در اسناد انتخاب‌شده بندی مرتبط با این سؤال پیدا نشد. اسناد بیشتری انتخاب کنید یا حالت «تشخیص خودکار» را فعال کنید.",
          details: `NoRelevantChunks: 0 chunks above threshold 0.55\n  service   rag.retriever\n  sources   [${req.docIds.join(",")}]`,
          footer: `failed after ${((performance.now() - started) / 1000).toFixed(1)}s · ${req.model} · 0 chunks`,
        },
      });
      return;
    }

    onEvent({ type: "refs", refs });
    onEvent({ type: "step", key: "retrieve", status: "success", ms: took(), meta: String(refs.length) });

    // 4 · compose (stream)
    begin();
    onEvent({ type: "step", key: "compose", status: "running" });
    await sleep(350, signal);
    const blocks = SLAB_ANSWER;
    onEvent({ type: "answer", blocks });
    const composeStart = performance.now();
    let tokens = 0;
    for (let b = 0; b < blocks.length; b++) {
      const len = streamLength(blocks[b]);
      if (len === 0) {
        await sleep(260, signal);
        tokens += 60;
        onEvent({ type: "progress", block: b + 1, chars: 0, tokens, elapsedMs: performance.now() - composeStart });
        continue;
      }
      for (let c = 0; c < len; c += 5) {
        await sleep(22, signal);
        tokens += 2;
        onEvent({ type: "progress", block: b, chars: c, tokens, elapsedMs: performance.now() - composeStart });
      }
      onEvent({ type: "progress", block: b + 1, chars: 0, tokens, elapsedMs: performance.now() - composeStart });
    }
    onEvent({ type: "step", key: "compose", status: "success", ms: took() });
    onEvent({
      type: "done",
      meta: { latencyMs: Math.round(performance.now() - started), model: req.model, chunks: refs.length, tokens: 2140 },
    });
  } catch (e) {
    if (e instanceof Aborted) return;
    throw e;
  }
}
