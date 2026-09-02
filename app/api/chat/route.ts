import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TOPICS, getFullCorpus } from "@/lib/corpus";
import { buildSystemPrompt, OUT_OF_SCOPE_MESSAGE } from "@/lib/systemPrompt";
import { applyGuardrails } from "@/lib/guardrails";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_HISTORY_MESSAGES = 12;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let body: { messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages." }, { status: 400 });
  }

  const sources = getFullCorpus();
  if (sources.length === 0) {
    return NextResponse.json(
      { reply: OUT_OF_SCOPE_MESSAGE, citations: [], outOfScope: true },
      { status: 200 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the server." },
      { status: 500 },
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(TOPICS, sources);
  const trimmedHistory = messages.slice(-MAX_HISTORY_MESSAGES);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: systemPrompt,
      messages: trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const result = applyGuardrails(rawText, sources);

    return NextResponse.json({
      reply: result.text,
      citations: result.citations.map((c) => ({ tag: c.tag, source: c.source })),
      outOfScope: result.outOfScope,
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "The assistant couldn't respond right now. Please try again." },
      { status: 502 },
    );
  }
}
