import Link from "next/link";
import { ArrowLeft, ThumbsUp, ThumbsDown, Lock, ExternalLink, Mic, Keyboard, Zap } from "lucide-react";
import { getTranscriptsByConversation, getAllFeedback, isDbConfigured } from "@/lib/db";

export const metadata = {
  title: "Conversation — Insights — Deen Guide",
};

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Not verified",
  declined: "Declined",
};

const STATUS_COLOR: Record<string, string> = {
  verified: "bg-[#1a6e531a] text-emerald-700",
  unverified: "bg-[#f59e0b26] text-amber-700",
  declined: "bg-[#dab55c33] text-gold-700",
};

const SOURCE_LABEL: Record<string, string> = {
  voice: "Voice",
  text: "Text",
  openvoice: "OpenVoice",
};

const SOURCE_COLOR: Record<string, string> = {
  voice: "bg-[#c99a3d26] text-gold-700",
  text: "bg-[#0f3d301a] text-emerald-900",
  openvoice: "bg-[#f59e0b26] text-amber-700",
};

const SOURCE_ICON: Record<string, typeof Mic> = {
  voice: Mic,
  text: Keyboard,
  openvoice: Zap,
};

function stripCitationTags(text: string): string {
  return text
    .replace(/[ \t]*\[S\d+\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ key?: string; returnTo?: string }>;
}) {
  const { conversationId } = await params;
  const { key, returnTo } = await searchParams;
  const requiredKey = process.env.INSIGHTS_KEY;
  const authorized = requiredKey ? key === requiredKey : false;
  const backHref = returnTo && returnTo.startsWith("/insights") ? returnTo : `/insights?key=${key || ""}`;

  if (!authorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#0f3d301a] bg-white p-6 text-center shadow-sm">
          <Lock className="mx-auto h-6 w-6 text-[#145a4480]" />
          <h1 className="mt-3 font-display text-xl text-emerald-950">Access key required</h1>
          <Link href="/chat" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </Link>
        </div>
      </div>
    );
  }

  if (!isDbConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <p className="text-sm text-[#0f3d3099]">Database not configured.</p>
      </div>
    );
  }

  const [messages, feedback] = await Promise.all([
    getTranscriptsByConversation(conversationId),
    getAllFeedback(),
  ]);
  const voteById = new Map(feedback.map((f) => [f.messageId, f.vote]));

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href={backHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950">
          <ArrowLeft className="h-4 w-4" />
          Back to Insights
        </Link>

        <h1 className="font-display text-2xl text-emerald-950">Conversation</h1>
        <p className="mt-1 text-xs text-[#145a4480]">{messages.length} message{messages.length === 1 ? "" : "s"}</p>

        {messages.length === 0 ? (
          <p className="mt-6 text-sm text-[#0f3d3080]">
            Nothing logged for this conversation (it may have been deleted, or predates logging).
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {messages.map((m) => {
              const vote = voteById.get(m.id);
              return (
                <div key={m.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-800 px-4 py-2.5 text-sm text-white">
                      {m.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-[#0f3d301a] bg-white px-4 py-3 text-sm shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[m.status]}`}>
                          {STATUS_LABEL[m.status]}
                        </span>
                        {(() => {
                          const src = m.source || "text";
                          const SourceIcon = SOURCE_ICON[src];
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_COLOR[src]}`}
                            >
                              <SourceIcon className="h-3 w-3" />
                              {SOURCE_LABEL[src]}
                            </span>
                          );
                        })()}
                        {vote === "up" && <ThumbsUp className="h-3.5 w-3.5 text-emerald-700" fill="currentColor" />}
                        {vote === "down" && <ThumbsDown className="h-3.5 w-3.5 text-red-700" fill="currentColor" />}
                        <span className="text-xs text-[#145a4466]">{formatTime(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-emerald-950">{stripCitationTags(m.answer)}</p>
                      {(m.citations?.length > 0 || m.webSources?.length > 0) && (
                        <div className="mt-3 space-y-1 border-t border-[#0f3d301a] pt-2">
                          {m.citations?.map((c, i) => (
                            <a
                              key={`c${i}`}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {c.collection} — {c.reference}
                            </a>
                          ))}
                          {m.webSources?.map((w, i) => (
                            <a
                              key={`w${i}`}
                              href={w.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-amber-700 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {w.title || w.url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
