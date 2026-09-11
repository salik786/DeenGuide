import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { logTranscript } from "@/lib/db";

export const runtime = "nodejs";

/** Logs one Q&A turn from an /openvoice live session to the same Insights
 * store /chat and /voice use, tagged source: "openvoice" and always
 * status: "unverified" — there is no code-level guardrail on this page
 * (see lib/openvoicePrompt.ts), so nothing logged here should ever be
 * shown as "Verified" the way a guardrail-checked Claude answer can be. */
export async function POST(req: NextRequest) {
  let body: { conversationId?: string; question?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { conversationId, question, answer } = body;
  if (!conversationId || !question || !answer) {
    return NextResponse.json({ error: "Missing conversationId, question, or answer." }, { status: 400 });
  }

  await logTranscript({
    id: randomUUID(),
    conversationId,
    question,
    answer,
    status: "unverified",
    citations: [],
    webSources: [],
    source: "openvoice",
    createdAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
