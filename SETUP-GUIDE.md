# Ed Agent — Setup Guide (teammates)

Everything a new teammate needs to run this repo locally and demo it. Follow top to bottom
the first time; after that, the [Quick reference](#quick-reference) at the bottom is enough.

This repo contains **two separate things**:

| # | Thing | Port | What it is |
| --- | --- | --- | --- |
| 1 | **Next.js app** (`ed-agent-mvp/`) | 3000 | Lesson Planner, Question Generator, AI Tutor. Deploys to Vercel. |
| 2 | **TrueForge grading agent** (`ed-agent-mvp/grading-agent/`) | 8790 + 8941 | Agent that grades homework by calling a real MCP tool. Local demo only. |

> ⚠️ **Only `ed-agent-mvp/` is the real repo.** The outer `ED-AGENT/` folder is a different
> git repository and contains a gitlink. Run every git command from `ed-agent-mvp/`.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 18.17+ (22 LTS recommended) | Powers both the app and the MCP server |
| [WSL2](https://learn.microsoft.com/windows/wsl/install) | any recent Ubuntu | **Required for the grading agent only** |
| npm | 9+ | Ships with Node |

Check your install:

```bash
node -v
npm -v
```

### WSL + Node inside WSL

The grading agent needs Node **inside WSL** too, and it must be on the PATH for every new
shell. Using [nvm](https://github.com/nvm-sh/nvm) is the reliable way:

```bash
# inside WSL
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22
nvm alias default 22
```

Add the `source` line to `~/.bashrc` so it loads automatically:

```bash
echo 'source ~/.nvm/nvm.sh' >> ~/.bashrc
```

TrueForge requires **Node 22.14+**. Verify:

```bash
wsl -e bash -lc 'source ~/.nvm/nvm.sh && node -v'
```

---

## 2. Clone and install

```bash
git clone https://github.com/Abdulla6h77/ed-agent.git
cd ed-agent/ed-agent-mvp

npm install                    # the Next.js app
cd grading-agent && npm install && cd ..   # the MCP server
```

---

## 3. Configure the Next.js app

```bash
cp .env.example .env.local
```

Put **at least one** provider key in `.env.local`. Configuring more than one makes the app
more resilient — it automatically falls over when one is rate-limited.

### Option A — DashScope (Alibaba Cloud Model Studio) ✅ recommended

Sign up at https://bailian.console.alibabacloud.com/ and create an API key.

```bash
DASHSCOPE_API_KEY=sk-...
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

> ⚠️ **`DASHSCOPE_BASE_URL` must end in `/compatible-mode/v1`.** If you paste the
> `ws-gw*.maas.aliyuncs.com/api/v1` gateway URL instead, every request fails with a silent
> `DashScope API error (404)` and the app falls through to another provider. This is the
> single most common setup mistake here.

### Option B — Anthropic

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

### Option C — Google Gemini

```bash
GEMINI_API_KEY=...
```

> Gemini's free tier is a **quota of 20 requests/day per model** and often returns
> `429 ... retry in 7h`. Fine for development, unreliable for a demo.

### Optional — pin one provider

```bash
AI_PROVIDER=dashscope   # or: anthropic | gemini
```

### Run it

```bash
npm run dev
```

Open http://localhost:3000 and submit the Lesson Planner form. If you get a JSON response
with objectives and activities, your key is working.

> If Next.js prints `Port 3000 is in use, trying 3001 instead`, something else already holds
> 3000 — just use the port it prints.

---

## 4. Run the grading agent (TrueForge + MCP)

This part **must run inside WSL**, and both processes must run in the *same* WSL instance —
TrueForge cannot reach an MCP server on Windows `localhost`.

Two helper scripts handle nvm, proxy variables and the localhost allow-list:

```powershell
# terminal 1 — MCP server on :8941
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-mcp.sh

# terminal 2 — TrueForge on :8790
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-trueforge.sh
```

(Adjust `/mnt/d/...` to your own path — run `wslpath -w .` from the repo if unsure.)

Both scripts **detach**, so closing the terminal does not kill them.

### 4a. Configure the model provider

Open http://localhost:8790 → **Settings → Models** → pick Alibaba / Anthropic / Google →
**Configure** → paste the key → **Create**.

> TrueForge keeps provider credentials in its own settings. They are **separate** from the
> app's `.env.local` — you must configure the key in both places for both halves to work.

### 4b. Register the MCP connector

**Settings → Connectors → Add MCP Server**

| Field | Value |
| --- | --- |
| Name | `rubric` (must match `agent.json`) |
| URL | `http://localhost:8941/mcp` |
| Auth | none |

### 4c. Create the agent

Agents → **Create**, paste the contents of `grading-agent/agent.json`, or:

```bash
curl -X POST http://localhost:8790/api/v1/agents \
  -H 'content-type: application/json' \
## 5. Health checks

Run these before recording a demo. All three should behave as described:

```bash
# 1. TrueForge is up  -> 200 with a JSON agents list
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8790/api/v1/agents

# 2. TrueForge can reach the MCP connector -> lists get_rubric and finalize_grade
curl -s http://localhost:8790/api/v1/mcp-servers/rubric/tools

# 3. The Next.js app answers -> HTTP 200
curl -s -X POST http://localhost:3000/api/lesson-plan \
  -H 'Content-Type: application/json' \
  -d '{"topic":"Quadratic Equations","grade":"Grade 9","subject":"Mathematics"}'
```

> **`GET http://localhost:8941/mcp` returning `404` is expected and not a problem.**
> MCP speaks HTTP `POST`, so a `GET` has no route. Use checks 1 and 2 instead.

---

## 6. Demo script

**Part A — the web app** (http://localhost:3000)
1. Lesson Planner → generate a Grade 9 / Mathematics / Quadratic Equations plan.
2. Question Generator → produce exam-style questions.
3. AI Tutor → ask a question and show that it hints rather than dumping the answer.

**Part B — the agent** (http://localhost:8790)
1. Open `grading-agent` in the chat.
2. Send:
   > Grade 9, Mathematics, Quadratic Equations. Solve x² − 5x + 6 = 0.
   > Student answer: "x² − 5x + 6 = 0, divide both sides by x to get x − 5 + 6/x = 0, so x = 5."
3. Point at the **trace panel** — it should show:
   - `get_rubric` called with `grade=Grade 9, subject=Mathematics, topic=Quadratic Equations`
   - an `exec` call — the agent independently computed the real roots
   - a verdict of **INCORRECT** that names the specific mistake (dividing by `x` loses the
     `x = 0` root, and the real roots are 2 and 3 — not 5)
   - `finalize_grade` **pausing for human approval** ← the key moment
4. Click **Approve**, then show `grading-agent/finalized-grades.json` gained a new record.

The approval pause is the whole point of the demo — it's a tool call that **cannot** run
without a human saying yes.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `DashScope API error (404)` | Wrong base URL — missing `/compatible-mode/v1` | Use `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
## 8. Cleanup

```bash
# stop both grading-agent services (inside WSL)
wsl -e bash -lc 'pkill -f "mcp-server.mjs"; pkill -f trueforge; echo stopped'

# stop the Next.js dev server
# Ctrl+C in its terminal, or: taskkill /F /IM node.exe
```

Test artefacts written by the demo:

- `grading-agent/finalized-grades.json` — appended each time you approve a grade.
  Safe to delete; it regenerates on the next approval.
- Test sessions in TrueForge — delete from the Sessions view, or:
  `curl -X DELETE http://localhost:8790/api/v1/sessions/<id>`

---

## 9. Deploy to Vercel

The **Next.js app only** — the grading agent is local-only and does not deploy.

1. Push the repo to GitHub (see `README.md`).
2. Vercel → **Add New Project** → import `Abdulla6h77/ed-agent`.
3. Set **Root Directory** to `ed-agent-mvp`. The app is in a subfolder, so Vercel must be
   pointed at it explicitly.
4. Add at least one provider's env vars (details in [`README.md`](README.md#3-deploy-to-vercel)).
5. Deploy.

### Order of operations

**Push first, then set the env vars, then redeploy.** Vercel builds as soon as it sees the
push, and a missing key is a *runtime* failure — the build succeeds and every AI route
returns `500`. Add the vars, then **Deployments → ⋯ → Redeploy**.

Env var edits never affect the currently-live deployment, so always redeploy after changing
one. If you'd rather skip the broken first deploy, create the Vercel project and set the env
vars *before* connecting the repo.

---

## Quick reference

```bash
# app
cd ed-agent-mvp && npm run dev                      # http://localhost:3000

# grading agent (run each in its own terminal)
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-mcp.sh
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-trueforge.sh

# health
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8790/api/v1/agents   # 200
curl -s http://localhost:8790/api/v1/mcp-servers/rubric/tools                  # 2 tools

# git (always from ed-agent-mvp/, never the outer repo)
git add .
git commit -m "..."
git push origin main
```

## Where to look when something breaks

| File | Role |
| --- | --- |
| `lib/claude.js` | AI gateway — provider order, retries, failover, JSON parsing |
| `pages/api/*.js` | The three API routes; each parses request body and calls `callClaude` |
| `grading-agent/mcp-server.mjs` | The MCP server exposing `get_rubric` and `finalize_grade` |
| `grading-agent/agent.json` | TrueForge agent spec — model, instructions, MCP wiring, approvals |
| `grading-agent/rubrics.json` | The static rubric data the agent is graded against |
| `grading-agent/start-*.sh` | WSL startup scripts (nvm, proxies, localhost allow-list) |

| App returns `500`, log says "No AI provider configured" | No key in `.env.local` | Add a key, then restart `npm run dev` |
| `429 ... retry in 7h` | Gemini free-tier quota exhausted | Configure DashScope as a fallback provider |
| `Request failed (503): high demand` from the agent | Provider capacity, not your setup | Switch `model.name` in `agent.json` to a different model |
| `/api/v1/mcp-servers/rubric/tools` returns nothing | TrueForge's outbound-network guard blocked `localhost` | Start TrueForge via `start-trueforge.sh` (sets `OUTBOUND_URL_ALLOWED_HOSTS`) |
| Connector shows `rubric` but tool list is empty | MCP server not running, or running on Windows not WSL | Start it via `start-mcp.sh` inside WSL |
| `Port 3000 is in use` | Another dev server is running | Use the port Next.js prints, or kill the old process |
| Env var changed on Vercel but site still fails | Vercel applies env vars only to **new builds** | **Deployments → ⋯ → Redeploy** |

### Reading the logs

```bash
# inside WSL
tail -f ~/rubric-mcp.log     # MCP server
tail -f ~/trueforge.log      # TrueForge
```

---

  -d "$(jq -n --slurpfile m grading-agent/agent.json '{name:"grading-agent",manifest:$m[0].manifest}')"
```

If you use a different provider than `agent.json` assumes, update `model.name` to an FQN you
actually configured (format `<provider>/<model-name>`, e.g. `alibaba/qwen3-7-flash`). Push the
change with `PUT /api/v1/agents/<id>` sending **only** `{ "manifest": ... }` — `name` is
immutable and sending it returns `400 Unrecognized key`.

---
