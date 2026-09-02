import { ExternalLink, BookOpen, ScrollText } from "lucide-react";
import type { Citation } from "@/lib/types";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-emerald-900/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">
        Sources
      </p>
      {citations.map((c) => (
        <a
          key={c.tag}
          href={c.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-2 rounded-lg border border-emerald-900/10 bg-emerald-50/70 px-3 py-2 text-xs transition hover:-translate-y-0.5 hover:border-gold-500/50 hover:bg-gold-100/40 hover:shadow-sm"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-800/10 text-emerald-700 transition-colors group-hover:bg-gold-500/20 group-hover:text-gold-700">
            {c.source.type === "quran" ? (
              <BookOpen className="h-3 w-3" />
            ) : (
              <ScrollText className="h-3 w-3" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-emerald-900">
              {c.source.collection} — {c.source.reference}
            </span>
            {c.source.narrator && (
              <span className="block text-emerald-800/60">Narrated by {c.source.narrator}</span>
            )}
            <span className="mt-0.5 block text-emerald-800/50">{c.source.sourceSite}</span>
          </span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700/50" />
        </a>
      ))}
    </div>
  );
}
