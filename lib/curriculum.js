// Lightweight curriculum lookup — mirrors the JSON-lookup pattern proven in
// grading-agent/rubrics.json (normalize + bidirectional substring match).
// Deliberately structured-data grounding: no vectors, no embeddings, no search pipeline.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "curriculum.json");

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

// Returns the matching curriculum entry, or null when the topic is not in the
// curriculum database (callers must surface that honestly via a "grounded" flag).
export async function lookupCurriculum({ grade, subject, topic }) {
  const raw = await readFile(DATA_PATH, "utf8");
  const { curriculum } = JSON.parse(raw);

  const g = normalize(grade);
  const s = normalize(subject);
  const t = normalize(topic);

  return (
    curriculum.find((entry) => {
      const gradeOk = !g || normalize(entry.grade).includes(g) || g.includes(normalize(entry.grade));
      const subjectOk =
        !s || normalize(entry.subject).includes(s) || s.includes(normalize(entry.subject));
      const topicOk = !t || normalize(entry.topic).includes(t) || t.includes(normalize(entry.topic));
      return gradeOk && subjectOk && topicOk;
    }) || null
  );
}