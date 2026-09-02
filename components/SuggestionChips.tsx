"use client";

import { useState } from "react";
import { getAllSampleQuestions } from "@/lib/corpus";
import { TopicIcon } from "@/components/icons";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function SuggestionChips({
  onSelect,
  className = "flex flex-wrap gap-2",
  count = 4,
}: {
  onSelect: (question: string) => void;
  className?: string;
  count?: number;
}) {
  // Picked once per mount (e.g. once per refusal message, since each gets
  // its own component instance) so it doesn't reshuffle on re-render.
  const [picks] = useState(() => shuffled(getAllSampleQuestions()).slice(0, count));

  return (
    <div className={className}>
      {picks.map(({ question, topicId, topicIcon }) => (
        <button
          key={`${topicId}-${question}`}
          onClick={() => onSelect(question)}
          className="flex items-start gap-1.5 rounded-2xl border border-emerald-800/15 bg-white/70 px-3 py-2 text-left text-sm text-emerald-900 transition hover:-translate-y-0.5 hover:border-gold-500/60 hover:bg-gold-100/50 hover:shadow-sm"
        >
          <TopicIcon name={topicIcon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
          {question}
        </button>
      ))}
    </div>
  );
}
