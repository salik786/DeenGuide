"use client";

import { useRouter } from "next/navigation";
import { MessageCirclePlus, Menu } from "lucide-react";
import Link from "next/link";
import { TopicPicker } from "@/components/TopicPicker";
import { Disclaimer } from "@/components/Disclaimer";
import { DateBadge } from "@/components/DateBadge";
import { TOPICS } from "@/lib/corpus";
import type { Conversation } from "@/lib/types";
import {
  loadConversations,
  saveConversations,
  upsertConversation,
  newConversationId,
  setActiveConversationId,
  setPendingQuestion,
  now,
} from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();

  function startConversation(question?: string) {
    const conv: Conversation = {
      id: newConversationId(),
      title: "New conversation",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    const conversations = upsertConversation(loadConversations(), conv);
    saveConversations(conversations);
    setActiveConversationId(conv.id);
    if (question) setPendingQuestion({ conversationId: conv.id, question });
    router.push("/chat");
  }

  return (
    <div className="geo-pattern flex h-dvh flex-col overflow-y-auto bg-cream px-4 py-8 sm:px-8">
      <Link
        href="/chat"
        className="mb-4 flex w-fit items-center gap-1.5 self-start rounded-lg border border-[#0f3d301a] bg-[#ffffffb2] px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:border-[#c99a3d80]"
      >
        <Menu className="h-3.5 w-3.5" />
        Go to conversations
      </Link>
      <div className="mx-auto w-full max-w-2xl">
        <div className="aura-bg grain mb-8 rounded-3xl px-5 py-8 text-center sm:px-6 sm:py-10">
          <div className="mx-auto mb-4 flex items-center justify-center gap-3 text-gold-500">
            <span className="arabesque-divider w-10 sm:w-12" />
            <span className="text-lg">✦</span>
            <span className="arabesque-divider w-10 sm:w-12" />
          </div>
          <p className="font-arabic text-3xl leading-relaxed text-emerald-800 sm:text-4xl">
            بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
          </p>
          <DateBadge className="mt-3 text-xs tracking-wide text-[#145a4480]" />
          <h1 className="mt-4 font-display text-3xl italic text-emerald-950 sm:text-4xl">Welcome to Deen Guide</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#0f3d30b2]">
            Ask any Islamic question in a single ongoing conversation. Answers grounded in
            Sunnah.com and Quran.com are marked Verified with the exact source shown; anything
            else is clearly marked as not verified.
          </p>
        </div>

        <div className="mb-6">
          <Disclaimer />
        </div>

        <button
          onClick={() => startConversation()}
          className="btn-shimmer mb-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3.5 font-medium text-white shadow-lg shadow-[#0f3d3033] transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-xl hover:shadow-[#0f3d3040]"
        >
          <MessageCirclePlus className="h-5 w-5" />
          Start a New Conversation
        </button>

        <div className="mb-4 flex items-center gap-3">
          <span className="arabesque-divider flex-1" />
          <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[#145a4499]">
            Or jump straight into a topic
          </p>
          <span className="arabesque-divider flex-1" />
        </div>
        <TopicPicker
          topics={TOPICS}
          onSelect={(topicId) => {
            const topic = TOPICS.find((t) => t.id === topicId);
            startConversation(topic?.sampleQuestions[0]);
          }}
        />
      </div>
    </div>
  );
}
