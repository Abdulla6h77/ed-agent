// Ed Agent — Homework Grading rubric MCP server.
//
// TrueForge connects to MCP servers over HTTP, so this listens on a port and
// speaks the MCP streamable-HTTP transport at POST /mcp. It exposes two tools:
//   get_rubric(grade, subject, topic) — rubric lookup from static rubrics.json;
//   finalize_grade(...) — appends the final grading decision to finalized-grades.json.
// No external API, no key.
//
// Adapted from the TrueForge "bring-your-own-mcp" weather example:
// https://github.com/truefoundry/trueforge/tree/examples/agent-cookbook/examples/bring-your-own-mcp
// Everything below buildServer() is reusable unchanged.

/* global fetch, AbortSignal, URLSearchParams */
import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = Number(process.env.RUBRIC_MCP_PORT || 8941);
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Your data. This is the part you swap out. ------------------------------

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

async function getRubric({ grade, subject, topic }) {
  const raw = await readFile(join(__dirname, "rubrics.json"), "utf8");
  const { rubrics } = JSON.parse(raw);

  const g = normalize(grade);
  const s = normalize(subject);
  const t = normalize(topic);

  const match = rubrics.find((r) => {
    const gradeOk = !g || normalize(r.grade).includes(g) || g.includes(normalize(r.grade));
    const subjectOk = !s || normalize(r.subject).includes(s) || s.includes(normalize(r.subject));
    const topicOk = !t || normalize(r.topic).includes(t) || t.includes(normalize(r.topic));
    return gradeOk && subjectOk && topicOk;
  });

  if (!match) {
    return {
      error: `No rubric found for grade='${grade}', subject='${subject}', topic='${topic}'.`,
      available: rubrics.map((r) => `${r.grade} ${r.subject} — ${r.topic}`),
    };
  }

  return match;
}

async function finalizeGrade({ grade, subject, topic, student_answer, verdict, feedback }) {
  const storePath = join(__dirname, "finalized-grades.json");
  let entries = [];
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    if (Array.isArray(parsed)) entries = parsed;
  } catch {
    // First write (or unreadable store) — start a fresh list.
  }

  const record = {
    finalized_at: new Date().toISOString(),
    grade,
    subject,
    topic,
    student_answer,
    verdict: String(verdict || "").toUpperCase(),
    feedback,
  };
  entries.push(record);
  await writeFile(storePath, JSON.stringify(entries, null, 2) + "\n", "utf8");

  return {
    saved: true,
    total_finalized: entries.length,
    record,
  };
}

// --- MCP wiring. Reusable as-is for any single-tool server. -----------------

function buildServer() {
  const server = new McpServer(
    { name: "rubric", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "get_rubric",
    {
      title: "Get the grading rubric for a topic",
      description:
        "Returns the grading rubric for a given grade, subject, and topic as JSON. " +
        "The rubric contains expected_concepts (what a correct answer must cover), " +
        "common_mistakes (typical errors to watch for), and sample_correct_answer " +
        "(a fully worked reference answer). Call this BEFORE assessing a student's " +
        "homework answer so you can grade against specific criteria, not generic impressions. " +
        "Use exact values like grade='Grade 9', subject='Mathematics', topic='Quadratic Equations'.",
      inputSchema: {
        grade: z.string().min(1).describe("The grade level, e.g. 'Grade 9'."),
        subject: z.string().min(1).describe("The subject, e.g. 'Mathematics' or 'Physics'."),
        topic: z.string().min(1).describe("The topic, e.g. 'Quadratic Equations' or 'Newton\\'s Laws of Motion'."),
      },
    },
    async (args) => {
      const out = await getRubric(args);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
  );

  // Human-approval checkpoint: agent.json lists "finalize_grade" in
  // require_approval_for_tools, so TrueForge pauses here until the user
  // allows the call before it actually runs.
  server.registerTool(
    "finalize_grade",
    {
      title: "Record the final grade for a homework answer",
      description:
        "Persists the final grading decision to the grade store (finalized-grades.json). " +
        "Call this ONCE, after producing the verdict and feedback, with the exact data " +
        "you assessed: the student's answer verbatim, the verdict, and the feedback text. " +
        "This call requires human approval and pauses until the user allows it.",
      inputSchema: {
        grade: z.string().min(1).describe("The grade level, e.g. 'Grade 9'."),
        subject: z.string().min(1).describe("The subject, e.g. 'Mathematics' or 'Physics'."),
        topic: z.string().min(1).describe("The topic, e.g. 'Quadratic Equations'."),
        student_answer: z.string().min(1).describe("The student's submitted answer, verbatim."),
        verdict: z.enum(["CORRECT", "PARTIAL", "INCORRECT"]).describe("The final verdict."),
        feedback: z.string().min(1).describe("The feedback sentence(s) shown to the student."),
      },
      // Append-only store write: not read-only, not destructive. The approval
      // gate for this tool is enforced by name via require_approval_for_tools.
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => {
      const out = await finalizeGrade(args);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.type("text/plain").send("Rubric MCP. POST MCP requests to /mcp. Tools: get_rubric, finalize_grade.");
});

app.post("/mcp", async (req, res) => {
  // Stateless: a fresh server and transport per request, so there are no
  // sessions to track. Fine for tools that are plain request/response.
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[rubric-mcp] request failed:", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[rubric-mcp] listening on http://localhost:${PORT}/mcp`);
});
