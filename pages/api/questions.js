import { callClaude, parseJsonResponse } from "../../lib/claude";

const SYSTEM = `You are the Assessment agent inside Ed Agent, an education platform for Pakistan's Math
and Physics curriculum, Grades 2-12. Given a grade, subject, topic, difficulty and count, generate a
mixed set of exam-quality questions appropriate for that grade.

Respond with ONLY a JSON object, no preamble, no markdown fences, matching exactly this shape:
{
  "questions": [
    { "type": "MCQ" | "Short" | "Long" | "Numerical" | "Conceptual", "text": string, "meta": string (skill/Bloom level tag) }
  ]
}
Vary the question types across the set. Keep difficulty consistent with the requested level.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { grade, subject, topic, difficulty, count } = req.body || {};
  if (!topic || !grade || !subject) {
    return res.status(400).json({ error: "grade, subject and topic are required" });
  }
  const n = Math.max(1, Math.min(10, parseInt(count, 10) || 5));

  try {
    const text = await callClaude({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Grade: ${grade}\nSubject: ${subject}\nTopic: ${topic}\nDifficulty: ${difficulty || "Mixed"}\nNumber of questions: ${n}`,
        },
      ],
      maxTokens: 2500,
    });
    const result = parseJsonResponse(text);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
