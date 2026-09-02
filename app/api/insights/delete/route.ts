import { NextRequest, NextResponse } from "next/server";
import { deleteInsightRow } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const id = formData.get("id");
  const key = formData.get("key");
  const returnTo = formData.get("returnTo");

  const requiredKey = process.env.INSIGHTS_KEY;
  if (!requiredKey || key !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  await deleteInsightRow(id);

  const redirectUrl = typeof returnTo === "string" && returnTo.startsWith("/insights") ? returnTo : "/insights";
  return NextResponse.redirect(new URL(redirectUrl, req.url), { status: 303 });
}
