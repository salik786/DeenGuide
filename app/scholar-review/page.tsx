import Link from "next/link";
import { ArrowLeft, ExternalLink, BookOpen, ScrollText } from "lucide-react";
import { getAllTopicsWithCorpus } from "@/lib/corpus";
import { TopicIcon } from "@/components/icons";

export const metadata = {
  title: "Scholar Review — Deen Guide",
};

export default function ScholarReviewPage() {
  const data = getAllTopicsWithCorpus();

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>

        <h1 className="font-display text-3xl text-emerald-950">Scholar Review</h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-900/70">
          This is the complete, fixed set of sources the assistant is allowed to draw from — one
          list per topic. The assistant cannot answer with anything outside of what is quoted
          here verbatim. Please review each entry for accuracy before this goes live, and flag
          anything that needs correcting, more nuance, or removal.
        </p>

        <div className="mt-8 space-y-10">
          {data.map(({ topic, sources }) => (
            <section key={topic.id}>
              <div className="flex items-center gap-2 border-b border-gold-500/30 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-800 text-gold-100">
                  <TopicIcon name={topic.icon} className="h-4 w-4" />
                </span>
                <h2 className="font-display text-xl text-emerald-950">{topic.name}</h2>
                <span className="text-xs text-emerald-800/50">({sources.length} sources)</span>
              </div>

              <div className="mt-3 space-y-3">
                {sources.map((s) => (
                  <div key={s.id} className="rounded-xl border border-emerald-900/10 bg-white p-4 text-sm">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-800/70">
                      {s.type === "quran" ? (
                        <BookOpen className="h-3.5 w-3.5" />
                      ) : (
                        <ScrollText className="h-3.5 w-3.5" />
                      )}
                      {s.collection} — {s.reference}
                      {s.inBookReference && <span className="font-normal text-emerald-800/40">({s.inBookReference})</span>}
                    </div>
                    {s.narrator && (
                      <p className="mb-1 text-xs text-emerald-800/60">Narrated by {s.narrator}</p>
                    )}
                    {s.arabic && (
                      <p dir="rtl" className="font-arabic mb-2 text-lg leading-relaxed text-emerald-950">
                        {s.arabic}
                      </p>
                    )}
                    <p className="leading-relaxed text-emerald-900">&ldquo;{s.translation}&rdquo;</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-emerald-800/50">
                      <span>Translator: {s.translator}</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-950"
                      >
                        Verify on {s.sourceSite} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
