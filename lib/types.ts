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

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  outOfScope?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
