"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, Loader2, Volume2, Keyboard, RotateCcw, MicOff } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { Disclaimer } from "@/components/Disclaimer";
import { SuggestionChips } from "@/components/SuggestionChips";
import { DateBadge } from "@/components/DateBadge";
import type { ChatMessage, Vote } from "@/lib/types";
import { newConversationId, newMessageId, now } from "@/lib/storage";

type Phase = "idle" | "recording" | "transcribing" | "confirming" | "answering" | "speaking" | "error";

const CONFIRM_DELAY_MS = 2500;

function stripCitationTags(text: string): string {
  return text.replace(/[ \t]*\[S\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** A big-button, voice-in/voice-out screen for the event kiosk tablet,
 * where typing is impractical. Talking through /api/chat and /api/voice/*
 * the same way the typed chat does, but chained into a hands-free loop:
 * record -> transcribe -> briefly show what it heard -> auto-send ->
 * auto-play the spoken answer -> ready for the next question. Each visitor
 * gets a fresh conversation on load; "Start Over" resets mid-session too. */
export default function VoicePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmText, setConfirmText] = useState("");

  const conversationIdRef = useRef(newConversationId());
  // Bumped by startOver() so any in-flight async step (transcription,
  // chat call, TTS playback) can tell it's stale and quietly no-op instead
  // of clobbering state from a session the visitor already reset.
  const sessionRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, phase]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  function startOver() {
    sessionRef.current += 1;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    conversationIdRef.current = newConversationId();
    setMessages([]);
    setConfirmText("");
    setErrorText("");
    setPhase("idle");
  }

  function fail(message: string, session: number) {
    if (session !== sessionRef.current) return;
    setErrorText(message);
    setPhase("error");
    setTimeout(() => {
      if (session === sessionRef.current) setPhase("idle");
    }, 2500);
  }

  async function startRecording() {
    const session = sessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void transcribeAndConfirm(mimeType, session);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
    } catch {
      fail("Couldn't access the microphone. Please allow mic access and try again.", session);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function transcribeAndConfirm(mimeType: string | undefined, session: number) {
    if (session !== sessionRef.current) return;
    setPhase("transcribing");
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      if (session !== sessionRef.current) return;
      if (!res.ok) throw new Error("transcription failed");
      const data = await res.json();
      const text = (data.text || "").trim();
      if (!text) {
        fail("Didn't catch that — tap the microphone and try again.", session);
        return;
      }
      setConfirmText(text);
      setPhase("confirming");
      confirmTimerRef.current = setTimeout(() => void sendQuestion(text, session), CONFIRM_DELAY_MS);
    } catch {
      fail("Couldn't understand that. Please try again.", session);
    }
  }

  function cancelConfirm() {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmText("");
    setPhase("idle");
  }

  async function sendQuestion(text: string, session: number) {
    if (session !== sessionRef.current) return;
    const userMessage: ChatMessage = { id: newMessageId(), role: "user", content: text, createdAt: now() };
    let history: ChatMessage[] = [];
    setMessages((prev) => {
      history = [...prev, userMessage];
      return history;
    });
    setConfirmText("");
    setPhase("answering");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (session !== sessionRef.current) return;

      const assistantMessage: ChatMessage = {
        id: res.ok && data.id ? data.id : newMessageId(),
        role: "assistant",
        content: res.ok ? data.reply : data.error || "Something went wrong. Please try again.",
        citations: res.ok ? data.citations : [],
        webSources: res.ok ? data.webSources : [],
        status: res.ok ? data.status : "declined",
        createdAt: now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await speak(assistantMessage.content, session);
    } catch {
      if (session !== sessionRef.current) return;
      const assistantMessage: ChatMessage = {
        id: newMessageId(),
        role: "assistant",
        content: "I couldn't reach the assistant. Please check your connection and try again.",
        status: "declined",
        createdAt: now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPhase("idle");
    }
  }

  async function speak(text: string, session: number) {
    if (session !== sessionRef.current) return;
    setPhase("speaking");
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: stripCitationTags(text) }),
      });
      if (session !== sessionRef.current) return;
      if (!res.ok) throw new Error("speak failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        if (session === sessionRef.current) setPhase("idle");
      };
      audio.onerror = () => {
        if (session === sessionRef.current) setPhase("idle");
      };
      await audio.play();
    } catch {
      if (session === sessionRef.current) setPhase("idle");
    }
  }

  function handleVote(message: ChatMessage, vote: Vote) {
    const nextVote = message.vote === vote ? undefined : vote;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, vote: nextVote } : m)));
    if (nextVote) {
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          conversationId: conversationIdRef.current,
          question: messages[messages.indexOf(message) - 1]?.content ?? "",
          answer: message.content,
          status: message.status,
          vote: nextVote,
        }),
      }).catch(() => {});
    }
  }

  const micDisabled = phase === "transcribing" || phase === "answering" || phase === "speaking";

  return (
    <div className="geo-pattern flex h-dvh flex-col overflow-hidden bg-cream">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 rounded-lg border border-[#0f3d301a] bg-[#ffffffb2] px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:border-[#c99a3d80]"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Type instead
        </Link>
        <div className="text-center">
          <h1 className="font-display text-lg italic leading-none text-emerald-950">Deen Guide</h1>
          <DateBadge className="mt-0.5 text-[11px] text-[#145a4499]" />
        </div>
        <button
          onClick={startOver}
          className="flex items-center gap-1.5 rounded-lg border border-[#0f3d301a] bg-[#ffffffb2] px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:border-[#c99a3d80]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Start Over
        </button>
      </header>
      <div className="arabesque-divider" />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <Disclaimer />
              <div>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[#145a4499]">
                  Or tap a question to ask it
                </p>
                <SuggestionChips
                  onSelect={(q) => void sendQuestion(q, sessionRef.current)}
                  className="stagger-in flex flex-wrap gap-2"
                />
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onSuggestedQuestion={(q) => void sendQuestion(q, sessionRef.current)}
              onVote={m.role === "assistant" ? (vote) => handleVote(m, vote) : undefined}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[#0f3d301a] bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          {phase === "confirming" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#145a4499]">You asked</p>
              <p className="font-display text-xl italic text-emerald-950">&ldquo;{confirmText}&rdquo;</p>
              <button
                onClick={cancelConfirm}
                className="text-xs font-medium text-[#1a6e53b2] underline underline-offset-2 hover:text-emerald-900"
              >
                That&rsquo;s not right — cancel
              </button>
            </>
          ) : phase === "error" ? (
            <>
              <MicOff className="h-8 w-8 text-red-600" />
              <p className="text-sm font-medium text-red-700">{errorText}</p>
            </>
          ) : (
            <>
              <button
                onClick={phase === "recording" ? stopRecording : startRecording}
                disabled={micDisabled}
                className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition disabled:opacity-50 ${
                  phase === "recording"
                    ? "recording-pulse bg-red-500 text-white"
                    : "btn-shimmer bg-emerald-800 text-white hover:scale-105 hover:bg-emerald-700"
                }`}
              >
                {phase === "recording" ? (
                  <Square className="h-8 w-8" />
                ) : phase === "transcribing" || phase === "answering" ? (
                  <Loader2 className="h-9 w-9 animate-spin" />
                ) : phase === "speaking" ? (
                  <Volume2 className="h-9 w-9" />
                ) : (
                  <Mic className="h-9 w-9" />
                )}
              </button>
              <p className="text-sm font-medium text-emerald-900">
                {phase === "recording"
                  ? "Listening… tap to stop"
                  : phase === "transcribing"
                    ? "Understanding what you said…"
                    : phase === "answering"
                      ? "Finding your answer…"
                      : phase === "speaking"
                        ? "Answering…"
                        : "Tap the microphone and ask your question"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
