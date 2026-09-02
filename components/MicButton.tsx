"use client";

import { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

export function MicButton({
  onTranscribed,
  disabled,
}: {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing" | "error">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
          if (!res.ok) throw new Error("transcription failed");
          const data = await res.json();
          if (data.text) onTranscribed(data.text);
          setState("idle");
        } catch {
          setState("error");
          setTimeout(() => setState("idle"), 2000);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  const isBusy = state === "transcribing";

  return (
    <button
      type="button"
      disabled={disabled || isBusy}
      onClick={state === "recording" ? stopRecording : startRecording}
      title={state === "recording" ? "Stop recording" : "Ask by voice"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
        state === "recording"
          ? "recording-pulse bg-red-500 text-white"
          : state === "error"
            ? "bg-red-100 text-red-600"
            : "bg-emerald-100 text-emerald-800 hover:scale-105 hover:bg-emerald-200"
      }`}
    >
      {state === "recording" ? (
        <Square className="h-4 w-4" />
      ) : isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
