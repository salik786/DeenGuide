"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Menu, Sparkles } from "lucide-react";
import type { Conversation, ChatMessage, Vote } from "@/lib/types";
import { MessageBubble } from "@/components/MessageBubble";
import { MicButton } from "@/components/MicButton";
import { Disclaimer } from "@/components/Disclaimer";
import { SuggestionChips } from "@/components/SuggestionChips";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { newMessageId, now } from "@/lib/storage";

export function ChatView({
  conversation,
  onUpdate,
  onOpenSidebar,
  initialQuestion,
}: {
  conversation: Conversation;
  onUpdate: (updated: Conversation) => void;
  onOpenSidebar: () => void;
  initialQuestion?: string;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length, sending]);

  useEffect(() => {
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    if (initialQuestion && conversation.messages.length === 0) {
      sendMessage(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: newMessageId(),
      role: "user",
      content: trimmed,
      createdAt: now(),
    };

    const isFirstMessage = conversation.messages.length === 0;
    const withUser: Conversation = {
      ...conversation,
      title: isFirstMessage ? trimmed.slice(0, 42) + (trimmed.length > 42 ? "…" : "") : conversation.title,
      messages: [...conversation.messages, userMessage],
      updatedAt: now(),
    };
    onUpdate(withUser);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          messages: withUser.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: res.ok && data.id ? data.id : newMessageId(),
        role: "assistant",
        content: res.ok ? data.reply : data.error || "Something went wrong. Please try again.",
        citations: res.ok ? data.citations : [],
        webSources: res.ok ? data.webSources : [],
        status: res.ok ? data.status : "declined",
        createdAt: now(),
      };

      onUpdate({
        ...withUser,
        messages: [...withUser.messages, assistantMessage],
        updatedAt: now(),
      });
    } catch {
      const assistantMessage: ChatMessage = {
        id: newMessageId(),
        role: "assistant",
        content: "I couldn't reach the assistant. Please check your connection and try again.",
        status: "declined",
        createdAt: now(),
      };
      onUpdate({
        ...withUser,
        messages: [...withUser.messages, assistantMessage],
        updatedAt: now(),
      });
    } finally {
      setSending(false);
    }
  }

  function handleVote(message: ChatMessage, vote: Vote) {
    const nextVote = message.vote === vote ? undefined : vote; // tap again to un-vote
    onUpdate({
      ...conversation,
      messages: conversation.messages.map((m) => (m.id === message.id ? { ...m, vote: nextVote } : m)),
    });
    if (nextVote) {
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          conversationId: conversation.id,
          question: conversation.messages[conversation.messages.indexOf(message) - 1]?.content ?? "",
          answer: message.content,
          status: message.status,
          vote: nextVote,
        }),
      }).catch(() => {});
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="geo-pattern bg-cream">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={onOpenSidebar} className="rounded-lg p-1.5 text-emerald-900 hover:bg-emerald-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-gold-100 shadow-sm">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg italic leading-none text-emerald-950">
              Deen Guide
            </h1>
            <p className="truncate text-xs text-[#145a4499]">
              Verified answers are cited; anything else is clearly marked
            </p>
          </div>
        </div>
        <div className="arabesque-divider" />
      </header>

      <div ref={scrollRef} className="geo-pattern flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.messages.length === 0 && (
            <div className="space-y-4">
              <Disclaimer />
              <div>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[#145a4499]">
                  Frequently asked questions
                </p>
                <SuggestionChips onSelect={sendMessage} className="stagger-in flex flex-wrap gap-2" />
              </div>
            </div>
          )}
          {conversation.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onSuggestedQuestion={sendMessage}
              onVote={m.role === "assistant" ? (vote) => handleVote(m, vote) : undefined}
            />
          ))}
          {sending && <LoadingIndicator />}
        </div>
      </div>

      <div className="border-t border-[#0f3d301a] bg-white px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="mx-auto flex max-w-2xl items-end gap-2"
        >
          <MicButton disabled={sending} onTranscribed={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            rows={1}
            placeholder="Ask about the Five Pillars, prayer, fasting, or manners…"
            className="max-h-32 flex-1 resize-none rounded-2xl border border-[#0f3d3026] bg-cream px-4 py-2.5 text-sm text-emerald-950 outline-none transition-shadow placeholder:text-[#0f3d3066] focus:border-emerald-600 focus:ring-4 focus:ring-[#1f85631a]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-white transition hover:scale-105 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
