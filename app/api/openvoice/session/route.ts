import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getFullCorpus, TOPICS } from "@/lib/corpus";
import { buildOpenVoiceInstructions } from "@/lib/openvoicePrompt";

export const runtime = "nodejs";

/** Mints a short-lived Realtime API client secret server-side, with the
 * corpus/instructions baked in — the browser only ever sees the ephemeral
 * token (never OPENAI_API_KEY), matching how /api/voice/* already never
 * exposes it either. See lib/openvoicePrompt.ts for why this is an
 * experimental trust model, not a drop-in replacement for /chat or /voice. */
export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing OPENAI_API_KEY. Add it to .env.local and restart the server." },
      { status: 500 },
    );
  }

  const sources = getFullCorpus();
  const instructions = buildOpenVoiceInstructions(TOPICS, sources);

  try {
    const openai = new OpenAI({ apiKey });
    const clientSecret = await openai.realtime.clientSecrets.create({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model: "gpt-realtime",
        instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: { model: "gpt-4o-transcribe" },
            turn_detection: { type: "server_vad" },
          },
          output: { voice: "cedar" },
        },
      },
    });

    return NextResponse.json({ value: clientSecret.value, expiresAt: clientSecret.expires_at });
  } catch (err) {
    console.error("OpenAI Realtime session error:", err);
    return NextResponse.json({ error: "Could not start a realtime session." }, { status: 502 });
  }
}
