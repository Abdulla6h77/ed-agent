// POST /api/grade-finalize
// Called after the user clicks "Approve & Save".
// Appends the grading decision directly to grading-agent/finalized-grades.json
// (same file the MCP finalize_grade tool writes to).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRADES_PATH = join(__dirname, "..", "..", "grading-agent", "finalized-grades.json");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { grade, subject, topic, studentAnswer, verdict, feedback } = req.body || {};
  if (!grade || !subject || !topic || !studentAnswer || !verdict || !feedback) {
    return res.status(400).json({ error: "All fields are required to finalize a grade" });
  }

  try {
    let entries = [];
    try {
      const raw = await readFile(GRADES_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      // File doesn't exist yet — start fresh
    }

    const record = {
      finalized_at: new Date().toISOString(),
      grade,
      subject,
      topic,
      student_answer: studentAnswer,
      verdict: String(verdict).toUpperCase(),
      feedback,
    };
    entries.push(record);
    await writeFile(GRADES_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");

    return res.status(200).json({ saved: true, total_finalized: entries.length });
  } catch (err) {
    console.error("[grade-finalize] failed:", err.message);
    return res.status(500).json({ error: `Could not save grade: ${err.message}` });
  }
}
