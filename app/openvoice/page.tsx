"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Loader2, Volume2, PhoneOff, AlertTriangle, Keyboard, Ear } from "lucide-react";

type Phase = "idle" | "connecting" | "connected" | "error";
type TurnRole = "user" | "assistant";
interface Turn {
  id: string;
  role: TurnRole;
  text: string;
  done: boolean;
}

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    function check() {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    }
    pc.addEventListener("icegatheringstatechange", check);
    // OpenAI's WebRTC exchange is a single offer/answer POST, not a
    // signaling server that can trickle candidates in afterward — so the
    // offer needs to carry what ICE candidates it has up front. Cap the
    // wait rather than risking a hang on a restrictive network.
    setTimeout(resolve, 2000);
  });
}

/** EXPERIMENTAL sandbox: OpenAI's Realtime API doing speech-to-speech
 * directly (no separate record -> transcribe -> Claude -> synthesize
 * steps), for a genuinely live, natural, interruptible conversation. The
 * corpus and three-tier rules are ported to OpenAI too (see
 * lib/openvoicePrompt.ts) — but unlike /chat and /voice, there is no
 * code-level guardrail checking the model's claims before they're spoken;
 * see the on-screen notice below for what that actually means. */
export default function OpenVoicePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [responding, setResponding] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const turnsEndRef = useRef<HTMLDivElement>(null);

  function disconnect() {
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    setListening(false);
    setResponding(false);
  }

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    return () => disconnect();
  }, []);

  function upsertTurn(itemId: string, role: TurnRole, text: string, done: boolean, replace: boolean) {
    setTurns((prev) => {
      const idx = prev.findIndex((t) => t.id === itemId);
      if (idx === -1) return [...prev, { id: itemId, role, text, done }];
      const next = [...prev];
      next[idx] = { ...next[idx], text: replace ? text : next[idx].text + text, done: done || next[idx].done };
      return next;
    });
  }

  function handleServerEvent(raw: string) {
    let event: { type?: string; item_id?: string; delta?: string; transcript?: string };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setListening(true);
        break;
      case "input_audio_buffer.speech_stopped":
        setListening(false);
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (event.item_id) upsertTurn(event.item_id, "user", event.delta ?? "", false, false);
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.item_id) upsertTurn(event.item_id, "user", event.transcript ?? "", true, true);
        break;
      case "response.created":
        setResponding(true);
        break;
      case "response.output_audio_transcript.delta":
        if (event.item_id) upsertTurn(event.item_id, "assistant", event.delta ?? "", false, false);
        break;
      case "response.output_audio_transcript.done":
        if (event.item_id) upsertTurn(event.item_id, "assistant", event.transcript ?? "", true, true);
        break;
      case "response.done":
        setResponding(false);
        break;
      case "error":
        console.error("Realtime error event:", event);
        break;
      default:
        break;
    }
  }

  async function connect() {
    setPhase("connecting");
    setErrorText("");
    setTurns([]);
    try {
      const sessionRes = await fetch("/api/openvoice/session", { method: "POST" });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.value) {
        throw new Error(sessionData.error || "Could not start a realtime session.");
      }
      const ephemeralKey: string = sessionData.value;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          void audioRef.current.play().catch(() => {});
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleServerEvent(e.data);
      dc.onclose = () => setPhase((p) => (p === "connected" ? "idle" : p));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      // When only `sdp` is sent (no `session` override), OpenAI's own SDK
      // sends it as a raw application/sdp body, not multipart form-data —
      // confirmed by reading node_modules/openai/internal/multipart-encoding.js's
      // single-field special case, after a wrapped-FormData version of this
      // got a 400 from the real API.
      const callRes = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: pc.localDescription?.sdp ?? "",
      });
      if (!callRes.ok) {
        const bodyText = await callRes.text().catch(() => "");
        console.error("Realtime /calls rejected:", callRes.status, bodyText);
        throw new Error(`Realtime connection failed (${callRes.status}): ${bodyText.slice(0, 300)}`);
      }
      const answerSdp = await callRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setPhase("connected");
    } catch (err) {
      console.error("openvoice connect failed:", err);
      disconnect();
      setErrorText(
        err instanceof Error
          ? err.message
          : "Couldn't start the conversation. Check microphone access and try again.",
      );
      setPhase("error");
    }
  }

  function endConversation() {
    disconnect();
    setPhase("idle");
    setTurns([]);
  }

  function stopSpeaking() {
    dcRef.current?.send(JSON.stringify({ type: "response.cancel" }));
  }

  return (
    <div className="geo-pattern flex h-dvh flex-col overflow-hidden bg-cream">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/voice"
          className="flex items-center gap-1.5 rounded-lg border border-[#0f3d301a] bg-[#ffffffb2] px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:border-[#c99a3d80]"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Back to voice mode
        </Link>
        <h1 className="font-display text-lg italic leading-none text-emerald-950">Deen Guide — OpenVoice (experimental)</h1>
        {phase === "connected" ? (
          <button
            onClick={endConversation}
            className="flex items-center gap-1.5 rounded-lg border border-[#dc26261a] bg-[#fee2e2b2] px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-400"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End
          </button>
        ) : (
          <span className="w-[92px]" />
        )}
      </header>
      <div className="arabesque-divider" />

      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-[#dab55c66] bg-[#f6e9c880] px-3 py-2.5 text-xs text-emerald-900 sm:mx-6">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
        <p>
          <span className="font-semibold">Experimental sandbox.</span> This uses OpenAI&rsquo;s live voice
          model directly, with the corpus and rules given to it as instructions — unlike /chat and /voice,
          nothing here re-checks its citations in code before it speaks, since audio plays as it&rsquo;s
          generated. Treat anything it says as unverified, same as this app&rsquo;s own &ldquo;Not
          verified&rdquo; tier.
        </p>
      </div>

      <audio ref={audioRef} autoPlay className="hidden" />

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {phase === "idle" || phase === "error" ? (
            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-[#0f3d30b2]">
                Starts a live, two-way voice conversation — talk naturally, interrupt it mid-sentence, no
                waiting for a record/transcribe/answer cycle.
              </p>
              {phase === "error" && (
                <p className="max-w-sm rounded-lg bg-[#fee2e2b2] px-3 py-2 text-sm font-medium text-red-700">
                  {errorText}
                </p>
              )}
              <button
                onClick={connect}
                className="btn-shimmer flex items-center gap-2 rounded-2xl bg-emerald-800 px-6 py-4 font-medium text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                <Mic className="h-5 w-5" />
                Start Conversation
              </button>
            </div>
          ) : phase === "connecting" ? (
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
              <p className="text-sm text-[#0f3d30b2]">Connecting…</p>
            </div>
          ) : (
            <>
              {turns.length === 0 && (
                <p className="mt-10 text-center text-sm text-[#0f3d3080]">
                  Connected — say something whenever you&rsquo;re ready.
                </p>
              )}
              {turns.map((t) => (
                <div key={t.id} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                      t.role === "user"
                        ? "rounded-tr-sm bg-emerald-800 text-white"
                        : "rounded-tl-sm border border-[#0f3d301a] bg-white text-emerald-950"
                    }`}
                  >
                    {t.text || (t.done ? "" : "…")}
                  </div>
                </div>
              ))}
              <div ref={turnsEndRef} />
            </>
          )}
        </div>
      </div>

      {phase === "connected" && (
        <div className="border-t border-[#0f3d301a] bg-white px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition ${
                listening ? "recording-pulse bg-red-500 text-white" : responding ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {listening ? <Ear className="h-7 w-7" /> : responding ? <Volume2 className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </div>
            <p className="text-xs font-medium text-emerald-900">
              {listening ? "Listening…" : responding ? "Speaking…" : "Ready — just talk"}
            </p>
            {responding && (
              <button
                onClick={stopSpeaking}
                className="text-xs font-medium text-[#1a6e53b2] underline underline-offset-2 hover:text-emerald-900"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
