import type { Topic } from "@/lib/types";
import { TopicIcon } from "@/components/icons";

export function TopicPicker({
  topics,
  onSelect,
}: {
  topics: Topic[];
  onSelect: (topicId: string) => void;
}) {
  return (
    <div className="stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2">
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onSelect(topic.id)}
          className="card-ornate group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-5 text-left shadow-sm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-gold-100 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <TopicIcon name={topic.icon} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg text-emerald-950">{topic.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-emerald-900/65">{topic.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
