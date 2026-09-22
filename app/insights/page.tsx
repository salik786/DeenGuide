import Link from "next/link";
import { ArrowLeft, ThumbsUp, ThumbsDown, Lock, Eye, Trash2, Mic, Keyboard, Zap } from "lucide-react";
import { getRecentTranscripts, getAllFeedback, isDbConfigured } from "@/lib/db";
import { InsightsFilters } from "@/components/InsightsFilters";
import { ExportButtons } from "@/components/ExportButtons";
import { filterInsightsRows } from "@/lib/insightsFilter";
import { now } from "@/lib/storage";

export const metadata = {
  title: "Insights — Deen Guide",
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

const PAGE_SIZE = 20;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SearchParams = {
  key?: string;
  status?: string;
  vote?: string;
  date?: string;
  source?: string;
  page?: string;
};

function buildHref(params: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, v);
  }
  return `/insights?${qs.toString()}`;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requiredKey = process.env.INSIGHTS_KEY;
  const authorized = requiredKey ? params.key === requiredKey : false;

  if (!authorized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#0f3d301a] bg-white p-6 text-center shadow-sm">
          <Lock className="mx-auto h-6 w-6 text-[#145a4480]" />
          <h1 className="mt-3 font-display text-xl text-emerald-950">Access key required</h1>
          <p className="mt-2 text-sm text-[#0f3d3099]">
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
        <div className="w-full max-w-sm rounded-2xl border border-[#0f3d301a] bg-white p-6 text-center shadow-sm">
          <h1 className="font-display text-xl text-emerald-950">Database not configured</h1>
          <p className="mt-2 text-sm text-[#0f3d3099]">
            Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_* names)
            in .env.local, then restart the server.
          </p>
        </div>
      </div>
    );
  }

  const [transcripts, feedback] = await Promise.all([getRecentTranscripts(500), getAllFeedback()]);
  const voteById = new Map(feedback.map((f) => [f.messageId, f.vote]));
  const upCount = feedback.filter((f) => f.vote === "up").length;
  const downCount = feedback.filter((f) => f.vote === "down").length;

  const rows = transcripts.map((t) => ({ ...t, vote: voteById.get(t.id) }));

  const statusFilter = params.status || "all";
  const voteFilter = params.vote || "all";
  const dateFilter = params.date || "all";
  const sourceFilter = params.source || "all";

  const filtered = filterInsightsRows(rows, params, now());

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const currentUrl = buildHref(params, { page: String(currentPage) });

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/chat" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950">
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>

        <h1 className="font-display text-3xl text-emerald-950">Insights</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#0f3d30b2]">
          Every question asked and every 👍/👎 rating, across everyone using this deployment —
          not just your own browser. Keep this link private.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex items-center gap-1 rounded-full bg-[#1a6e531a] px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <ThumbsUp className="h-3.5 w-3.5" /> {upCount}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-[#b91c1c1a] px-2.5 py-1 text-xs font-semibold text-red-700">
            <ThumbsDown className="h-3.5 w-3.5" /> {downCount}
          </span>
          <span className="text-xs text-[#145a4480]">
            {filtered.length} of {rows.length} logged questions match these filters
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <InsightsFilters
            accessKey={params.key || ""}
            status={statusFilter}
            vote={voteFilter}
            date={dateFilter}
            source={sourceFilter}
          />
          <ExportButtons
            accessKey={params.key || ""}
            status={statusFilter}
            vote={voteFilter}
            date={dateFilter}
            source={sourceFilter}
          />
        </div>

        {pageRows.length === 0 ? (
          <div className="rounded-xl border border-[#0f3d301a] bg-white px-4 py-6 text-center">
            <p className="text-sm text-[#0f3d3099]">
              {rows.length === 0
                ? "Nothing logged yet. Questions will appear here as people use the assistant."
                : "No questions match these filters."}
            </p>
            {rows.length > 0 && (
              <Link href={`/insights?key=${params.key || ""}`} className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#0f3d301a] bg-white">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#0f3d301a] bg-[#f0f8f399] text-left text-xs uppercase tracking-wide text-[#145a4499]">
                  <th className="w-36 px-3 py-2.5 font-semibold">Date</th>
                  <th className="w-28 px-3 py-2.5 font-semibold">Status</th>
                  <th className="w-20 px-3 py-2.5 font-semibold">Source</th>
                  <th className="w-16 px-3 py-2.5 font-semibold">Vote</th>
                  <th className="px-3 py-2.5 font-semibold">Question</th>
                  <th className="w-24 px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-[#0f3d300d] align-top last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#145a4480]">{formatTime(r.createdAt)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const src = r.source || "text";
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
                    </td>
                    <td className="px-3 py-3">
                      {r.vote === "up" && <ThumbsUp className="h-4 w-4 text-emerald-700" fill="currentColor" />}
                      {r.vote === "down" && <ThumbsDown className="h-4 w-4 text-red-700" fill="currentColor" />}
                      {!r.vote && <span className="text-[#145a444c]">—</span>}
                    </td>
                    <td className="px-3 py-3 font-medium text-emerald-950">{r.question}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/insights/conversation/${r.conversationId}?key=${params.key}&returnTo=${encodeURIComponent(currentUrl)}`}
                          title="View full conversation"
                          className="rounded-lg p-1.5 text-emerald-700 transition hover:bg-[#1a6e531a]"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <form action="/api/insights/delete" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="key" value={params.key} />
                          <input type="hidden" name="returnTo" value={currentUrl} />
                          <button type="submit" title="Delete this row" className="rounded-lg p-1.5 text-[#dc2626b2] transition hover:bg-[#dc26261a] hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              href={buildHref(params, { page: String(Math.max(1, currentPage - 1)) })}
              aria-disabled={currentPage <= 1}
              className={`rounded-lg border border-[#0f3d3026] px-3 py-1.5 ${
                currentPage <= 1 ? "pointer-events-none opacity-40" : "text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              ← Previous
            </Link>
            <span className="text-[#145a4499]">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={buildHref(params, { page: String(Math.min(totalPages, currentPage + 1)) })}
              aria-disabled={currentPage >= totalPages}
              className={`rounded-lg border border-[#0f3d3026] px-3 py-1.5 ${
                currentPage >= totalPages ? "pointer-events-none opacity-40" : "text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
