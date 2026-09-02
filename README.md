# Deen Guide — Musalah Event Islamic Knowledge Assistant

An Islamic Q&A chatbot built for the Musalah community event (kids + adults), powered by Claude
Sonnet. It answers in one continuous conversation and labels every answer with how much to
trust it:

- **Verified** — grounded in a small, hand-picked, scholar-reviewable corpus of verbatim quotes
  from [Sunnah.com](https://sunnah.com) (Sahih al-Bukhari) and [Quran.com](https://quran.com)
  (Saheeh International translation). Every claim carries a citation back to the exact source.
- **Not verified** — a genuine Islamic question our corpus doesn't cover, answered from Claude's
  general knowledge, optionally checking a handful of trusted sites live (see below). Always
  shown with a visible "consult a scholar" badge — never presented as equivalent to Verified.
- **Declined** — anything unrelated to Islam, a request for a specific personal calculation or
  amount (Zakat owed, inheritance shares, etc.), a contested ruling that needs a scholar's
  judgment, or an attempt to bypass these rules. The app refuses outright rather than guess.

## Why it's built this way (read this first)

This is a religious topic being shown to a real audience, including children, so the whole
design optimizes for **not hallucinating with confidence** over being clever:

1. **A code-level guardrail, not just a prompt.** Claude is required to start every reply with a
   `[[VERIFIED]]`, `[[UNVERIFIED]]`, or `[[DECLINED]]` tag. `lib/guardrails.ts` parses that tag
   and does not just trust it: a `[[VERIFIED]]` claim with zero valid `[S#]` citations is
   downgraded to Not Verified in code, and a missing/malformed tag fails closed to Declined. The
   citation cards and status badges shown in the UI are always rendered from data we control
   (our JSON corpus, or real URLs the web_search tool actually returned), never from raw text
   Claude generated.
2. **Verified answers are locked to a fixed, verbatim corpus.** `data/corpus/*.json` holds
   hand-picked quotes (Arabic, translation, exact hadith/ayah reference, link to the original
   page) — see `/scholar-review` to read every one of them in one place before this goes live.
   Claude is explicitly told not to use web search or general knowledge for a `[[VERIFIED]]`
   response; it's the static corpus or nothing.
3. **Not-verified answers can use live web search, but only on 6 trusted domains.** See
   `TRUSTED_SEARCH_DOMAINS` in `lib/systemPrompt.ts`: sunnah.com, quran.com, islamqa.info,
   islamweb.net, seekersguidance.org, yaqeeninstitute.org. The Anthropic `web_search_20260209`
   server tool is domain-restricted to exactly that list (`allowed_domains`), so even an
   unverified answer can only ever cite a real page from a source we picked in advance — never
   an arbitrary site. Real URLs found are shown under "Checked while answering."
4. **The model is told never to fabricate a specific reference or number.** Under
   `[[UNVERIFIED]]`, it must not state a precise hadith number/narrator chain from memory (only
   from an actual search result), and must always decline (not guess) at any specific personal
   calculation or amount, or a ruling scholars genuinely disagree on — see rules 2–3 in
   `lib/systemPrompt.ts`.
5. **`/scholar-review`** — a page listing every verified-tier source, grouped by topic, so an
   imam/scholar can read exactly what the bot's highest-trust tier is allowed to say *before* it
   goes live.

**This is a starting point, not a finished fatwa engine.** Please have a scholar go through
`/scholar-review` before the event, and treat the Not Verified tier as "a helpful pointer,
always followed by ask a human" by design, not as a second source of authority.

## The starting corpus topics

The verified-tier corpus started from 4 topics: **The Five Pillars**, **Prayer & Wudu**,
**Ramadan & Fasting**, and **Manners & Akhlaq** — see `data/topics.json`. These only shape the
*suggested* questions shown in the UI and the initial verified corpus; since the assistant now
answers broader Islamic questions too (via the Not Verified tier), they're a starting point, not
a hard boundary.

To add a verified source: add a matching entry to `data/corpus/<topic-id>.json` with a real
quoted excerpt and a real URL (same shape as existing entries), or add a new topic file and
register it in `data/topics.json` + `lib/corpus.ts`'s `CORPUS_BY_TOPIC` map. Nothing else needs
to change — it's picked up by the chat API and the scholar review page automatically.

`scripts/verify-questions.mjs` re-checks that every sample question in `data/topics.json` still
gets a real Verified answer (useful after editing the corpus or the system prompt).
`scripts/quality-check.mjs` runs a broad mix of on-topic, rephrased, out-of-scope, calculation,
and adversarial questions for manual review — not a pass/fail gate, just a quick way to eyeball
answer quality across the board. Both require the dev server running on `localhost:3000`.

## Setup

You'll need Node.js 18+.

```bash
npm install
cp .env.local.example .env.local
```

Then open `.env.local` and fill in:

- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com/> (powers chat answers and web
  search, using Claude Sonnet)
- `OPENAI_API_KEY` — from <https://platform.openai.com/> (powers voice input via Whisper and
  voice output via TTS)

**Never commit `.env.local` or paste real API keys into chat/commits** — it's already
git-ignored (`.env.local.example`, the template with no real values, is intentionally tracked).

Run the dev server:

```bash
npm run dev
```

Open <http://localhost:3000> (redirects to `/home`). Open
<http://localhost:3000/scholar-review> to see every verified-tier source, grouped by topic —
this is the page to send a scholar for review.

## Routes

- `/home` — landing page: Bismillah, disclaimer, "Start a New Conversation," and topic cards
  that jump straight into a starter question.
- `/chat` — the actual conversation UI: sidebar with past conversations, the message thread,
  and the input box (text + voice).
- `/scholar-review` — read-only list of every verified-tier source.
- `/insights?key=...` — every question asked and every 👍/👎, across all browsers/devices (not
  just yours) — see "Insights" below.
- `/` redirects to `/home` (see `next.config.ts`).

## Insights (transcript log + feedback)

Every question sent to `/api/chat` is logged server-side (question, answer, status, citations,
web sources), and every 👍/👎 tap under an answer is saved too — both in Upstash Redis (the
service Vercel now sells as "Vercel KV"), so you can see what other people ask/rate even when
they're on a different device than you.

**Setup:** in your Vercel project, go to Storage → Marketplace → add an Upstash Redis database,
then copy the REST URL and token it gives you into `.env.local` as `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` (works locally against the same remote database — no separate local
Redis needed). Also set `INSIGHTS_KEY` to any string of your choosing. Without these three env
vars, the app still works completely normally — logging and feedback just silently no-op, and
`/insights` shows a "not configured" message instead of erroring.

**Viewing it:** open `/insights?key=<your INSIGHTS_KEY>`. This is not linked from anywhere in
the app UI on purpose — treat the URL like a password and don't share it publicly, since it
shows real questions people asked. The page is a filterable, paginated table (by status, by
👍/👎, by date range); each row has a 👁 to view that question in the context of its full
conversation (`/insights/conversation/[id]`, with the complete answer text and sources), and a
🗑 to permanently delete that row (both its transcript entry and any feedback on it).

## How the conversation UI works

- **New Conversation** starts a fresh, topic-agnostic chat — any of the three answer tiers can
  come up in the same thread as the conversation moves between subjects.
- Past conversations are listed in the sidebar and persist in the browser (`localStorage`) —
  clicking one continues exactly where it left off. The active conversation id also persists
  (`lib/storage.ts`), so a full page reload lands back on the same thread.
- Conversations are per-browser, not shared across devices — there's no login/backend database
  by design, since this is meant for an event kiosk, not multi-device sync. If you later want
  conversations to sync across devices, that needs a real database + auth layer, which is a
  bigger addition — ask if you want that built out.
- The trash icon on a conversation deletes it permanently (no undo).
- When the assistant declines to answer, it shows a few randomly-picked, pre-verified sample
  questions ("Things I can help with") so the conversation doesn't dead-end.

## Voice chat

- Tap the microphone to record a question; it's transcribed via OpenAI Whisper and dropped into
  the text box for you to review/edit before sending (it does not auto-send, on purpose — for a
  sensitive topic like this, a human should always confirm what the bot heard).
- Tap "Listen" under any answer to hear it read aloud via OpenAI TTS.
- Voice input requires microphone permission and a browser that supports `MediaRecorder`
  (all modern browsers). It also requires HTTPS (or `localhost`) — browsers block mic access on
  plain HTTP.

## Cost: prompt caching

The system prompt (topic list + full corpus + all the rules) is identical on every single
request — it's rebuilt from the same static JSON every time, never varies per user or message.
`app/api/chat/route.ts` marks it with `cache_control: { type: "ephemeral" }`, so Anthropic
caches that whole block (currently ~12,800 tokens) and reuses it across requests at roughly
1/10th the cost, instead of reprocessing it from scratch on every chat turn. The server logs
`[cache] read=... write=... uncached=... output=...` for every request — `read` should be
nonzero (and `write` zero) on any request that lands within ~5 minutes of a prior one, which is
the normal case once the app has any real traffic.

## Deploying for the event

Any Node.js host that supports Next.js works (Vercel is the simplest — `vercel deploy` after
adding the two env vars in the project's dashboard). Whatever you use, set
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as server-side environment variables there, the same
as in `.env.local`.

## Project structure

```
data/topics.json           starting topics (sample questions + verified corpus grouping)
data/corpus/*.json         verbatim, cited sources — the ONLY facts a Verified answer may use
lib/systemPrompt.ts        builds the system prompt (three-tier rules, trusted search domains)
lib/guardrails.ts          parses the [[VERIFIED/UNVERIFIED/DECLINED]] tag, enforces it in code
lib/corpus.ts              loads topics + corpus, builds the full deduped source list
lib/storage.ts             localStorage conversation + active-conversation persistence
lib/hijri.ts                Hijri/Gregorian date helper (client-side, post-mount)
lib/db.ts                  Upstash Redis client — transcript log + feedback (no-ops if unset)
app/api/chat/route.ts      calls Claude Sonnet with the corpus + a domain-restricted web_search tool
app/api/feedback/route.ts  saves a 👍/👎 vote for one answer
app/api/voice/transcribe   OpenAI Whisper speech-to-text
app/api/voice/speak        OpenAI TTS text-to-speech
app/home/                  landing page
app/chat/                  the conversation shell (sidebar + chat view)
app/scholar-review/        read-only page listing every verified-tier source
app/insights/              key-gated, filterable/paginated table of every question + vote
app/insights/conversation/ view one full conversation thread (from an Insights row's 👁)
app/api/insights/delete    deletes one Insights row (transcript + its feedback)
components/                UI: sidebar, chat view, message bubbles, citations, mic button
scripts/                   dev-only tools: verify-questions.mjs, quality-check.mjs
```
