import type { SourceEntry, Citation } from "@/lib/types";
import { OUT_OF_SCOPE_MESSAGE } from "@/lib/systemPrompt";

interface GuardrailResult {
  text: string;
  citations: Citation[];
  outOfScope: boolean;
}

/**
 * Sources are presented to the model as [S1], [S2]... in the order of the
 * `sources` array. This maps those tags back to the real, verified source
 * entries and strips any tag the model invented that doesn't exist, so the
 * UI only ever shows citations we can vouch for.
 */
export function applyGuardrails(rawText: string, sources: SourceEntry[]): GuardrailResult {
  const trimmed = rawText.trim();

  if (trimmed === OUT_OF_SCOPE_MESSAGE || trimmed.length === 0) {
    return { text: OUT_OF_SCOPE_MESSAGE, citations: [], outOfScope: true };
  }

  const tagPattern = /\[S(\d+)\]/g;
  const foundTags = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(trimmed)) !== null) {
    foundTags.add(match[0]);
  }

  const citations: Citation[] = [];
  for (const tag of foundTags) {
    const num = parseInt(tag.replace(/[^\d]/g, ""), 10);
    const source = sources[num - 1];
    if (source) {
      citations.push({ tag, source });
    }
  }

  // Deterministic safety net: a religious-fact answer with zero valid
  // citations means the model likely drifted from the provided sources.
  // Rather than show ungrounded text, fall back to the safe message.
  if (citations.length === 0) {
    return { text: OUT_OF_SCOPE_MESSAGE, citations: [], outOfScope: true };
  }

  return { text: trimmed, citations, outOfScope: false };
}
