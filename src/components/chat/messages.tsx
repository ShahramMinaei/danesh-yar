"use client";

import { ArrowsClockwise, Brain, CaretDown, Copy, Lightning, ThumbsDown, ThumbsUp, User, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { answerPlainText } from "@/lib/answer";
import { cx, enNum, seconds } from "@/lib/format";
import { copyText, type Breakpoint } from "@/lib/hooks";
import type { AssistantMessage, UserMessage } from "@/lib/types";
import { useStore } from "@/state/store";
import { EvidenceScope } from "../features/evidence/evidence-scope";
import { TrustSummary } from "../features/grounding/trust-summary";
import { PendingRefs } from "../features/retrieval/pending-refs";
import { StoppedRow } from "../features/stream/stopped-row";
import { Button, IconButton } from "../ui/button";
import { AnswerBody } from "./answer-body";
import { AttachmentChips } from "./attachments";
import { Pipeline, PipelineSummary } from "./pipeline";
import { RetrievedRefs } from "./retrieved-refs";

export function UserBubble({ message, bp }: { message: UserMessage; bp: Breakpoint }) {
  return (
    <div className="flex justify-start gap-2.5 max-lg:gap-[9px]">
      {bp !== "mobile" && (
        <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-chip text-[14px] text-fg/55 max-lg:size-[26px] max-lg:text-[13px]">
          <User />
        </div>
      )}
      <div
        className={cx(
          "rounded-[12px_4px_12px_12px] bg-surface ring-1 ring-inset ring-fg/9",
          bp === "desktop" ? "max-w-[620px] px-[15px] py-3" : bp === "tablet" ? "max-w-[74%] px-[13px] py-[11px]" : "max-w-[86%] px-3 py-2.5",
        )}
      >
        {message.attachments && <AttachmentChips items={message.attachments} className="mb-2" />}
        <div className={cx("leading-[1.8] whitespace-pre-wrap", bp === "desktop" ? "text-[14px]" : "text-[13.5px]")}>{message.text}</div>
        {bp === "desktop" && (
          <div className="mt-[7px] flex items-center gap-2 text-[10px] text-fg/35">
            <span className="ltr">{message.time}</span>
            <span className="opacity-50">·</span>
            <span>{message.filterLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantAvatar({ error }: { error?: boolean }) {
  return (
    <div
      className={cx(
        "grid size-7 shrink-0 place-items-center rounded-[8px] text-[15px] ring-1 ring-inset max-lg:size-[26px] max-lg:text-[14px]",
        error ? "bg-error/12 text-error ring-error/40" : "bg-accent-bg text-accent-hi ring-accent-line",
      )}
    >
      {error ? <Warning /> : <Brain />}
    </div>
  );
}

function ErrorCard({ message }: { message: AssistantMessage }) {
  const { regenerate, state } = useStore();
  const [details, setDetails] = useState(false);
  const err = message.error!;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[10px] bg-error/6 p-4 ring-1 ring-inset ring-error/30 max-md:p-3.5">
      <div>
        <div className="mb-[5px] text-[15px] font-semibold text-fg max-md:text-[14px]">{err.title}</div>
        <div className="text-[13px] leading-[1.85] text-fg/65">{err.message}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          className="h-8 px-3 text-[12.5px]"
          icon={<ArrowsClockwise className="text-[14px]" />}
          onClick={() => regenerate(message.id)}
        >
          تلاش مجدد
        </Button>
        {state.scope !== "quick" && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-3 text-[12.5px]"
            icon={<Lightning className="text-[14px]" />}
            onClick={() => regenerate(message.id, "quick")}
          >
            جستجوی سریع
          </Button>
        )}
        <button
          onClick={() => setDetails((d) => !d)}
          aria-expanded={details}
          className="inline-flex h-8 items-center gap-[5px] rounded-[8px] px-2 text-[12px] font-medium text-fg/50 hover:text-fg/75"
        >
          <CaretDown className={cx("text-[12px] transition-transform", details && "rotate-180")} />
          جزئیات فنی
        </button>
      </div>
      {details && (
        <pre className="m-0 overflow-auto rounded-[8px] bg-sunken px-3 py-[11px] text-left font-mono text-[11.5px] leading-[1.7] text-fg/55 ltr">
          {err.details}
        </pre>
      )}
    </div>
  );
}

function Actions({ message, bp }: { message: AssistantMessage; bp: Breakpoint }) {
  const { regenerate, setFeedback, toast } = useStore();
  const copy = async () => {
    const ok = await copyText(answerPlainText(message.blocks));
    toast(ok ? "success" : "error", ok ? "پاسخ در حافظه کپی شد" : "کپی ناموفق بود");
  };
  const meta = message.meta;
  // stopped before any text arrived: nothing to copy
  const canCopy = message.blocks.length > 0;

  if (bp === "mobile") {
    return (
      <div className="flex gap-1.5">
        {canCopy && (
          <Button size="touch" className="flex-1" icon={<Copy className="text-[15px]" />} onClick={copy}>
            کپی
          </Button>
        )}
        <Button size="touch" className="flex-1" icon={<ArrowsClockwise className="text-[15px]" />} onClick={() => regenerate(message.id)}>
          تولید مجدد
        </Button>
        <IconButton
          label="پاسخ مفید بود"
          size={44}
          active={message.feedback === "up"}
          onClick={() => setFeedback(message.id, "up")}
          className="text-[16px]"
        >
          <ThumbsUp weight={message.feedback === "up" ? "fill" : "regular"} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-1 max-lg:gap-1.5 max-lg:pt-0">
      <div className="flex items-center gap-1.5">
        {canCopy && (
          <Button size="sm" className="font-medium text-fg/70 max-lg:h-[29px] max-lg:px-[9px] max-lg:text-[11.5px]" icon={<Copy className="text-[14px]" />} onClick={copy}>
            کپی
          </Button>
        )}
        <Button
          size="sm"
          className="font-medium text-fg/70 max-lg:h-[29px] max-lg:px-[9px] max-lg:text-[11.5px]"
          icon={<ArrowsClockwise className="text-[14px]" />}
          onClick={() => regenerate(message.id)}
        >
          تولید مجدد
        </Button>
        {bp === "desktop" && (
          <>
            <span className="mx-1 h-[18px] w-px bg-fg/10" />
            <button
              aria-label="پاسخ مفید بود"
              aria-pressed={message.feedback === "up"}
              onClick={() => setFeedback(message.id, "up")}
              className={cx(
                "grid size-[30px] place-items-center rounded-[8px] text-[15px] transition-colors",
                message.feedback === "up" ? "bg-success/10 text-success" : "text-fg/45 hover:bg-success/10 hover:text-success",
              )}
            >
              <ThumbsUp weight={message.feedback === "up" ? "fill" : "regular"} />
            </button>
            <button
              aria-label="پاسخ مفید نبود"
              aria-pressed={message.feedback === "down"}
              onClick={() => setFeedback(message.id, "down")}
              className={cx(
                "grid size-[30px] place-items-center rounded-[8px] text-[15px] transition-colors",
                message.feedback === "down" ? "bg-error/10 text-error" : "text-fg/45 hover:bg-error/10 hover:text-error",
              )}
            >
              <ThumbsDown weight={message.feedback === "down" ? "fill" : "regular"} />
            </button>
          </>
        )}
      </div>
      {meta && (
        <div className="flex items-center gap-[9px] font-mono text-[11px] text-fg/35 ltr max-lg:text-[10px] max-lg:text-fg/30">
          <span>{seconds(meta.latencyMs)}</span>
          <span className="opacity-50">·</span>
          <span>{meta.model}</span>
          {bp === "desktop" && (
            <>
              <span className="opacity-50">·</span>
              <span>{meta.chunks} chunks</span>
              <span className="opacity-50">·</span>
              <span>{enNum(meta.tokens)} tok</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AssistantTurn({ message, bp }: { message: AssistantMessage; bp: Breakpoint }) {
  const streaming = message.status === "streaming";
  const error = message.status === "error";
  const siblings = message.refs.map((r) => r.id);

  const body = (
    <EvidenceScope
      message={message}
      bp={bp}
      className={cx("flex min-w-0 flex-1 flex-col", bp === "desktop" ? "gap-3.5" : bp === "tablet" ? "gap-3" : "gap-[11px]")}
    >
      {bp === "desktop" ? (
        <Pipeline steps={message.steps} live={message.status !== "done"} />
      ) : (
        <PipelineSummary steps={message.steps} latencyMs={message.meta?.latencyMs} refsCount={message.refs.length} mobile={bp === "mobile"} />
      )}

      {message.refs.length > 0 ? (
        <RetrievedRefs refs={message.refs} layout={bp === "desktop" ? "grid" : "scroll"} />
      ) : (
        <PendingRefs steps={message.steps} layout={bp === "desktop" ? "grid" : "scroll"} />
      )}

      {error ? (
        <>
          <ErrorCard message={message} />
          <div className="font-mono text-[11px] text-fg/30 ltr">{message.error!.footer}</div>
        </>
      ) : (
        <>
          {(message.blocks.length > 0 || streaming) && (
            <AnswerBody blocks={message.blocks} reveal={message.reveal} streaming={streaming} siblings={siblings} stopped={message.stopped} />
          )}
          {streaming ? (
            <div className="flex items-center gap-[9px] font-mono text-[11px] text-fg/35 ltr" aria-live="off">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-accent" />
              {message.blocks.length ? "streaming" : "processing"} · {message.stream.tokens} tok · {seconds(message.stream.elapsedMs)}
            </div>
          ) : (
            <>
              {message.status === "done" && !message.stopped && message.blocks.length > 0 && (
                <TrustSummary message={message} bp={bp} />
              )}
              {message.stopped && <StoppedRow message={message} bp={bp} />}
              <Actions message={message} bp={bp} />
            </>
          )}
        </>
      )}
    </EvidenceScope>
  );

  if (bp === "mobile") return body;
  return (
    <div className={cx("flex", bp === "desktop" ? "gap-3" : "gap-2.5")}>
      <AssistantAvatar error={error} />
      {body}
    </div>
  );
}
