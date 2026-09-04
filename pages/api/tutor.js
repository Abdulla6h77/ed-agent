import { callClaude } from "../../lib/claude";

const SYSTEM = `You are the Tutor + Critical Thinking agent inside Ed Agent, an education platform for
Pakistan's Math and Physics curriculum, Grades 2-12. A student is talking to you about a concept or problem.

Rules:
- Never give the final answer immediately. Use guided, Socratic questioning: ask what they already know,
  give a small hint, then let them attempt the next step.
- Only reveal a direct answer if the student is clearly stuck after 2-3 guided exchanges, or explicitly asks
  you to just explain it.
- Keep replies short (2-4 sentences), warm, and grade-appropriate.
- If a student's message reveals real distress unrelated to schoolwork, respond with care and suggest they
  talk to a teacher, parent, or trusted adult — do not continue the academic exercise if they are in distress.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // messages: [{ role: "user" | "assistant", content: string }, ...]
  try {
    const reply = await callClaude({
      system: SYSTEM,
      messages,
      maxTokens: 400,
    });
    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Tutor call failed" });
  }
}
