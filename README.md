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

- **Three providers, one code path.** `callClaude()` tries DashScope (Alibaba Cloud) →
  Anthropic (`claude-sonnet-5`) → Google Gemini, skipping any provider whose key is unset.
  The first configured key wins, or set `AI_PROVIDER=dashscope|anthropic|gemini` to pin one.
  The three API routes don't know or care which provider ran.
- **Hardened JSON handling.** `parseJsonResponse()` strips markdown fences, extracts the JSON
  object even when the model wraps it in prose, and on failure throws an error that includes the
  first 300 chars of the raw response — a bad model output is self-explaining in the server logs.
- **Reliability: retry with backoff.** Providers intermittently return `429`/`503` ("high
  demand"). Transient failures are retried up to 5 times with exponential backoff — harder
  backoff on `429`, since hammering a throttled key only extends the penalty.
- **Reliability: Gemini model failover.** Gemini's free tier is a quota of requests *per model*,
  so when the primary model hits its quota wall the request automatically fails over to the next
  model instead of erroring out.
- **No reasoning leaks.** Some Gemini models emit internal reasoning as separate parts flagged
  `thought: true`; only non-thought parts are ever returned. `thinkingLevel: "low"` also reduces
  the reasoning tokens that count against the output budget.
- **JSON is opt-in** (`jsonMode`) so only the JSON-producing routes force
  `responseMimeType: "application/json"` — the Tutor must answer in plain conversational text.
- **Truncation-safe budgets.** The JSON-producing routes request 2500 output tokens so large
  payloads don't get cut off mid-object (the tutor route stays at 800 — its replies are short).
- Keys are read server-side only and never sent to the browser.

## Work is never lost, and flows flow into each other

- **Results persist.** The tabs are conditionally rendered, so React unmounts a panel the moment
  you switch away from it — which would normally wipe the generated lesson, questions and tutor
  conversation. Everything is cached to `localStorage` via `lib/storage.js`, so results survive
  tab switches, a page refresh, and the navigation to `/grading-agent`. All reads are SSR-safe and
  wrapped in `try/catch`: a disabled or full storage degrades to "no cache", never to a crash.
- **Lesson plan → questions.** A generated lesson has a **"Generate questions from this plan →"**
  button. It carries the plan's grade/subject/topic across, attaches the plan itself, and
  `/api/questions` folds its objectives, worked examples and homework into the prompt alongside
  the curriculum grounding — so the questions test what was actually taught. Only those fields are
  forwarded (not the whole plan) to keep the prompt lean. A **"Use topic only"** link detaches the
  plan, and generating questions without a plan works exactly as before.

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
│   ├── claude.js             # AI gateway: provider selection + JSON parsing
│   ├── curriculum.js         # curriculum lookup that grounds generated content
│   └── storage.js            # SSR-safe localStorage helpers (result caching)
├── styles/globals.css
└── grading-agent/            # separate TrueForge slice — see below
```

## 1. Get an API key

Ed Agent needs **at least one** AI provider key — any of these work:

- **DashScope (Alibaba Cloud Model Studio):** sign up at https://bailian.console.alibabacloud.com/.
  Use the **OpenAI-compatible** endpoint. Set:
  ```
  DASHSCOPE_API_KEY=sk-...
  DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  DASHSCOPE_MODEL=qwen-plus
  ```
  ⚠️ The base URL **must** end in `/compatible-mode/v1`. The `ws-gw*.maas.aliyuncs.com/api/v1`
  gateway you see in some workspaces returns a bare `404`, which shows up in the terminal as
  `DashScope API error (404)` followed by a silent fall-through to the next provider.
- **Anthropic:** https://console.anthropic.com
- **Google Gemini:** https://aistudio.google.com/apikey

Put the key(s) in `.env.local` (see `.env.example`). Setting more than one makes the app more
reliable — if one provider is rate-limited or out of quota, the next one takes over
automatically. Keys are used server-side only and never exposed to the browser.

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
4. In **Environment Variables**, add at least one provider:
   - **DashScope:** `DASHSCOPE_API_KEY` **and** `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
     (optional: `DASHSCOPE_MODEL`)
   - **Anthropic:** `ANTHROPIC_API_KEY`
   - **Google Gemini:** `GEMINI_API_KEY`

   Configuring more than one is recommended — the app fails over automatically when one is
   throttled. Keys are scoped per environment (Production / Preview / Development), so paste
   the same value into each environment you need.

   > Set these **before** the first deploy if you can. If the deploy runs without a key, the
   > build still succeeds but every AI route returns `500` until you redeploy — see below.

5. Click **Deploy**. Vercel builds and gives you a live URL
   (e.g. `https://ed-agent.vercel.app`) in about a minute.
6. Every future `git push` to `main` auto-redeploys.

### Editing env vars later

Vercel applies environment variables **only to new builds** — editing a value does not change
the currently-live deployment. After saving a change, go to **Deployments → ⋯ → Redeploy**
(or push an empty commit) for it to take effect. This trips up most people: the value looks
saved in the dashboard but the site still uses the old key.

### Which order for a first deploy?

**Push first, then add the env vars, then redeploy.** This is the expected path:

1. `git push origin main` → Vercel picks it up and builds (fails at runtime, not build time).
2. Add the env vars in the dashboard.
3. **Deployments → ⋯ → Redeploy** to bake them in.

If you prefer to avoid the failed first deploy entirely, create the Vercel project and set
the env vars *first*, then connect the repo — Vercel will build once with the keys already in
place.

## 4. Homework Grading Agent (TrueForge slice)

`grading-agent/` is a separate, self-contained demo built on the TrueForge agent harness
(https://trueforge.dev): an agent that grades a student's homework answer by calling a real
MCP tool (`get_rubric`), verifies numerical answers by **running code in a sandbox**, and
records the final grade through `finalize_grade` — a tool that **pauses for human
approval** before it actually runs.

It has its own MCP server and agent spec and shares no code with the Next.js app.
Setup, run, and test instructions: [`grading-agent/README.md`](grading-agent/README.md).

---

## 📘 New here?

Full clone → configure → run → demo instructions live in
**[`SETUP-GUIDE.md`](SETUP-GUIDE.md)**. It covers WSL setup, provider keys (including the
DashScope base-URL gotcha), health checks, the demo script, troubleshooting and cleanup.

Want to understand **how it works under the hood** — the AI gateway, what each feature sends
to the model, how output is shaped, and a detailed walkthrough of the AI Tutor's prompt rules?
See **[`HOW-IT-WORKS.md`](HOW-IT-WORKS.md)**.


## Pushing to GitHub

```bash
git add .
git commit -m "Ed Agent MVP: Next.js app (dual-provider AI) + TrueForge grading agent"
git push origin main
```

Run these from  the repo root. `.env.local` and `node_modules/` are gitignored and will not
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
