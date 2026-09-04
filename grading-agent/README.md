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

## 1. Install & run TrueForge (local mode)

Requires Node.js 22.14+. In a terminal:

```bash
npx @truefoundry/trueforge@latest
```

Open http://localhost:8790. You should see the chat UI.

## 2. Add the Anthropic model provider

1. In TrueForge: **Settings → Models**.
2. Find **Anthropic** in the catalog, click **Configure**, paste your API key, click **Create**.
3. Models from Anthropic become available immediately.

(If you were given the key as an env var, paste its value into the box above —
TrueForge stores provider credentials in Settings, not in agent files.)

## 3. Start the rubric MCP server

In a **second terminal**, from this folder:

```bash
cd grading-agent
npm install
npm start
```

It serves the MCP at `http://localhost:8941/mcp` and prints a confirmation line.

## 4. Register the MCP server in TrueForge

1. **Settings → Connectors → Add MCP Server**.
2. Name: `rubric` (must match the name in `agent.json`).
3. URL: `http://localhost:8941/mcp`.
4. Auth: none.
5. Save. It should move to **Configured**.

## 5. Create the Grading Agent

Either paste `agent.json` via the UI (Create Agent → paste spec), or POST it:

```bash
curl -X POST http://localhost:8790/api/v1/agents \
  -H 'content-type: application/json' \
  -d "{\"name\":\"edagent-grading\",\"manifest\":$(cat agent.json)}"
```

Then open a session with it (Agents Library → Try, or just chat with it).

> The `model.name` in `agent.json` is `anthropic/claude-sonnet-4-6`. Change it in
> the UI if your configured Anthropic model has a different FQN.

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
