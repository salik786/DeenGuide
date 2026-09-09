export type SourceType = "quran" | "hadith";

export interface SourceEntry {
  id: string;
  type: SourceType;
  sourceSite: string;
  collection: string;
  reference: string;
  inBookReference?: string;
  narrator?: string;
  arabic?: string;
  translation: string;
  translator: string;
  url: string;
}

export interface Topic {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  sampleQuestions: string[];
}

export type ChatRole = "user" | "assistant";

export interface Citation {
  tag: string;
  source: SourceEntry;
}

/** A live web search result from one of the allowlisted Islamic knowledge
 * sites — used for "unverified" answers, distinct from our hand-vetted
 * static `SourceEntry` corpus used for "verified" answers. */
export interface WebSource {
  url: string;
  title?: string;
}

/**
 * verified: answer is fully grounded in our hand-curated static corpus.
 * unverified: a real Islamic question, answered from Claude's general
 *   knowledge (optionally aided by a live web search of a few trusted
 *   sites) because our static corpus doesn't cover it — must be visually
 *   flagged and never treated as equivalent to a verified answer.
 * declined: not answered at all (off-topic, a personal calculation,
 *   or an attempt to bypass the rules).
 */
export type AnswerStatus = "verified" | "unverified" | "declined";

export type Vote = "up" | "down";

/** Which input channel a question came in on — /chat (typed, with an
 * optional manual mic-to-textbox transcription) vs /voice (fully
 * hands-free). Shown as a tag in Insights so questions from the two are
 * easy to tell apart even though they share the same conversation list. */
export type MessageSource = "text" | "voice";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  webSources?: WebSource[];
  status?: AnswerStatus;
  vote?: Vote;
  source?: MessageSource;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
