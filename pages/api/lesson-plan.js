import { callClaude, parseJsonResponse } from "../../lib/claude";
import { lookupCurriculum } from "../../lib/curriculum";

const SYSTEM = `You are the Curriculum + Tutor agent inside Ed Agent, an education platform for Pakistan's
Math and Physics curriculum, Grades 2-12. Given a grade, subject, topic and duration, produce a lesson
plan appropriate for that grade level.

If the user message includes curriculum grounding data, the plan's learning objectives and
prerequisites MUST be drawn from that data (adapt the wording to the requested duration), and
the examples and activities must teach its key concepts — do not invent your own.

Respond with ONLY a JSON object, no preamble, no markdown fences, matching exactly this shape:
{
  "title": string,
  "objectives": string[3],
  "prerequisites": string[2-4],
  "explanation": string (2-4 sentences, grade-appropriate),
  "examples": string[2-3] (worked examples with numbers/steps where relevant),
  "activities": string[2] (in-class activities),
  "homework": string[2],
  "realworld": string (1-2 sentences connecting the topic to real life)
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { grade, subject, topic, duration } = req.body || {};
  if (!topic || !grade || !subject) {
    return res.status(400).json({ error: "grade, subject and topic are required" });
  }

  // Lightweight curriculum grounding: structured JSON lookup, no RAG.
  const grounding = await lookupCurriculum({ grade, subject, topic });
  const groundingBlock = grounding
    ? `\nCurriculum grounding data for this topic (official):` +
      `\nlearning_objectives: ${JSON.stringify(grounding.learning_objectives)}` +
      `\nprerequisites: ${JSON.stringify(grounding.prerequisites)}` +
      `\nkey_concepts: ${JSON.stringify(grounding.key_concepts)}`
    : "";

  try {
    const text = await callClaude({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Grade: ${grade}\nSubject: ${subject}\nTopic: ${topic}\nDuration: ${duration || 40} minutes${groundingBlock}`,
        },
      ],
      maxTokens: 2500,
      jsonMode: true,
    });
    const lesson = parseJsonResponse(text);
    lesson.grounded = Boolean(grounding);
    return res.status(200).json(lesson);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
