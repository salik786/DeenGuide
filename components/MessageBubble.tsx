"use client";

import { Fragment, useState } from "react";
import {
  Volume2,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ShieldQuestion,
  Globe,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { ChatMessage, WebSource, Vote } from "@/lib/types";
import { CitationList } from "@/components/CitationCard";
import { SuggestionChips } from "@/components/SuggestionChips";

function stripCitationTags(text: string): string {
  return text
    .replace(/[ \t]*\[S\d+\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Renders **bold** spans inline; everything else is plain text. Parses into
 * React nodes rather than dangerouslySetInnerHTML, so there's no HTML
 * injection risk even though the source is our own API response. */
function renderInline(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const NUMBERED_LINE = /^(\d+)\.\s+(.*)$/;
const BULLET_LINE = /^[-*]\s+(.*)$/;

/** Splits the model's plain-text reply into paragraphs and numbered/bulleted
 * lists, rendering each with proper spacing instead of one flat text block. */
function FormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, blockIdx) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const numberedMatches = lines.map((l) => l.match(NUMBERED_LINE));
        const bulletMatches = lines.map((l) => l.match(BULLET_LINE));

        if (lines.length > 0 && numberedMatches.every(Boolean)) {
          return (
            <ol key={blockIdx} className="list-none space-y-1.5">
              {numberedMatches.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-emerald-700">{m![1]}.</span>
                  <span>{renderInline(m![2])}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (lines.length > 0 && bulletMatches.every(Boolean)) {
          return (
            <ul key={blockIdx} className="list-none space-y-1.5">
              {bulletMatches.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-gold-600">•</span>
                  <span>{renderInline(m![1])}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIdx} className="leading-relaxed">
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const CARD_STYLES = {
  verified: "border-y-emerald-900/10 border-r-emerald-900/10 border-l-gold-400 bg-white text-emerald-950",
  unverified: "border-y-amber-300/60 border-r-amber-300/60 border-l-amber-500 bg-amber-50 text-emerald-950",
  declined: "border-y-gold-400/40 border-r-gold-400/40 border-l-gold-500 bg-gold-100/50 text-emerald-900",
};

function WebSourceList({ sources }: { sources: WebSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-amber-400/30 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700/70">
        Checked while answering
      </p>
      {sources.map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-100/40 px-3 py-1.5 text-xs transition hover:border-amber-500/60 hover:bg-amber-100"
        >
          <Globe className="h-3 w-3 shrink-0 text-amber-700" />
          <span className="min-w-0 flex-1 truncate text-amber-900">{s.title || s.url}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-amber-700/50" />
        </a>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: "verified" | "unverified" }) {
  if (status === "verified") {
    return (
      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-700/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </span>
    );
  }
  return (
    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      <ShieldQuestion className="h-3 w-3" />
      Not verified — consult a scholar
    </span>
  );
}

function VoteButtons({ vote, onVote }: { vote?: Vote; onVote: (vote: Vote) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onVote("up")}
        title="Helpful"
        className={`rounded-lg p-1 transition ${
          vote === "up" ? "bg-emerald-700/15 text-emerald-700" : "text-emerald-700/50 hover:bg-emerald-700/10 hover:text-emerald-700"
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" fill={vote === "up" ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => onVote("down")}
        title="Not helpful"
        className={`rounded-lg p-1 transition ${
          vote === "down" ? "bg-red-700/10 text-red-700" : "text-emerald-700/50 hover:bg-red-700/10 hover:text-red-700"
        }`}
      >
        <ThumbsDown className="h-3.5 w-3.5" fill={vote === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function MessageBubble({
  message,
  onSuggestedQuestion,
  onVote,
}: {
  message: ChatMessage;
  onSuggestedQuestion?: (question: string) => void;
  onVote?: (vote: Vote) => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const isUser = message.role === "user";
  const status = message.status ?? "verified";

  async function handleSpeak() {
    if (speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: stripCitationTags(message.content) }),
      });
      if (!res.ok) throw new Error("speak failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  }

  if (isUser) {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-800 px-4 py-2.5 text-sm text-white shadow-sm sm:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-in flex justify-start">
      <div
        className={`max-w-[90%] rounded-2xl rounded-tl-sm border-y border-r border-l-[3px] px-4 py-3 text-sm shadow-sm sm:max-w-[75%] ${CARD_STYLES[status]}`}
      >
        {(status === "verified" || status === "unverified") && <StatusBadge status={status} />}
        <div className="flex items-start gap-2">
          {status === "declined" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />}
          <div className="min-w-0 flex-1">
            <FormattedText text={stripCitationTags(message.content)} />
          </div>
        </div>
        {message.citations && message.citations.length > 0 && (
          <CitationList citations={message.citations} />
        )}
        {status === "unverified" && message.webSources && message.webSources.length > 0 && (
          <WebSourceList sources={message.webSources} />
        )}
        {status === "declined" && onSuggestedQuestion && (
          <div className="mt-3 border-t border-gold-400/30 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-800/60">
              Things I can help with
            </p>
            <SuggestionChips onSelect={onSuggestedQuestion} className="flex flex-wrap gap-1.5" />
          </div>
        )}
        {(status !== "declined" || onVote) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {status !== "declined" ? (
              <button
                onClick={handleSpeak}
                disabled={speaking}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700/70 transition hover:text-emerald-900 disabled:opacity-60"
              >
                {speaking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                {speaking ? "Playing…" : "Listen"}
              </button>
            ) : (
              <span />
            )}
            {onVote && <VoteButtons vote={message.vote} onVote={onVote} />}
          </div>
        )}
      </div>
    </div>
  );
}
