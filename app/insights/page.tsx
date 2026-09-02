import Link from "next/link";
import { ArrowLeft, ThumbsUp, ThumbsDown, Lock } from "lucide-react";
import { getRecentTranscripts, getAllFeedback, isDbConfigured } from "@/lib/db";

export const metadata = {
  title: "Insights — Deen Guide",
};

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Not verified",
  declined: "Declined",
};

const STATUS_COLOR: Record<string, string> = {
  verified: "bg-emerald-700/10 text-emerald-700",
  unverified: "bg-amber-500/15 text-amber-700",
  declined: "bg-gold-400/20 text-gold-700",
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
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const requiredKey = process.env.INSIGHTS_KEY;
  const authorized = requiredKey ? key === requiredKey : false;

  if (!authorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm rounded-2xl border border-emerald-900/10 bg-white p-6 text-center shadow-sm">
          <Lock className="mx-auto h-6 w-6 text-emerald-800/50" />
          <h1 className="mt-3 font-display text-xl text-emerald-950">Access key required</h1>
          <p className="mt-2 text-sm text-emerald-900/60">
            {requiredKey
              ? "Add ?key=... to the URL with the access key from .env.local (INSIGHTS_KEY)."
              : "INSIGHTS_KEY isn't set in .env.local yet, so this page can't be unlocked."}
          </p>
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
        <div className="w-full max-w-sm rounded-2xl border border-emerald-900/10 bg-white p-6 text-center shadow-sm">
          <h1 className="font-display text-xl text-emerald-950">Database not configured</h1>
          <p className="mt-2 text-sm text-emerald-900/60">
            Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_* names)
            in .env.local, then restart the server.
          </p>
        </div>
      </div>
    );
  }

  const [transcripts, feedback] = await Promise.all([getRecentTranscripts(300), getAllFeedback()]);
  const upCount = feedback.filter((f) => f.vote === "up").length;
  const downCount = feedback.filter((f) => f.vote === "down").length;
  const sortedFeedback = [...feedback].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/chat" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950">
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>

        <h1 className="font-display text-3xl text-emerald-950">Insights</h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-900/70">
          Every question asked and every 👍/👎 rating, across everyone using this deployment —
          not just your own browser. Keep this link private.
        </p>

        <section className="mt-8">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="font-display text-xl text-emerald-950">Feedback</h2>
            <span className="flex items-center gap-1 rounded-full bg-emerald-700/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <ThumbsUp className="h-3.5 w-3.5" /> {upCount}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-red-700/10 px-2.5 py-1 text-xs font-semibold text-red-700">
              <ThumbsDown className="h-3.5 w-3.5" /> {downCount}
            </span>
          </div>

          {sortedFeedback.length === 0 ? (
            <p className="text-sm text-emerald-900/50">No feedback yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedFeedback.map((f) => (
                <div key={f.messageId} className="rounded-xl border border-emerald-900/10 bg-white p-4 text-sm">
                  <div className="mb-1.5 flex items-center gap-2">
                    {f.vote === "up" ? (
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-700" fill="currentColor" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5 text-red-700" fill="currentColor" />
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                    <span className="text-xs text-emerald-800/40">{formatTime(f.createdAt)}</span>
                  </div>
                  <p className="font-medium text-emerald-950">{f.question}</p>
                  <p className="mt-1 line-clamp-3 text-emerald-900/70">{stripCitationTags(f.answer)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl text-emerald-950">
            All questions <span className="text-sm font-sans font-normal text-emerald-800/50">(most recent {transcripts.length})</span>
          </h2>
          {transcripts.length === 0 ? (
            <p className="text-sm text-emerald-900/50">Nothing logged yet.</p>
          ) : (
            <div className="space-y-3">
              {transcripts.map((t) => (
                <div key={t.id} className="rounded-xl border border-emerald-900/10 bg-white p-4 text-sm">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    {t.citationCount > 0 && (
                      <span className="text-xs text-emerald-800/40">{t.citationCount} citation{t.citationCount > 1 ? "s" : ""}</span>
                    )}
                    {t.webSourceCount > 0 && (
                      <span className="text-xs text-amber-700/60">{t.webSourceCount} web source{t.webSourceCount > 1 ? "s" : ""}</span>
                    )}
                    <span className="text-xs text-emerald-800/40">{formatTime(t.createdAt)}</span>
                  </div>
                  <p className="font-medium text-emerald-950">{t.question}</p>
                  <p className="mt-1 line-clamp-2 text-emerald-900/70">{stripCitationTags(t.answer)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
