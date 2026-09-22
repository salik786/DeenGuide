// Executes the evaluation session plan against the live chat API and writes
// one JSON line per run to data/eval/results/.
//
//   node scripts/run-eval.mjs                      # full 480-run study
//   node scripts/run-eval.mjs --sessions S01,S02   # just those sessions
//   node scripts/run-eval.mjs --limit 5            # smoke test: 5 runs
//   node scripts/run-eval.mjs --resume run-....jsonl
//   node scripts/run-eval.mjs --base https://musalah-event.vercel.app
//
// Questions inside one session are sent as a single accumulating
// conversation, so later questions carry the earlier turns as context —
// the same thing a real visitor's session does.
//
// Runs are key-gated with INSIGHTS_KEY so the API skips Insights logging.
// The results file here is the study's record; nothing touches the live
// dataset. Requires the dev server running (or --base pointing at a deploy).
import { readFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const evalDir = path.join(root, "data/eval");
const resultsDir = path.join(evalDir, "results");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("base", process.env.EVAL_BASE_URL || "http://localhost:3000");
const DELAY_MS = Number(arg("delay", "700"));
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const ONLY = arg("sessions") ? new Set(arg("sessions").split(",").map((s) => s.trim())) : null;

// Read the key straight from .env.local — the runner is a local dev tool and
// the key never leaves this machine except as a header to our own API.
function readEnvKey() {
  if (process.env.INSIGHTS_KEY) return process.env.INSIGHTS_KEY;
  try {
    const env = readFileSync(path.join(root, ".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.trim().startsWith("INSIGHTS_KEY="));
    return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const evalKey = readEnvKey();
if (!evalKey) {
  console.error(
    "No INSIGHTS_KEY found in env or .env.local.\n" +
      "Without it the API would log every eval run into Insights and contaminate the real dataset. Aborting.",
  );
  process.exit(1);
}

const bank = JSON.parse(readFileSync(path.join(evalDir, "question-bank.json"), "utf8"));
const plan = JSON.parse(readFileSync(path.join(evalDir, "session-plan.json"), "utf8"));
const byId = new Map(bank.questions.map((q) => [q.id, q]));

mkdirSync(resultsDir, { recursive: true });

// --- resume support -------------------------------------------------------
const resumeArg = arg("resume");
let outFile;
const done = new Set();
if (resumeArg) {
  const name = resumeArg === "latest"
    ? readdirSync(resultsDir).filter((f) => f.endsWith(".jsonl")).sort().pop()
    : resumeArg;
  if (!name) {
    console.error("Nothing to resume: no .jsonl files in data/eval/results/");
    process.exit(1);
  }
  outFile = path.join(resultsDir, name);
  if (existsSync(outFile)) {
    for (const line of readFileSync(outFile, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (!r.error) done.add(`${r.sessionId}#${r.position}`);
      } catch {
        // a torn final line from an interrupted run — it just gets redone
      }
    }
  }
  console.log(`Resuming ${name} — ${done.size} runs already complete.`);
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  outFile = path.join(resultsDir, `run-${stamp}.jsonl`);
}

const runId = path.basename(outFile, ".jsonl");
const sessions = plan.sessions.filter((s) => !ONLY || ONLY.has(s.sessionId));
const totalPlanned = sessions.reduce((n, s) => n + s.questionIds.length, 0);

console.log(`Base       ${BASE}`);
console.log(`Sessions   ${sessions.length}  (${totalPlanned} runs planned)`);
console.log(`Output     ${path.relative(root, outFile)}`);
console.log(`Logging    suppressed via evalKey — Insights will not see these\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const counts = { verified: 0, unverified: 0, declined: 0, error: 0 };
let executed = 0;
let matched = 0;
const startedAt = Date.now();

outer: for (const session of sessions) {
  // Fresh conversation per session; history accumulates across its questions.
  const history = [];
  const conversationId = `eval_${runId}_${session.sessionId}`;

  for (let position = 0; position < session.questionIds.length; position++) {
    if (executed >= LIMIT) break outer;

    const qid = session.questionIds[position];
    const q = byId.get(qid);
    if (!q) {
      console.error(`  ${session.sessionId}#${position} unknown question id ${qid} — skipping`);
      continue;
    }

    if (done.has(`${session.sessionId}#${position}`)) {
      // Already recorded, but the conversation still needs its turns so the
      // context later questions see matches the original run.
      history.push({ role: "user", content: q.question });
      history.push({ role: "assistant", content: "[replayed from earlier run]" });
      continue;
    }

    history.push({ role: "user", content: q.question });
    const t0 = Date.now();
    let record;

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          source: "text",
          evalKey,
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - t0;

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const actualTier = data.status;
      history.push({ role: "assistant", content: data.reply ?? "" });

      record = {
        runId,
        sessionId: session.sessionId,
        position,
        conversationId,
        questionId: qid,
        question: q.question,
        lang: q.lang,
        category: q.category,
        probeType: q.probeType,
        paraphraseGroup: q.paraphraseGroup,
        expectedTier: q.expectedTier,
        actualTier,
        tierMatch: actualTier === q.expectedTier,
        expectedSources: q.expectedSources,
        returnedSources: (data.citations ?? []).map((c) => c.source?.id).filter(Boolean),
        webSources: (data.webSources ?? []).map((w) => w.url),
        answer: data.reply ?? "",
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      counts[actualTier] = (counts[actualTier] ?? 0) + 1;
      if (record.tierMatch) matched++;
    } catch (err) {
      // Record the failure and carry on — one bad run shouldn't end the study.
      history.push({ role: "assistant", content: "" });
      counts.error++;
      record = {
        runId,
        sessionId: session.sessionId,
        position,
        questionId: qid,
        question: q.question,
        expectedTier: q.expectedTier,
        actualTier: null,
        tierMatch: false,
        error: String(err?.message ?? err),
        latencyMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      };
    }

    appendFileSync(outFile, JSON.stringify(record) + "\n");
    executed++;

    const mark = record.error ? "ERR " : record.tierMatch ? "ok  " : "MISS";
    const got = record.error ? record.error.slice(0, 40) : `${record.expectedTier}->${record.actualTier}`;
    const pct = Math.round((executed / Math.min(totalPlanned, LIMIT)) * 100);
    console.log(
      `[${String(pct).padStart(3)}%] ${session.sessionId}#${String(position).padStart(2)} ${mark} ${qid.padEnd(6)} ${got}`,
    );

    await sleep(DELAY_MS);
  }
}

const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
console.log(`\n${executed} runs in ${mins} min — ${matched} tier matches (${executed ? Math.round((matched / executed) * 100) : 0}%)`);
console.log(`Tiers returned: ${JSON.stringify(counts)}`);
console.log(`\nResults: ${path.relative(root, outFile)}`);
console.log(`Score with: node scripts/score-eval.mjs ${path.basename(outFile)}`);
if (counts.error > 0) {
  console.log(`\n${counts.error} run(s) errored — rerun with --resume ${path.basename(outFile)} to retry just those.`);
}
