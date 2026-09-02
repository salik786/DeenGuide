import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing OPENAI_API_KEY. Add it to .env.local and restart the server." },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const audioFile = formData.get("audio");

  if (!(audioFile instanceof File)) {
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: "Could not transcribe audio." }, { status: 502 });
  }
}
