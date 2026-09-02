import type { SourceEntry, Citation, WebSource, AnswerStatus } from "@/lib/types";
import { DECLINED_MESSAGE } from "@/lib/systemPrompt";

interface GuardrailResult {
  text: string;
  citations: Citation[];
  webSources: WebSource[];
  status: AnswerStatus;
}

const TAG_PATTERN = /^\[\[(VERIFIED|UNVERIFIED|DECLINED)\]\]\s*/i;
const MAX_WEB_SOURCES = 4;

/**
 * Parses the model's leading [[VERIFIED]]/[[UNVERIFIED]]/[[DECLINED]] tag
 * and enforces it in code rather than trusting the model's self-report:
 *  - A missing/malformed tag is treated as DECLINED (fail closed).
 *  - A [[VERIFIED]] claim with zero valid [S#] citations is downgraded to
 *    UNVERIFIED — the model said it was grounded but didn't actually cite
 *    anything real, so we don't show it as verified.
 *  - Citation tags are cross-checked against the real source list; any tag
 *    the model invented is silently dropped rather than shown.
 *  - `webResults` (URLs the web_search tool actually returned this turn,
 *    already domain-restricted by the API call itself) are attached to an
 *    UNVERIFIED answer as "checked" sources, but never to VERIFIED —
 *    verified status is reserved for our hand-vetted static corpus only.
 */
export function applyGuardrails(
  rawText: string,
  sources: SourceEntry[],
  webResults: WebSource[] = [],
): GuardrailResult {
  const trimmed = rawText.trim();
  const match = trimmed.match(TAG_PATTERN);

  if (!match) {
    return { text: DECLINED_MESSAGE, citations: [], webSources: [], status: "declined" };
  }

  const claimedStatus = match[1].toUpperCase() as "VERIFIED" | "UNVERIFIED" | "DECLINED";
  const body = trimmed.slice(match[0].length).trim();

  if (claimedStatus === "DECLINED" || body.length === 0) {
    return { text: DECLINED_MESSAGE, citations: [], webSources: [], status: "declined" };
  }

  if (claimedStatus === "UNVERIFIED") {
    // Defensive cleanup: strip any citation tags that shouldn't be here.
    const cleaned = body.replace(/\s*\[S\d+\]/g, "").trim();
    return {
      text: cleaned,
      citations: [],
      webSources: webResults.slice(0, MAX_WEB_SOURCES),
      status: "unverified",
    };
  }

  // claimedStatus === "VERIFIED"
  const tagPattern = /\[S(\d+)\]/g;
  const foundTags = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(body)) !== null) {
    foundTags.add(m[0]);
  }

  const citations: Citation[] = [];
  for (const tag of foundTags) {
    const num = parseInt(tag.replace(/[^\d]/g, ""), 10);
    const source = sources[num - 1];
    if (source) citations.push({ tag, source });
  }

  if (citations.length === 0) {
    // Claimed grounded but cited nothing real — don't take its word for it.
    return {
      text: body,
      citations: [],
      webSources: webResults.slice(0, MAX_WEB_SOURCES),
      status: "unverified",
    };
  }

  return { text: body, citations, webSources: [], status: "verified" };
}
