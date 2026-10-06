// POST /api/grade
// 1. Reads rubrics.json directly (same data the MCP server uses)
// 2. Grades the student answer via AI
// 3. Returns { verdict, feedback, concepts_present, concepts_missing, grade, subject, topic, studentAnswer }
//    — does NOT finalize yet. The client shows the result and asks for human approval first.
//    On approval the client calls /api/grade-finalize.

import { callClaude, parseJsonResponse } from "../../lib/claude";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// rubrics.json lives in grading-agent/ — two levels up from pages/api/
const RUBRICS_PATH = join(__dirname, "..", "..", "grading-agent", "rubrics.json");

const GRADING_SYSTEM = `You are the Homework Grading Agent for Ed Agent, an education platform for
Pakistan's Math and Physics curriculum, Grades 2-12.

You will receive:
- A rubric (expected_concepts, common_mistakes, sample_correct_answer)
- A student's submitted answer to a homework question

Your job:
1. Compare the student answer against expected_concepts — note which are present and which are missing.
2. Check for any common_mistakes the student fell into.
3. Produce a verdict: CORRECT, PARTIAL, or INCORRECT.
4. Write 2-3 sentences of specific feedback that MUST name at least one expected_concept or
   common_mistake by its actual name or content. Never give generic feedback like "good job"
   or "nice try" without citing the rubric.

Respond with ONLY a JSON object, no preamble, no markdown fences:
{
  "verdict": "CORRECT" | "PARTIAL" | "INCORRECT",
  "feedback": string,
  "concepts_present": string[],
  "concepts_missing": string[]
}`;

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

async function getRubric({ grade, subject, topic }) {
  const raw = await readFile(RUBRICS_PATH, "utf8");
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { grade, subject, topic, studentAnswer } = req.body || {};
  if (!grade || !subject || !topic || !studentAnswer?.trim()) {
    return res.status(400).json({ error: "grade, subject, topic and studentAnswer are required" });
  }

  // Step 1 — fetch rubric from local rubrics.json
  let rubric;
  try {
    rubric = await getRubric({ grade, subject, topic });
  } catch (err) {
    console.error("[grade] rubric read failed:", err.message);
    return res.status(500).json({ error: `Could not read rubric data: ${err.message}` });
  }

  if (rubric.error) {
    return res.status(404).json({
      error: rubric.error,
      available: rubric.available || [],
    });
  }

  // Step 2 — grade via AI
  const userMessage = `
Grade: ${grade}
Subject: ${subject}
Topic: ${topic}

Rubric:
Expected concepts: ${JSON.stringify(rubric.expected_concepts)}
Common mistakes: ${JSON.stringify(rubric.common_mistakes)}
Sample correct answer: ${rubric.sample_correct_answer}

Student's answer:
"${studentAnswer.trim()}"
`.trim();

  try {
    const text = await callClaude({
      system: GRADING_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 800,
      jsonMode: true,
    });
    const result = parseJsonResponse(text);

    return res.status(200).json({
      verdict: result.verdict,
      feedback: result.feedback,
      concepts_present: result.concepts_present || [],
      concepts_missing: result.concepts_missing || [],
      grade,
      subject,
      topic,
      studentAnswer: studentAnswer.trim(),
    });
  } catch (err) {
    console.error("[grade] AI grading failed:", err.message);
    return res.status(500).json({ error: err.message || "Grading failed" });
  }
}
