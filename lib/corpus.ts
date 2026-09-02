import topicsData from "@/data/topics.json";
import fivePillars from "@/data/corpus/five-pillars.json";
import prayerWudu from "@/data/corpus/prayer-wudu.json";
import ramadanFasting from "@/data/corpus/ramadan-fasting.json";
import prophetMuhammad from "@/data/corpus/prophet-muhammad.json";
import quranBasics from "@/data/corpus/quran-basics.json";
import akhlaqManners from "@/data/corpus/akhlaq-manners.json";
import type { SourceEntry, Topic } from "@/lib/types";

const CORPUS_BY_TOPIC: Record<string, SourceEntry[]> = {
  "five-pillars": fivePillars as SourceEntry[],
  "prayer-wudu": prayerWudu as SourceEntry[],
  "ramadan-fasting": ramadanFasting as SourceEntry[],
  "prophet-muhammad": prophetMuhammad as SourceEntry[],
  "quran-basics": quranBasics as SourceEntry[],
  "akhlaq-manners": akhlaqManners as SourceEntry[],
};

export const TOPICS: Topic[] = topicsData as Topic[];

export function getTopic(topicId: string): Topic | undefined {
  return TOPICS.find((t) => t.id === topicId);
}

export function getCorpusForTopic(topicId: string): SourceEntry[] {
  return CORPUS_BY_TOPIC[topicId] ?? [];
}

export function getSourceById(topicId: string, sourceId: string): SourceEntry | undefined {
  return getCorpusForTopic(topicId).find((s) => s.id === sourceId);
}

export function getAllTopicsWithCorpus(): { topic: Topic; sources: SourceEntry[] }[] {
  return TOPICS.map((topic) => ({ topic, sources: getCorpusForTopic(topic.id) }));
}

/** All sources across all topics, deduplicated by id (a few sources — e.g. the
 * revelation hadith — are cross-referenced under more than one topic). */
export function getFullCorpus(): SourceEntry[] {
  const seen = new Map<string, SourceEntry>();
  for (const topic of TOPICS) {
    for (const source of getCorpusForTopic(topic.id)) {
      if (!seen.has(source.id)) seen.set(source.id, source);
    }
  }
  return Array.from(seen.values());
}

export interface SuggestedQuestion {
  question: string;
  topicId: string;
  topicIcon: string;
}

/** Every sample question across every topic — each one has been verified to
 * get a real, cited answer from the corpus (see scripts/verify-questions.mjs
 * or re-check manually whenever a question is added here). Used as the pool
 * suggestion chips are randomly drawn from. */
export function getAllSampleQuestions(): SuggestedQuestion[] {
  return TOPICS.flatMap((topic) =>
    topic.sampleQuestions.map((question) => ({
      question,
      topicId: topic.id,
      topicIcon: topic.icon,
    })),
  );
}
