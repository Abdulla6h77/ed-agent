# Ed Agent — MVP

AI-backed education platform for Pakistan's **Math & Physics curriculum (Grades 2–12)**,
built on Next.js so it deploys straight from GitHub to Vercel with no server to manage.

Three core flows, each powered by a live LLM call:

| Flow | API route | What it does |
| --- | --- | --- |
| Lesson Planner | `POST /api/lesson-plan` | Grade + subject + topic + duration → structured lesson plan (objectives, prerequisites, worked examples, activities, homework, real-world hook) |
| Question Generator | `POST /api/questions` | 1–10 exam-style questions (MCQ / Short / Long / Numerical / Conceptual) with skill/Bloom-level tags |
| AI Tutor | `POST /api/tutor` | Socratic tutor — hints before answers, short grade-appropriate replies, never dumps the solution |

## How the AI layer works (`lib/claude.js`)

- **Dual-provider, one code path.** `callClaude()` uses Anthropic (`claude-sonnet-5`) when
  `ANTHROPIC_API_KEY` is set, otherwise falls back to Google Gemini when `GEMINI_API_KEY` is set.
  If both are present, Anthropic wins. The three API routes don't know or care which provider ran.
- **Hardened JSON handling.** `parseJsonResponse()` strips markdown fences, extracts the JSON
  object even when the model wraps it in prose, and on failure throws an error that includes the
  first 300 chars of the raw response — a bad model output is self-explaining in the server logs.
- **Truncation-safe budgets.** The JSON-producing routes request 2500 output tokens so large
  payloads don't get cut off mid-object (the tutor route stays at 400 — its replies are short).
- Keys are read server-side only and never sent to the browser.

## Project structure

```
ed-agent-mvp/
├── pages/
│   ├── index.js              # single-page UI: Lesson Planner / Question Generator / AI Tutor tabs
│   └── api/
│       ├── lesson-plan.js    # POST /api/lesson-plan
│       ├── questions.js      # POST /api/questions
│       └── tutor.js          # POST /api/tutor
├── lib/
│   └── claude.js             # AI gateway: provider selection + JSON parsing
├── styles/globals.css
└── grading-agent/            # separate TrueForge slice — see below
```

## 1. Get an API key

Ed Agent needs one AI provider key — either works:

- Anthropic: sign up at https://console.anthropic.com and create an API key.
- Google Gemini: get a key at https://aistudio.google.com/apikey.

Set it as `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env.local` (see `.env.example`).
If both are present, Anthropic is used first. The key is used server-side only —
it's never exposed to the browser.

## 2. Run locally (optional, to test before deploying)

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste ONE key (ANTHROPIC_API_KEY or GEMINI_API_KEY)
npm run dev
```

Open http://localhost:3000

## 3. Deploy to Vercel

1. Push this repo to GitHub (commands below).
2. Go to https://vercel.com → **Add New Project** → import `Abdulla6h77/ed-agent`.
3. **Important:** set **Root Directory** to `ed-agent-mvp` — the app lives in that subfolder,
   not the repo root, so Vercel needs to find its `package.json` there.
4. In **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` **or** `GEMINI_API_KEY` = your key (either works; Anthropic is used
     first if both are set)
5. Click **Deploy**. Vercel builds and gives you a live URL
   (e.g. `https://ed-agent.vercel.app`) in about a minute.
6. Every future `git push` to `main` auto-redeploys.

## 4. Homework Grading Agent (TrueForge slice)

`grading-agent/` is a separate, self-contained demo built on the TrueForge agent harness
(https://trueforge.dev): an agent that grades a student's homework answer by calling a real
MCP tool (`get_rubric`), verifies numerical answers by **running code in a sandbox**, and
records the final grade through `finalize_grade` — a tool that **pauses for human
approval** before it actually runs.

It has its own MCP server and agent spec and shares no code with the Next.js app.
Setup, run, and test instructions: [`grading-agent/README.md`](grading-agent/README.md).

## Pushing to GitHub

```bash
git add .
git commit -m "Ed Agent MVP: Next.js app (dual-provider AI) + TrueForge grading agent"
git push origin main
```

Run these from the repo root. `.env.local` and `node_modules/` are gitignored and will not
be committed — double-check with `git status` before committing.

## What's still mocked / simplified vs the full blueprint

- No database yet — nothing is saved between sessions (no learning profiles, no saved lessons).
- No auth — anyone with the URL can use it. Fine for interviews, not for a real pilot.
- Partial curriculum grounding — Lesson Planner and Question Generator ground their output in
  `data/curriculum.json` for the topics listed there (responses carry a `"grounded"` flag);
  other topics fall back to model knowledge and are flagged `"grounded": false`. No RAG or
  vector search yet (blueprint Section 11).
- Single AI call per action — no real Orchestrator/multi-agent routing yet. That's intentional:
  prove each flow works before adding orchestration complexity.
