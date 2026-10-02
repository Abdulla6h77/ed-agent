# Ed Agent — Homework Grading Agent (TrueForge slice)

A narrow, testable slice of Ed Agent for a hackathon: a TrueForge agent that
grades a student's homework answer by calling a **real MCP tool** (`get_rubric`)
and grounding its feedback in that rubric data. No UI, no tutoring — just the
judged requirement: agent + genuine tool use, plus a sandboxed code-execution
check for numerical answers.

## What's in this folder

| File | Purpose |
| --- | --- |
| `mcp-server.mjs` | The custom MCP server (streamable-HTTP at `POST /mcp`). Exposes two tools: `get_rubric(grade, subject, topic)` and `finalize_grade(grade, subject, topic, student_answer, verdict, feedback)`, which appends the decision to `finalized-grades.json`. |
| `rubrics.json` | Static rubric data backing the tool. Has entries for **Grade 9 Mathematics — Quadratic Equations** and **Grade 9 Physics — Newton's Laws of Motion**. |
| `package.json` | Node deps for the MCP server. |
| `agent.json` | TrueForge agent spec: Grading Agent, attaches the `rubric` connector, sandbox on (code-execution verification of numerical answers), `finalize_grade` requires human approval. |

## 1. Prerequisites

**Node.js 22.14+** and **WSL2**. Both services must run inside WSL in the *same* network
namespace — TrueForge (in WSL) cannot reach an MCP server listening on Windows `localhost`.

```bash
# inside WSL
source ~/.nvm/nvm.sh
node -v   # must print v22.14.0 or newer
```

## 2. Configure a model provider

TrueForge stores provider keys in **its own settings**, not in the app's `.env.local`:

1. Start TrueForge once (step 3).
2. **Settings → Models** → pick a provider (Alibaba / Anthropic / Google) → **Configure**.
3. Paste the key → **Create**.

Check what got configured:

```bash
curl -s http://localhost:8790/api/v1/settings/model-providers
```

> `agent.json` currently pins `alibaba/qwen3-7-flash`. If you configured a different
> provider, change `model.name` to an FQN you actually created (format
> `<provider>/<model-name>`, e.g. `alibaba/qwen3-7-flash`), then push the update:
> `PUT /api/v1/agents/<id>` with **only** `{ "manifest": ... }` — `name` is immutable.

## 3. Start both services

Two scripts handle nvm, proxy cleanup and the localhost allow-list. Run each in its own
PowerShell terminal:

```powershell
# terminal 1 — MCP server on :8941
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-mcp.sh

# terminal 2 — TrueForge on :8790
wsl -e bash /mnt/d/project/ED-AGENT/ed-agent-mvp/grading-agent/start-trueforge.sh
```

Both detach, so closing the terminal does not kill them. Logs are at `~/rubric-mcp.log`
and `~/trueforge.log` inside WSL.

Health-check:

```bash
curl -s http://localhost:8790/api/v1/agents
```

> A `GET /mcp` returning **404 is expected** — MCP only answers `POST`. Use the
> handshake or the connector endpoint in step 4 to confirm it is really up.

## 4. Register the MCP server in TrueForge

1. **Settings → Connectors → Add MCP Server**.
2. Name: `rubric` (must match the name in `agent.json`).
3. URL: `http://localhost:8941/mcp`.
4. Auth: none.
5. Save. It should move to **Configured**.

Verify TrueForge can actually reach it — this lists both tools:

```bash
curl -s http://localhost:8790/api/v1/mcp-servers/rubric/tools
```

You should see `get_rubric` and `finalize_grade`. If this errors, TrueForge's
outbound-network guard blocked the call — make sure you started it with
`start-trueforge.sh`, which sets `OUTBOUND_URL_ALLOWED_HOSTS=["localhost","127.0.0.1"]`.

## 5. Create the Grading Agent

Either paste `agent.json` in the UI (Agents → Create → paste spec), or POST it:

```bash
curl -X POST http://localhost:8790/api/v1/agents \
  -H 'content-type: application/json' \
  -d "$(jq -n --slurpfile m agent.json '{name:"grading-agent",manifest:$m[0].manifest}')"
```

## 6. Test it (the judged requirement)

In the chat, send a student answer like:

> Grade 9, Mathematics, Quadratic Equations. Solve x² − 5x + 6 = 0.
> Student answer: "x² − 5x + 6 = 0, so (x − 2)(x − 3) = 0 and x = 2 or x = 3."

**Pass criteria (step 5 of the brief):**
- The trace/Agent-steps panel shows a **`get_rubric` tool call** with args `grade=Grade 9, subject=Mathematics, topic=Quadratic Equations`.
- The agent's reply is a short assessment with a verdict (CORRECT / PARTIAL / INCORRECT) **and** one sentence naming a specific `expected_concept` or `common_mistake` from the rubric (e.g. referencing "relating roots to x-intercepts" or "dropping the +/-").
- The feedback is **not** generic ("good job", "nice try").

Try a wrong answer too, e.g.:
> Student answer: "x² − 5x + 6 = 0, divide by x to get x − 5 + 6/x = 0, so x = 5."
The agent should flag the missing expected concepts and ideally name the
"cancelling x incorrectly... losing the x = 0 root" mistake.

## Notes / scope

- This is a deliberately narrow slice. Sandbox is on for numerical verification;
  `finalize_grade` pauses for human approval before it runs. The Next.js
  frontend is a separate future session.
- The MCP server is stateless and keyless; rubrics are local static data.
- To add more topics, append entries to `rubrics.json` following the same shape.
