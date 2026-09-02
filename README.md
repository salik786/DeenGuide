# Deen Guide — Musalah Event Islamic Knowledge Assistant

A source-grounded Islamic Q&A chatbot built for the Musalah community event (kids + adults).
It answers questions on **6 fixed topics only**, using **only** text pulled directly from
[Sunnah.com](https://sunnah.com) (Sahih al-Bukhari) and [Quran.com](https://quran.com)
(Saheeh International translation), and shows the exact reference for every answer.

## Why it's built this way (read this first)

This is a religious topic being shown to a real audience, including children, so the whole
design optimizes for **not hallucinating** over being clever:

1. **Fixed topic list, fixed source list.** The bot cannot roam across all of Islam — it only
   knows what's in `data/corpus/*.json`, one file per topic. Nothing else.
2. **Every source is a verbatim quote** pulled directly from Sunnah.com and Quran.com's own
   API/pages (see `data/corpus/*.json` — each entry has the Arabic, translation, exact
   hadith/ayah reference, and a link back to the original page).
3. **The whole topic's source list is given to Claude on every turn** (not fuzzy retrieval) —
   with only 2-5 sources per topic there's no need for embeddings, and this guarantees nothing
   relevant gets missed or half-remembered.
4. **The system prompt forbids outside knowledge** and requires a citation tag (`[S1]`, `[S2]`…)
   after every factual sentence. See `lib/systemPrompt.ts`.
5. **A code-level guardrail, not just a prompt.** `lib/guardrails.ts` parses the citation tags
   in Claude's reply and cross-checks them against the real source list. If Claude answers with
   zero valid citations (a sign it drifted off the provided sources), the app **overrides the
   reply** with a safe "I don't have a verified source for that — please ask a scholar" message
   instead of showing whatever Claude wrote. The citation cards shown in the UI are always
   rendered from our trusted JSON data, never from text Claude generated.
6. **Low temperature (0.2)** to reduce creative drift.
7. **`/scholar-review`** — a single page listing every source, per topic, in one place so an
   imam/scholar can read exactly what the bot is allowed to say *before* it goes live.

**This is a starting point, not a finished fatwa engine.** Please have a scholar go through
`/scholar-review` and the topic list below before the event, and treat anything not covered
there as "ask a human" by design.

## The 6 topics (v1)

1. **The Five Pillars** — Shahada, Salah, Zakat, Sawm, Hajj
2. **Prayer & Wudu** — how to perform ablution and the basics of Salah
3. **Ramadan & Fasting** — purpose and reward of fasting
4. **Prophet Muhammad ﷺ** — how revelation began, basic seerah facts
5. **Quran Basics** — Surah Al-Fatiha, how the Quran was first revealed
6. **Manners & Akhlaq** — kindness, honesty, hospitality (great for kids)

To add or edit a topic: edit `data/topics.json` and add a matching
`data/corpus/<topic-id>.json` file with verbatim, cited sources (same shape as the existing
files). Nothing else needs to change — the topic will automatically appear in the UI, the chat
API, and the scholar review page.

We deliberately did **not** include IslamQA.info or Yaqeen Institute citations in v1 (even
though they're solid, scholar-backed sources) because their content is longer-form and harder
to pull as short, literally-quotable snippets the same way hadith/ayah text can be. Once the
first two topics are scholar-approved, add IslamQA citations to `data/corpus/*.json` the same
way — just make sure each entry is a real quoted excerpt with a real URL, not a paraphrase.

## Setup

You'll need Node.js 18+.

```bash
npm install
cp .env.local.example .env.local
```

Then open `.env.local` and fill in:

- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com/> (powers the chat answers, using
  Claude Sonnet)
- `OPENAI_API_KEY` — from <https://platform.openai.com/> (powers voice input via Whisper and
  voice output via TTS)

**Never commit `.env.local` or paste real API keys into chat/commits** — it's already
git-ignored.

Run the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>. Open <http://localhost:3000/scholar-review> to see every source
the bot can use, grouped by topic — this is the page to send a scholar for review.

## How the conversation UI works

- **New Conversation** in the sidebar starts a fresh chat scoped to one topic you pick.
- Past conversations are listed in the sidebar and persist in the browser (`localStorage`) —
  clicking one continues exactly where it left off.
- Conversations are per-browser, not shared across devices — there's no login/backend database
  by design, since this is meant for an event kiosk, not multi-device sync. If you later want
  conversations to sync across devices, that needs a real database + auth layer, which is a
  bigger addition — ask if you want that built out.
- The trash icon on a conversation deletes it permanently (no undo).

## Voice chat

- Tap the microphone to record a question; it's transcribed via OpenAI Whisper and dropped into
  the text box for you to review/edit before sending (it does not auto-send, on purpose — for a
  sensitive topic like this, a human should always confirm what the bot heard).
- Tap "Listen" under any answer to hear it read aloud via OpenAI TTS.
- Voice input requires microphone permission and a browser that supports `MediaRecorder`
  (all modern browsers). It also requires HTTPS (or `localhost`) — browsers block mic access on
  plain HTTP.

## Deploying for the event

Any Node.js host that supports Next.js works (Vercel is the simplest — `vercel deploy` after
adding the two env vars in the project's dashboard). Whatever you use, set
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as server-side environment variables there, the same
as in `.env.local`.

## Project structure

```
data/topics.json           the 6 topics shown in the UI
data/corpus/*.json         verbatim, cited sources per topic — the ONLY facts the bot may use
lib/systemPrompt.ts        builds the strict, source-only system prompt sent to Claude
lib/guardrails.ts          post-response citation validation / safe-fallback logic
lib/corpus.ts              loads topics + corpus
lib/storage.ts             localStorage conversation persistence (client-side)
app/api/chat/route.ts      calls Claude Sonnet with the topic's sources only
app/api/voice/transcribe   OpenAI Whisper speech-to-text
app/api/voice/speak        OpenAI TTS text-to-speech
app/scholar-review/        read-only page listing every source for review
components/                UI: sidebar, chat view, message bubbles, citations, mic button
```
