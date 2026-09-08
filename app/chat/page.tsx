"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCirclePlus } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import type { Conversation } from "@/lib/types";
import {
  loadConversations,
  saveConversations,
  upsertConversation,
  deleteConversationById,
  newConversationId,
  getActiveConversationId,
  setActiveConversationId,
  consumePendingQuestion,
  now,
} from "@/lib/storage";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Reading localStorage must happen post-mount to avoid an SSR/client
    // markup mismatch — a legitimate exception to the "no setState in
    // effects" rule, same pattern used for the Hijri date elsewhere.
    const loaded = loadConversations();
    const storedActiveId = getActiveConversationId();
    const resolvedActiveId = loaded.some((c) => c.id === storedActiveId) ? storedActiveId : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(loaded);
    setActiveId(resolvedActiveId);
    if (resolvedActiveId) {
      setInitialQuestion(consumePendingQuestion(resolvedActiveId));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [conversations, hydrated]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function selectConversation(id: string | null) {
    setActiveId(id);
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  function handleNew() {
    const conv: Conversation = {
      id: newConversationId(),
      title: "New conversation",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    setConversations((prev) => upsertConversation(prev, conv));
    setInitialQuestion(undefined);
    selectConversation(conv.id);
  }

  function handleUpdate(updated: Conversation) {
    setConversations((prev) => upsertConversation(prev, updated));
  }

  function handleDelete(id: string) {
    setConversations((prev) => deleteConversationById(prev, id));
    if (activeId === id) selectConversation(null);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-cream">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNew={handleNew}
        onSelect={(id) => {
          setInitialQuestion(undefined);
          selectConversation(id);
        }}
        onDelete={handleDelete}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="min-w-0 flex-1 lg:pl-0">
        {active ? (
          <ChatView
            key={active.id}
            conversation={active}
            onUpdate={handleUpdate}
            onOpenSidebar={() => setSidebarOpen(true)}
            initialQuestion={initialQuestion}
          />
        ) : (
          <div className="geo-pattern relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 rounded-lg border border-[#0f3d301a] bg-[#ffffffb2] px-3 py-1.5 text-xs font-medium text-emerald-900 lg:hidden"
            >
              ☰ Menu
            </button>
            <p className="font-display text-2xl italic text-emerald-950">No conversation open</p>
            <p className="max-w-xs text-sm text-[#0f3d3099]">
              Start a new conversation, pick one from the sidebar, or head back to the topic
              overview.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleNew}
                className="btn-shimmer flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <MessageCirclePlus className="h-4 w-4" />
                New Conversation
              </button>
              <Link
                href="/home"
                className="rounded-xl border border-[#145a4433] px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:border-[#c99a3d80] hover:bg-[#ffffff99]"
              >
                Browse topics
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
