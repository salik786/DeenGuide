"use client";

import { useEffect, useState } from "react";
import { getAllSampleQuestions, type SuggestedQuestion } from "@/lib/corpus";
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
  // Math.random() picks a different order on the server than on the client,
  // so shuffling during the initial render (even in a lazy useState
  // initializer) causes a hydration mismatch on a fresh page load — see the
  // /voice page, which (unlike client-navigated routes) always does one.
  // Starting empty and picking post-mount, same pattern as DateBadge and
  // the conversation-list hydration read, avoids that entirely.
  const [picks, setPicks] = useState<SuggestedQuestion[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicks(shuffled(getAllSampleQuestions()).slice(0, count));
  }, [count]);

  if (picks.length === 0) return null;

  return (
    <div className={className}>
      {picks.map(({ question, topicId, topicIcon }) => (
        <button
          key={`${topicId}-${question}`}
          onClick={() => onSelect(question)}
          className="flex items-start gap-1.5 rounded-2xl border border-[#145a4426] bg-[#ffffffb2] px-3 py-2 text-left text-sm text-emerald-900 transition hover:-translate-y-0.5 hover:border-[#c99a3d99] hover:bg-[#f6e9c880] hover:shadow-sm"
        >
          <TopicIcon name={topicIcon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
          {question}
        </button>
      ))}
    </div>
  );
}
