import { Redis } from "@upstash/redis";
import type { AnswerStatus } from "@/lib/types";

// Supports both naming conventions: KV_REST_API_* (the original Vercel KV
// names, preserved for backward compatibility after Vercel's Dec 2024
// migration to Upstash) and UPSTASH_REDIS_REST_* (Upstash's own naming).
// Whichever pair Vercel actually injects for your integration will work.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

export const isDbConfigured = redis !== null;

const TRANSCRIPTS_KEY = "deen-guide:transcripts";
const FEEDBACK_INDEX_KEY = "deen-guide:feedback-index";
const FEEDBACK_KEY_PREFIX = "deen-guide:feedback:";
const MAX_TRANSCRIPTS = 1000;

export interface TranscriptRecord {
  id: string;
  conversationId: string;
  question: string;
  answer: string;
  status: AnswerStatus;
  citationCount: number;
  webSourceCount: number;
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

/** Fire-and-forget: logging failures should never break the chat response. */
export async function logTranscript(record: TranscriptRecord): Promise<void> {
  if (!redis) return;
  try {
    await redis.lpush(TRANSCRIPTS_KEY, JSON.stringify(record));
    await redis.ltrim(TRANSCRIPTS_KEY, 0, MAX_TRANSCRIPTS - 1);
  } catch (err) {
    console.error("logTranscript failed:", err);
  }
}

export async function getRecentTranscripts(limit = 200): Promise<TranscriptRecord[]> {
  if (!redis) return [];
  try {
    const raw = await redis.lrange(TRANSCRIPTS_KEY, 0, limit - 1);
    return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r)) as TranscriptRecord[];
  } catch (err) {
    console.error("getRecentTranscripts failed:", err);
    return [];
  }
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
    // The Upstash client auto-deserializes JSON strings on read, so entries
    // may already be objects rather than raw strings — handle both.
    const raw = await redis.mget<unknown[]>(...ids.map((id) => `${FEEDBACK_KEY_PREFIX}${id}`));
    const records: FeedbackRecord[] = [];
    for (const r of raw) {
      if (r == null) continue;
      records.push(typeof r === "string" ? JSON.parse(r) : (r as FeedbackRecord));
    }
    return records;
  } catch (err) {
    console.error("getAllFeedback failed:", err);
    return [];
  }
}
