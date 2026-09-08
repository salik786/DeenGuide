"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Loader2, Volume2, Keyboard, RotateCcw, MicOff, Ear } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { Disclaimer } from "@/components/Disclaimer";
import { SuggestionChips } from "@/components/SuggestionChips";
import { DateBadge } from "@/components/DateBadge";
import type { ChatMessage, Vote } from "@/lib/types";
import { newConversationId, newMessageId, now } from "@/lib/storage";

type Phase = "idle" | "recording" | "transcribing" | "confirming" | "answering" | "speaking" | "error";

const CONFIRM_DELAY_MS = 2500;
// Pause before the mic reopens after an answer finishes, so it doesn't
// pick up the tail end of its own voice through the tablet's speaker.
const RELISTEN_DELAY_MS = 700;

// Voice-activity detection (auto-stop recording without a tap): silence
// this long after speech was heard ends the turn; silence this long with
// no speech at all ends it too (and skips transcription entirely, so an
// idle kiosk with nobody talking doesn't keep spending Whisper calls);
// this is a hard cap regardless, in case detection never fires.
const SILENCE_AFTER_SPEECH_MS = 1400;
const NO_SPEECH_TIMEOUT_MS = 6000;
const MAX_RECORDING_MS = 15000;
const SPEECH_VOLUME_THRESHOLD = 10; // avg deviation from silence (0-128 scale)

// A ~0.1s silent WAV, used only to "unlock" audio playback (see
// unlockAudio() below) — never actually heard.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

function stripCitationTags(text: string): string {
  return text.replace(/[ \t]*\[S\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

// Answers can run several paragraphs (intro + quoted evidence + summary),
// which reads out loud as a very long, tedious clip. Speech gets a shorter
// version; the full text with all citations still shows on screen either
// way. Cuts only at paragraph breaks (never mid-sentence or mid-quote) —
// always includes the first paragraph even if it alone exceeds the budget,
// then keeps adding whole paragraphs while still under it.
const SPEECH_LENGTH_BUDGET = 350;

function truncateForSpeech(text: string, maxChars = SPEECH_LENGTH_BUDGET): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return text;
  let result = paragraphs[0];
  for (let i = 1; i < paragraphs.length && result.length < maxChars; i++) {
    result += "\n\n" + paragraphs[i];
  }
  return result;
}

/** A big-button, fully hands-free voice screen for the event kiosk tablet,
 * where typing (and repeatedly tapping a mic button) is impractical. One
 * tap to begin, then it loops on its own: listen (auto-stops once you stop
 * talking) -> transcribe -> briefly show what it heard -> auto-send ->
 * auto-play the spoken answer -> listen again. Each visitor gets a fresh
 * conversation on load; "Start Over" resets mid-session too. */
export default function VoicePage() {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");
  // Mic-permission failures need a manual retry tap (auto-retrying a denied
  // permission would just loop the same error forever); other hiccups
  // (a bad transcription, a network blip) are safe to recover from on
  // their own so the kiosk doesn't get stuck waiting on a visitor to help.
  const [needsManualRetry, setNeedsManualRetry] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmText, setConfirmText] = useState("");

  const conversationIdRef = useRef(newConversationId());
  // Bumped by startOver() so any in-flight async step (recording, VAD,
  // transcription, the chat call, TTS playback, a pending re-listen timer)
  // can tell it's stale and quietly no-op instead of clobbering state from
  // a session the visitor already reset.
  const sessionRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Reused for every playback (never a fresh `new Audio()` per answer) so
  // the one-time unlock below actually carries over to later, tap-less calls.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice-activity detection bookkeeping for the current recording.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef = useRef(false);

  function stopVad() {
    if (vadRafRef.current !== null) cancelAnimationFrame(vadRafRef.current);
    if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
    if (vadMaxTimerRef.current) clearTimeout(vadMaxTimerRef.current);
    vadRafRef.current = null;
    vadSilenceTimerRef.current = null;
    vadMaxTimerRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, phase]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (relistenTimerRef.current) clearTimeout(relistenTimerRef.current);
      stopVad();
    };
  }, []);

  function clearAllTimers() {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    if (relistenTimerRef.current) clearTimeout(relistenTimerRef.current);
    confirmTimerRef.current = null;
    relistenTimerRef.current = null;
  }

  function startOver() {
    sessionRef.current += 1;
    clearAllTimers();
    stopVad();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    audioRef.current?.pause();
    conversationIdRef.current = newConversationId();
    setMessages([]);
    setConfirmText("");
    setErrorText("");
    setNeedsManualRetry(false);
    setPhase("idle");
    beginListening();
  }

  /** Answer playback (and the next listen cycle) happens several `await`s
   * — and setTimeouts — removed from whichever tap started this session.
   * Browsers' autoplay policy only credits a "real" user gesture for so
   * long, and by then it's expired, silently blocking audio.play() with no
   * error anywhere in the chain. Playing (and instantly pausing) a silent
   * clip synchronously inside the one real tap (the "Tap to Begin" gate,
   * or Start Over) marks this <audio> element as activated for the rest of
   * the page's life, so every later playback on that same element — even
   * from a tap-less auto-restart — goes through. */
  function unlockAudio() {
    const el = audioRef.current ?? new Audio();
    audioRef.current = el;
    el.src = SILENT_WAV;
    el.play()
      .then(() => el.pause())
      .catch(() => {});
  }

  function beginListening() {
    unlockAudio();
    void startRecording();
  }

  /** Schedules the next listen cycle instead of requiring a tap — the core
   * of "hands-free". Guarded by the session token so a Start Over during
   * the pause doesn't resurrect a stale cycle. */
  function scheduleRelisten(session: number, delayMs = RELISTEN_DELAY_MS) {
    if (relistenTimerRef.current) clearTimeout(relistenTimerRef.current);
    relistenTimerRef.current = setTimeout(() => {
      if (session === sessionRef.current) void startRecording();
    }, delayMs);
  }

  function fail(message: string, session: number, options: { manualRetry?: boolean } = {}) {
    if (session !== sessionRef.current) return;
    setErrorText(message);
    setNeedsManualRetry(!!options.manualRetry);
    setPhase("error");
    if (!options.manualRetry) {
      setTimeout(() => {
        if (session === sessionRef.current) scheduleRelisten(session, 200);
      }, 2000);
    }
  }

  /** Watches mic input volume so recording stops on its own — no "tap to
   * stop" needed. Falls back to just the hard MAX_RECORDING_MS cap (via
   * startRecording's own timer, since AudioContext may not exist) if the
   * Web Audio API isn't available. */
  function startVad(stream: MediaStream, session: number) {
    hasSpokenRef.current = false;
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const noSpeechTimer = setTimeout(() => {
      if (!hasSpokenRef.current && session === sessionRef.current) stopRecording();
    }, NO_SPEECH_TIMEOUT_MS);

    function tick() {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
      const avg = sum / data.length;

      if (avg > SPEECH_VOLUME_THRESHOLD) {
        hasSpokenRef.current = true;
        clearTimeout(noSpeechTimer);
        if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
        vadSilenceTimerRef.current = setTimeout(() => {
          if (session === sessionRef.current) stopRecording();
        }, SILENCE_AFTER_SPEECH_MS);
      }
      vadRafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  async function startRecording() {
    const session = sessionRef.current;
    unlockAudio();
    setErrorText("");
    setNeedsManualRetry(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const spoke = hasSpokenRef.current;
        stopVad();
        if (session !== sessionRef.current) return;
        if (!spoke) {
          // Nothing was said (an idle kiosk between visitors) — loop back
          // to listening without spending a transcription call on silence.
          scheduleRelisten(session, 200);
          return;
        }
        void transcribeAndConfirm(mimeType, session);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
      startVad(stream, session);
      vadMaxTimerRef.current = setTimeout(() => {
        if (session === sessionRef.current) stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      fail("Microphone access is blocked. Please allow mic access, then tap to try again.", session, {
        manualRetry: true,
      });
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
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
        fail("Didn't catch that — listening again…", session);
        return;
      }
      setConfirmText(text);
      setPhase("confirming");
      confirmTimerRef.current = setTimeout(() => void sendQuestion(text, session), CONFIRM_DELAY_MS);
    } catch {
      fail("Couldn't understand that — listening again…", session);
    }
  }

  function cancelConfirm() {
    const session = sessionRef.current;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmText("");
    setPhase("idle");
    scheduleRelisten(session, 200);
  }

  async function sendQuestion(text: string, session: number) {
    if (session !== sessionRef.current) return;
    const userMessage: ChatMessage = { id: newMessageId(), role: "user", content: text, createdAt: now() };
    // Read `messages` directly from this render's closure rather than a
    // setMessages(prev => ...) updater — the updater's own callback isn't
    // guaranteed to run synchronously, so a `history` variable assigned
    // inside one and read right after could still be stale (e.g. empty),
    // which was silently sending {messages: []} and tripping the API's
    // "Missing messages" validation.
    const history = [...messages, userMessage];
    setMessages(history);
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
      await speak(assistantMessage.content, session);
    }
  }

  async function speak(text: string, session: number) {
    if (session !== sessionRef.current) return;
    setPhase("speaking");
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: truncateForSpeech(stripCitationTags(text)) }),
      });
      if (session !== sessionRef.current) return;
      if (!res.ok) throw new Error("speak failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (session === sessionRef.current) {
          setPhase("idle");
          scheduleRelisten(session);
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (session === sessionRef.current) {
          setPhase("idle");
          scheduleRelisten(session);
        }
      };
      audio.src = url;
      await audio.play();
    } catch {
      if (session === sessionRef.current) {
        setPhase("idle");
        scheduleRelisten(session);
      }
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

  function askDirectly(question: string) {
    unlockAudio();
    void sendQuestion(question, sessionRef.current);
  }

  if (!started) {
    return (
      <div className="geo-pattern flex h-dvh flex-col items-center justify-center gap-6 bg-cream px-6 text-center">
        <div className="aura-bg grain rounded-3xl px-8 py-10">
          <h1 className="font-display text-3xl italic text-emerald-950">Deen Guide</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#0f3d30b2]">
            Tap once to begin — after that, just talk. It listens, answers, and reads the answer
            back automatically.
          </p>
          <button
            onClick={() => {
              setStarted(true);
              beginListening();
            }}
            className="btn-shimmer mt-6 flex items-center gap-2 rounded-2xl bg-emerald-800 px-6 py-4 font-medium text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <Mic className="h-5 w-5" />
            Tap to Begin
          </button>
        </div>
        <Link href="/chat" className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950">
          <Keyboard className="h-4 w-4" />
          Prefer to type instead?
        </Link>
      </div>
    );
  }

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
                <SuggestionChips onSelect={askDirectly} className="stagger-in flex flex-wrap gap-2" />
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onSuggestedQuestion={askDirectly}
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
              <button
                onClick={needsManualRetry ? beginListening : undefined}
                disabled={!needsManualRetry}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 disabled:opacity-80"
              >
                <MicOff className="h-7 w-7" />
              </button>
              <p className="text-sm font-medium text-red-700">{errorText}</p>
              {needsManualRetry && <p className="text-xs text-red-600/70">Tap the icon above to try again</p>}
            </>
          ) : (
            <>
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition ${
                  phase === "recording"
                    ? "recording-pulse bg-red-500 text-white"
                    : "bg-emerald-800 text-white"
                }`}
              >
                {phase === "recording" ? (
                  <Ear className="h-9 w-9" />
                ) : phase === "transcribing" || phase === "answering" ? (
                  <Loader2 className="h-9 w-9 animate-spin" />
                ) : phase === "speaking" ? (
                  <Volume2 className="h-9 w-9" />
                ) : (
                  <Mic className="h-9 w-9" />
                )}
              </div>
              <p className="text-sm font-medium text-emerald-900">
                {phase === "recording"
                  ? "Listening…"
                  : phase === "transcribing"
                    ? "Understanding what you said…"
                    : phase === "answering"
                      ? "Finding your answer…"
                      : phase === "speaking"
                        ? "Answering…"
                        : "Getting ready to listen…"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
