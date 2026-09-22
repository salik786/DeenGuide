import type { TranscriptRecord } from "@/lib/db";
import type { Vote } from "@/lib/types";

export interface InsightsRow extends TranscriptRecord {
  vote?: Vote;
}

export interface InsightsFilterParams {
  status?: string;
  vote?: string;
  date?: string;
  source?: string;
}

export const DATE_RANGES: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Shared between the Insights page and the CSV/JSON export route, so an
 * export always matches exactly what's on screen for the same filters. */
export function filterInsightsRows(rows: InsightsRow[], params: InsightsFilterParams, nowMs: number): InsightsRow[] {
  const statusFilter = params.status || "all";
  const voteFilter = params.vote || "all";
  const dateFilter = params.date || "all";
  const sourceFilter = params.source || "all";
  const cutoff = dateFilter !== "all" && DATE_RANGES[dateFilter] ? nowMs - DATE_RANGES[dateFilter] : null;

  return rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (voteFilter === "up" && r.vote !== "up") return false;
    if (voteFilter === "down" && r.vote !== "down") return false;
    if (voteFilter === "none" && r.vote) return false;
    // Rows logged before the source tag existed have no `source` field at
    // all — treat those as "text" (the only channel that existed then).
    if (sourceFilter !== "all" && (r.source || "text") !== sourceFilter) return false;
    if (cutoff !== null && r.createdAt < cutoff) return false;
    return true;
  });
}
