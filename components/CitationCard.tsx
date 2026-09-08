import { ExternalLink, BookOpen, ScrollText } from "lucide-react";
import type { Citation } from "@/lib/types";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-[#0f3d301a] pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a6e53b2]">
        Sources
      </p>
      {citations.map((c) => (
        <a
          key={c.tag}
          href={c.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-2 rounded-lg border border-[#0f3d301a] bg-[#f0f8f3b2] px-3 py-2 text-xs transition hover:-translate-y-0.5 hover:border-[#c99a3d80] hover:bg-[#f6e9c866] hover:shadow-sm"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#145a441a] text-emerald-700 transition-colors group-hover:bg-[#c99a3d33] group-hover:text-gold-700">
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
              <span className="block text-[#145a4499]">Narrated by {c.source.narrator}</span>
            )}
            <span className="mt-0.5 block text-[#145a4480]">{c.source.sourceSite}</span>
          </span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[#1a6e5380]" />
        </a>
      ))}
    </div>
  );
}
