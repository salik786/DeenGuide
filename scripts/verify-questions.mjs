// Sanity check: every sample question in data/topics.json should get a real,
// cited (non-refused) answer from the live API. Run this after adding a
// question to topics.json or changing the corpus/system prompt.
//
//   node scripts/verify-questions.mjs
//
// Requires the dev server running on localhost:3000.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const topics = JSON.parse(readFileSync(path.join(root, "data/topics.json"), "utf8"));

const questions = topics.flatMap((t) => t.sampleQuestions.map((q) => ({ topic: t.shortName, question: q })));

let failures = 0;

for (const { topic, question } of questions) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
  });
  const data = await res.json();
  const ok = res.ok && !data.outOfScope && (data.citations?.length ?? 0) > 0;
  console.log(`${ok ? "PASS" : "FAIL"}  [${topic}] ${question}`);
  if (!ok) {
    failures++;
    console.log(`      -> ${data.reply ?? data.error}`);
  }
}

console.log(`\n${questions.length - failures}/${questions.length} passed.`);
if (failures > 0) process.exit(1);
