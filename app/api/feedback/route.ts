import { NextRequest, NextResponse } from "next/server";
import { saveFeedback } from "@/lib/db";
import type { AnswerStatus, Vote } from "@/lib/types";

export const runtime = "nodejs";

interface FeedbackBody {
  messageId?: string;
  conversationId?: string;
  question?: string;
  answer?: string;
  status?: AnswerStatus;
  vote?: Vote;
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messageId, conversationId, question, answer, status, vote } = body;

  if (!messageId || !vote || (vote !== "up" && vote !== "down")) {
    return NextResponse.json({ error: "Missing messageId or a valid vote." }, { status: 400 });
  }

  await saveFeedback({
    messageId,
    conversationId: conversationId || "unknown",
    question: question || "",
    answer: answer || "",
    status: status || "declined",
    vote,
    createdAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
