import { NextRequest, NextResponse } from "next/server";
import { getRecentTranscripts, getAllFeedback } from "@/lib/db";
import { filterInsightsRows, type InsightsRow } from "@/lib/insightsFilter";

export const runtime = "nodejs";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: InsightsRow[]): string {
  const header = ["Date", "Status", "Source", "Vote", "Question", "Answer", "Conversation ID", "Citations", "Web Sources"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const citations = r.citations.map((c) => `${c.collection} — ${c.reference}`).join("; ");
    const webSources = r.webSources.map((w) => w.url).join("; ");
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        r.status,
        r.source || "text",
        r.vote || "",
        r.question,
        r.answer,
        r.conversationId,
        citations,
        webSources,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requiredKey = process.env.INSIGHTS_KEY;
  const authorized = requiredKey ? searchParams.get("key") === requiredKey : false;
  if (!authorized) {
    return NextResponse.json({ error: "Invalid or missing key." }, { status: 401 });
  }

  const format = searchParams.get("format") === "json" ? "json" : "csv";

  const [transcripts, feedback] = await Promise.all([getRecentTranscripts(500), getAllFeedback()]);
  const voteById = new Map(feedback.map((f) => [f.messageId, f.vote]));
  const rows: InsightsRow[] = transcripts.map((t) => ({ ...t, vote: voteById.get(t.id) }));

  const filtered = filterInsightsRows(rows, {
    status: searchParams.get("status") || undefined,
    vote: searchParams.get("vote") || undefined,
    date: searchParams.get("date") || undefined,
    source: searchParams.get("source") || undefined,
  }, Date.now());

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(JSON.stringify(filtered, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="deen-guide-insights-${stamp}.json"`,
      },
    });
  }

  return new NextResponse(toCsv(filtered), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deen-guide-insights-${stamp}.csv"`,
    },
  });
}
