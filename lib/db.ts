import { Redis } from "@upstash/redis";
import type { AnswerStatus, MessageSource, WebSource } from "@/lib/types";

// Supports both naming conventions: KV_REST_API_* (the original Vercel KV
// names, preserved for backward compatibility after Vercel's Dec 2024
// migration to Upstash) and UPSTASH_REDIS_REST_* (Upstash's own naming).
// Whichever pair Vercel actually injects for your integration will work.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

export const isDbConfigured = redis !== null;

const TRANSCRIPTS_INDEX_KEY = "deen-guide:transcripts-index";
const TRANSCRIPT_KEY_PREFIX = "deen-guide:transcript:";
const FEEDBACK_INDEX_KEY = "deen-guide:feedback-index";
const FEEDBACK_KEY_PREFIX = "deen-guide:feedback:";

/** A trimmed-down citation for logging — just enough to display and link to,
 * not the full SourceEntry (Arabic text, translator, etc.). */
export interface CitationSummary {
  reference: string;
  collection: string;
  url: string;
}

export interface TranscriptRecord {
  id: string;
  conversationId: string;
  question: string;
  answer: string;
  status: AnswerStatus;
  citations: CitationSummary[];
  webSources: WebSource[];
  source: MessageSource;
  createdAt: number;
}

export interface FeedbackRecord {
  messageId: string;
  conversationId: string;
  question: string;
  answer: string;
  status: AnswerStatus;
  vote: "up" | "down";
  createdAt: number;
}

function parseRecord<T>(raw: unknown): T | null {
  if (raw == null) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

/** Fire-and-forget: logging failures should never break the chat response. */
export async function logTranscript(record: TranscriptRecord): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${TRANSCRIPT_KEY_PREFIX}${record.id}`, JSON.stringify(record));
    await redis.sadd(TRANSCRIPTS_INDEX_KEY, record.id);
  } catch (err) {
    console.error("logTranscript failed:", err);
  }
}

export async function getRecentTranscripts(limit = 500): Promise<TranscriptRecord[]> {
  if (!redis) return [];
  try {
    const ids = await redis.smembers(TRANSCRIPTS_INDEX_KEY);
    if (ids.length === 0) return [];
    const raw = await redis.mget<unknown[]>(...ids.map((id) => `${TRANSCRIPT_KEY_PREFIX}${id}`));
    const records: TranscriptRecord[] = [];
    for (const r of raw) {
      const parsed = parseRecord<TranscriptRecord>(r);
      if (parsed) records.push(parsed);
    }
    records.sort((a, b) => b.createdAt - a.createdAt);
    return records.slice(0, limit);
  } catch (err) {
    console.error("getRecentTranscripts failed:", err);
    return [];
  }
}

/** All logged messages for one conversation, oldest first — for the
 * Insights "view full conversation" page. */
export async function getTranscriptsByConversation(conversationId: string): Promise<TranscriptRecord[]> {
  const all = await getRecentTranscripts(2000);
  return all.filter((t) => t.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt);
}

/** Upsert — voting again on the same message overwrites the previous vote
 * rather than accumulating duplicate records. */
export async function saveFeedback(record: FeedbackRecord): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${FEEDBACK_KEY_PREFIX}${record.messageId}`, JSON.stringify(record));
    await redis.sadd(FEEDBACK_INDEX_KEY, record.messageId);
  } catch (err) {
    console.error("saveFeedback failed:", err);
  }
}

export async function getAllFeedback(): Promise<FeedbackRecord[]> {
  if (!redis) return [];
  try {
    const ids = await redis.smembers(FEEDBACK_INDEX_KEY);
    if (ids.length === 0) return [];
    const raw = await redis.mget<unknown[]>(...ids.map((id) => `${FEEDBACK_KEY_PREFIX}${id}`));
    const records: FeedbackRecord[] = [];
    for (const r of raw) {
      const parsed = parseRecord<FeedbackRecord>(r);
      if (parsed) records.push(parsed);
    }
    return records;
  } catch (err) {
    console.error("getAllFeedback failed:", err);
    return [];
  }
}

/** Deletes one row from Insights — both its transcript entry and, if it was
 * ever rated, its feedback entry, so it disappears from the table entirely. */
export async function deleteInsightRow(id: string): Promise<void> {
  if (!redis) return;
  try {
    await Promise.all([
      redis.del(`${TRANSCRIPT_KEY_PREFIX}${id}`),
      redis.srem(TRANSCRIPTS_INDEX_KEY, id),
      redis.del(`${FEEDBACK_KEY_PREFIX}${id}`),
      redis.srem(FEEDBACK_INDEX_KEY, id),
    ]);
  } catch (err) {
    console.error("deleteInsightRow failed:", err);
  }
}
