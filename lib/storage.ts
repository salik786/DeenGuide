import type { Conversation } from "@/lib/types";

const STORAGE_KEY = "musalah-conversations-v1";
const ACTIVE_ID_KEY = "musalah-active-conversation-v1";
const PENDING_QUESTION_KEY = "musalah-pending-question-v1";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or unavailable — silently ignore, conversation still works in-memory.
  }
}

export function upsertConversation(conversations: Conversation[], updated: Conversation): Conversation[] {
  const idx = conversations.findIndex((c) => c.id === updated.id);
  const next = [...conversations];
  if (idx === -1) {
    next.push(updated);
  } else {
    next[idx] = updated;
  }
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteConversationById(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter((c) => c.id !== id);
}

export function newConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Small wrapper so components can get a timestamp without a lint-flagged
 * direct call to the impure `Date.now()` global inside component bodies. */
export function now(): number {
  return Date.now();
}

/** Which conversation /chat should show — set when a conversation is
 * created or selected, read once on /chat's mount so a full page load
 * (not just client-side navigation) still lands on the right thread. */
export function getActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ID_KEY);
}

export function setActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_ID_KEY, id);
  else window.localStorage.removeItem(ACTIVE_ID_KEY);
}

interface PendingQuestion {
  conversationId: string;
  question: string;
}

/** A starter question queued from /home (e.g. a topic card) for /chat to
 * auto-send once, right after it creates and opens the new conversation. */
export function setPendingQuestion(payload: PendingQuestion): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify(payload));
}

/** Reads and clears the pending question in one step — it's one-shot. */
export function consumePendingQuestion(conversationId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(PENDING_QUESTION_KEY);
  if (!raw) return undefined;
  window.sessionStorage.removeItem(PENDING_QUESTION_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingQuestion;
    return parsed.conversationId === conversationId ? parsed.question : undefined;
  } catch {
    return undefined;
  }
}
