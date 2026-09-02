"use client";

import { Plus, Trash2, MessageCircle, BookMarked } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { DateBadge } from "@/components/DateBadge";
import Link from "next/link";

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  open,
  onClose,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-emerald-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`geo-pattern-dense grain fixed z-40 flex h-full w-72 flex-col border-r border-emerald-900/10 bg-emerald-950 text-emerald-50 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/home" className="flex items-center gap-2.5 px-5 pb-3 pt-6">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 text-emerald-950 text-lg shadow-lg shadow-gold-900/30">
            <span className="absolute inset-0 animate-pulse rounded-full bg-gold-400/40 blur-md" />
            <span className="relative">☾</span>
          </div>
          <p className="font-display text-xl italic leading-none text-gold-100">Deen Guide</p>
        </Link>
        <div className="arabesque-divider mx-5 mb-3 opacity-60" />
        <DateBadge className="px-5 pb-4 text-[11px] leading-relaxed text-emerald-200/50" />

        <div className="px-4">
          <button
            onClick={onNew}
            className="btn-shimmer flex w-full items-center justify-center gap-2 rounded-xl border border-gold-400/40 bg-gold-500/10 px-3 py-2.5 text-sm font-medium text-gold-200 transition hover:border-gold-400/70 hover:bg-gold-500/20"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
          <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/60">
            Your Conversations
          </p>
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-sm text-emerald-200/50">
              No conversations yet. Start a new one to ask about a topic.
            </p>
          )}
          <ul className="space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    activeId === conv.id
                      ? "border-gold-400 bg-emerald-800/80 text-white shadow-inner"
                      : "border-transparent text-emerald-100/80 hover:border-gold-500/30 hover:bg-emerald-900"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                      activeId === conv.id ? "bg-gold-500/20 text-gold-300" : "bg-emerald-900/70 text-gold-300"
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{conv.title}</span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="shrink-0 rounded p-1 text-emerald-300/40 opacity-0 transition hover:bg-emerald-950 hover:text-red-300 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-emerald-900/60 px-4 py-4">
          <Link
            href="/scholar-review"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-emerald-200/70 transition hover:bg-emerald-900 hover:text-gold-200"
          >
            <BookMarked className="h-4 w-4" />
            Scholar Review: all sources
          </Link>
        </div>
      </aside>
    </>
  );
}
