# Ed Agent — MVP

Real AI-backed version of the three core flows (Lesson Planner, Question Generator, AI Tutor),
built on Next.js so it deploys straight from GitHub to Vercel with no server to manage.

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
# edit .env.local and paste your real key
npm run dev
```

Open http://localhost:3000

## 3. Deploy to Vercel

1. Push this folder to your GitHub repo (see commands below).
2. Go to https://vercel.com → **Add New Project** → import `Abdulla6h77/ed-agent`.
3. In **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` = your key (either works; Anthropic is used first if both are set)
4. Click **Deploy**. Vercel builds and gives you a live URL
   (e.g. `https://ed-agent.vercel.app`) in about a minute.
5. Every future `git push` to `main` auto-redeploys.

## Pushing this to your repo

```bash
cd ed-agent          # your cloned repo
# copy all the files from this project into the repo root
git add .
git commit -m "Real MVP: Next.js app with live AI for lesson planner, question generator, tutor"
git push origin main
```

## What's still mocked / simplified vs the full blueprint

- No database yet — nothing is saved between sessions (no learning profiles, no saved lessons).
- No auth — anyone with the URL can use it. Fine for interviews, not for a real pilot.
- No curriculum/RAG grounding yet — the model relies on its own knowledge, not your ingested
  curriculum documents. Add this once you validate the flows are useful (blueprint Section 11).
- Single AI call per action — no real Orchestrator/multi-agent routing yet. That's intentional:
  prove each flow works before adding orchestration complexity.
