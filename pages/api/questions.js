import { callClaude, parseJsonResponse } from "../../lib/claude";
import { lookupCurriculum } from "../../lib/curriculum";

const SYSTEM = `You are the Assessment agent inside Ed Agent, an education platform for Pakistan's Math
and Physics curriculum, Grades 2-12. Given a grade, subject, topic, difficulty and count, generate a
mixed set of exam-quality questions appropriate for that grade.

Respond with ONLY a JSON object, no preamble, no markdown fences, matching exactly this shape:
{
  "questions": [
    { "type": "MCQ" | "Short" | "Long" | "Numerical" | "Conceptual", "text": string, "meta": string (skill/Bloom level tag) }
  ]
}
Vary the question types across the set. Keep difficulty consistent with the requested level.
If the user message includes curriculum grounding data, every question must test one of the
listed learning objectives or key concepts.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { grade, subject, topic, difficulty, count } = req.body || {};
  if (!topic || !grade || !subject) {
    return res.status(400).json({ error: "grade, subject and topic are required" });
  }
  const n = Math.max(1, Math.min(10, parseInt(count, 10) || 5));

  // Lightweight curriculum grounding: structured JSON lookup, no RAG.
  const grounding = await lookupCurriculum({ grade, subject, topic });
  const groundingBlock = grounding
    ? `\nCurriculum grounding data for this topic (official) — every question must test one of these:` +
      `\nlearning_objectives: ${JSON.stringify(grounding.learning_objectives)}` +
      `\nkey_concepts: ${JSON.stringify(grounding.key_concepts)}`
    : "";

  try {
    const text = await callClaude({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Grade: ${grade}\nSubject: ${subject}\nTopic: ${topic}\nDifficulty: ${difficulty || "Mixed"}\nNumber of questions: ${n}${groundingBlock}`,
        },
      ],
      maxTokens: 2500,
      jsonMode: true,
    });
    const result = parseJsonResponse(text);
    result.grounded = Boolean(grounding);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
