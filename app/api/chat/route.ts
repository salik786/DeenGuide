import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { TOPICS, getFullCorpus } from "@/lib/corpus";
import { buildSystemPrompt, DECLINED_MESSAGE, TRUSTED_SEARCH_DOMAINS } from "@/lib/systemPrompt";
import { applyGuardrails } from "@/lib/guardrails";
import { logTranscript } from "@/lib/db";
import type { WebSource } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_HISTORY_MESSAGES = 12;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let body: { messages?: IncomingMessage[]; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messages, conversationId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages." }, { status: 400 });
  }

  const question = messages[messages.length - 1]?.content ?? "";
  const messageId = randomUUID();

  const sources = getFullCorpus();
  if (sources.length === 0) {
    return NextResponse.json(
      { id: messageId, reply: DECLINED_MESSAGE, citations: [], webSources: [], status: "declined" },
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
      max_tokens: 1024,
      system: systemPrompt,
      messages: trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          allowed_domains: TRUSTED_SEARCH_DOMAINS,
          max_uses: 2,
        },
      ],
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const webResults: WebSource[] = [];
    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const item of block.content) {
          webResults.push({ url: item.url, title: item.title });
        }
      }
    }

    const result = applyGuardrails(rawText, sources, webResults);

    // Runs after the response is sent — doesn't add latency, but still
    // completes reliably server-side (unlike a bare unawaited promise).
    after(() =>
      logTranscript({
        id: messageId,
        conversationId: conversationId || "unknown",
        question,
        answer: result.text,
        status: result.status,
        citations: result.citations.map((c) => ({
          reference: c.source.reference,
          collection: c.source.collection,
          url: c.source.url,
        })),
        webSources: result.webSources,
        createdAt: Date.now(),
      }),
    );

    return NextResponse.json({
      id: messageId,
      reply: result.text,
      citations: result.citations.map((c) => ({ tag: c.tag, source: c.source })),
      webSources: result.webSources,
      status: result.status,
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "The assistant couldn't respond right now. Please try again." },
      { status: 502 },
    );
  }
}
