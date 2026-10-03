import { useState, useRef, useEffect } from "react";
import { readStore, writeStore, clearStore } from "../lib/storage";

// Option lists for the Question Generator's dropdowns. Kept here (rather than inline)
// because a lesson plan handed off from the Lesson Planner can only be applied to the
// form when its grade/subject actually exist as options — Lesson Planner offers
// Grade 7-11, and this list stops at Grade 10, so a Grade 11 lesson must not clobber
// the field with a value the select cannot display.
const QGEN_GRADES = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const QGEN_SUBJECTS = ["Mathematics", "Physics"];

// Key used to hand a freshly generated lesson from the Lesson Planner to the
// Question Generator. Cleared on read so it only ever fires once.
const HANDOFF_KEY = "handoff:lesson";

export default function Home() {
  const [tab, setTab] = useState("planner");
  // Gate writes until the cached tab has been read back, otherwise the persist effect
  // would run on mount and overwrite the stored value before it is restored.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readStore("tab", null);
    if (saved === "planner" || saved === "questions" || saved === "tutor") setTab(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStore("tab", tab);
  }, [tab, hydrated]);

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">Ed Agent</span>
          <span className="brand-sub">MVP · Math &amp; Physics · Grades 7–11</span>
        </div>
        <div className="hero-strip">
          <h2>Your AI teaching assistant</h2>
          <p>Ed Agent helps teachers plan lessons, generate questions, and tutor students — powered by AI, grounded in curriculum.</p>
        </div>
        <nav className="tabs">
          {[
            ["planner", "Lesson Planner"],
            ["questions", "Question Generator"],
            ["tutor", "AI Tutor"],
            ["grading", "Grading Agent"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`tab${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        <div className="tab-content tab-enter" key={tab}>
          {tab === "planner" && <LessonPlanner onGoToQuestions={() => setTab("questions")} />}
          {tab === "questions" && <QuestionGenerator />}
          {tab === "tutor" && <Tutor />}
          {tab === "grading" && <GradingAgent />}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

function Underline() {
  return (
    <svg className="underline" viewBox="0 0 200 8" preserveAspectRatio="none">
      <path d="M0 5 Q 50 0, 100 5 T 200 5" stroke="#C68A3D" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function LessonPlanner({ onGoToQuestions }) {
  const [grade, setGrade] = useState("Grade 9");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Quadratic Equations");
  const [duration, setDuration] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState(null);

  // Restore the last generated plan on mount. Reading in an effect (not during
  // render) keeps it safe from server-side rendering, where localStorage is absent.
  useEffect(() => {
    const cached = readStore("lesson", null);
    if (cached) setLesson(cached);
  }, []);

  useEffect(() => {
    if (lesson) writeStore("lesson", lesson);
  }, [lesson]);

  async function generate() {
    setLoading(true);
    setError("");
    setLesson(null);
    try {
      const res = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic, duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setLesson(data);
    } catch {
      setError("The lesson plan wasn't generated. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Hand the plan to the Question Generator. The inputs travel with it because the
  // lesson API response doesn't echo back grade/subject/topic.
  function handOffToQuestions() {
    writeStore(HANDOFF_KEY, { grade, subject, topic, lesson });
    onGoToQuestions();
  }

  return (
    <section aria-busy={loading}>
      <h1 className="page-title">AI Lesson Planner<Underline /></h1>
      <p className="page-desc">Pick a grade, subject and topic — Ed Agent drafts a full lesson you can edit before saving.</p>
      <div className="form-card" aria-busy={loading}>
        <div className="field-row">
          <Field label="Grade">
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option>Mathematics</option>
              <option>Physics</option>
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Topic" wide>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic Equations" />
          </Field>
          <Field label="Duration (mins)">
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <button type="button" className="btn" onClick={generate} disabled={loading}>
          {loading && <svg className="spinner-svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" /><path d="M14 8a6 6 0 0 0-6-6" stroke="var(--chalk-green)" strokeWidth="2.5" strokeLinecap="round" /></svg>}
          {loading ? "Generating…" : "Generate Lesson"}
        </button>
      </div>
      {loading && (
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-bar skeleton-heading" />
          <div className="skeleton-group"><div className="skeleton-bar skeleton-label" /><div className="skeleton-bar skeleton-line w80" /><div className="skeleton-bar skeleton-line w65" /><div className="skeleton-bar skeleton-line w90" /></div>
          <div className="skeleton-group"><div className="skeleton-bar skeleton-label" /><div className="skeleton-bar skeleton-line w75" /><div className="skeleton-bar skeleton-line w50" /></div>
          <div className="skeleton-group"><div className="skeleton-bar skeleton-label" /><div className="skeleton-bar skeleton-line w90" /><div className="skeleton-bar skeleton-line w80" /><div className="skeleton-bar skeleton-line w65" /></div>
        </div>
      )}
      {error && !loading && <StatusNotice title="Unable to generate a lesson" message={error} onRetry={generate} />}
      {lesson && !loading && (
        <div className="output show">
          <span className="tag">{grade}</span><span className="tag">{subject}</span><span className="tag">{duration} min</span>
          {lesson.grounded
            ? <span className="tag tag-grounded">✓ Grounded in curriculum</span>
            : <span className="tag tag-ungrounded">⚠ Not in curriculum DB — general knowledge</span>}
          <h2>{lesson.title}</h2>
          <h3>Learning Objectives</h3><ul>{lesson.objectives?.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Prerequisites</h3><ul>{lesson.prerequisites?.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Explanation</h3><p>{lesson.explanation}</p>
          <h3>Worked Examples</h3><ul>{lesson.examples?.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Class Activities</h3><ul>{lesson.activities?.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Homework</h3><ul>{lesson.homework?.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <h3>Real-World Connection</h3><p>{lesson.realworld}</p>
          <div className="lesson-actions">
            <button type="button" className="btn btn-soft" onClick={handOffToQuestions}>
              Generate questions from this plan →
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setLesson(null)}>
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionGenerator() {
  const [grade, setGrade] = useState("Grade 9");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Quadratic Equations");
  const [difficulty, setDifficulty] = useState("Mixed");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState(null);
  // The lesson plan these questions are being derived from, if any.
  const [lesson, setLesson] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore the last session's form, result and any pending lesson handoff.
  useEffect(() => {
    const form = readStore("questions:form", null);
    if (form) {
      if (form.grade) setGrade(form.grade);
      if (form.subject) setSubject(form.subject);
      if (form.topic) setTopic(form.topic);
      if (form.difficulty) setDifficulty(form.difficulty);
      if (form.count) setCount(form.count);
    }
    const cached = readStore("questions:result", null);
    if (cached) setQuestions(cached);

    // A handoff from the Lesson Planner deliberately wins over the cached form —
    // it is the result the user just asked to build on. Cleared immediately so a
    // later manual visit to this tab doesn't silently re-attach a stale lesson.
    const handoff = readStore(HANDOFF_KEY, null);
    if (handoff) {
      clearStore(HANDOFF_KEY);
      if (handoff.lesson) setLesson(handoff.lesson);
      if (QGEN_GRADES.includes(handoff.grade)) setGrade(handoff.grade);
      if (QGEN_SUBJECTS.includes(handoff.subject)) setSubject(handoff.subject);
      if (handoff.topic) setTopic(handoff.topic);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStore("questions:form", { grade, subject, topic, difficulty, count });
  }, [grade, subject, topic, difficulty, count, hydrated]);

  useEffect(() => {
    if (questions) writeStore("questions:result", questions);
  }, [questions]);

  async function generate() {
    setLoading(true);
    setError("");
    setQuestions(null);
    try {
      // Only the parts questions should actually test are sent. The full plan carries
      // explanation/activities/realworld prose that would just burn context.
      const lessonBrief = lesson
        ? {
            title: lesson.title,
            objectives: lesson.objectives,
            examples: lesson.examples,
            homework: lesson.homework,
          }
        : undefined;
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic, difficulty, count, lesson: lessonBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setQuestions(data.questions || []);
    } catch {
      setError("The questions weren't generated. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-busy={loading}>
      <h1 className="page-title">Question Generator<Underline /></h1>
      <p className="page-desc">Generate a mixed set of questions for a topic, then review each one before adding it to an assessment.</p>
      <div className="form-card" aria-busy={loading}>
        {lesson && (
          <div className="handoff-banner">
            <div className="handoff-banner-text">
              <strong>Building on your lesson plan</strong>
              <span>{lesson.title}</span>
            </div>
            <button type="button" className="handoff-clear" onClick={() => setLesson(null)}>
              Use topic only
            </button>
          </div>
        )}
        <div className="field-row">
          <Field label="Grade">
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {QGEN_GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {QGEN_SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option>Mixed</option><option>Easy</option><option>Medium</option><option>Hard</option>
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Topic" wide>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
          <Field label="How many?">
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        </div>
        <button type="button" className="btn" onClick={generate} disabled={loading}>
          {loading && <svg className="spinner-svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" /><path d="M14 8a6 6 0 0 0-6-6" stroke="var(--chalk-green)" strokeWidth="2.5" strokeLinecap="round" /></svg>}
          {loading ? "Generating…" : "Generate Questions"}
        </button>
      </div>
      {loading && (
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-bar skeleton-heading" />
          {[1,2,3].map((n) => (
            <div className="skeleton-group" key={n}>
              <div className="skeleton-bar skeleton-label" />
              <div className="skeleton-bar skeleton-line w90" />
              <div className="skeleton-bar skeleton-line w75" />
            </div>
          ))}
        </div>
      )}
      {error && !loading && <StatusNotice title="Unable to generate questions" message={error} onRetry={generate} />}
      {questions && questions.length === 0 && !loading && (
        <StatusNotice kind="empty" title="No questions generated" message="Try changing the topic or generating the set again." />
      )}
      {questions && questions.length > 0 && !loading && (
        <div className="output show">
          <span className="tag">{grade}</span><span className="tag">{subject}</span><span className="tag">{difficulty}</span>
          {questions.grounded !== undefined && (
            questions.grounded
              ? <span className="tag tag-grounded">✓ Grounded in curriculum</span>
              : <span className="tag tag-ungrounded">⚠ Not in curriculum DB — general knowledge</span>
          )}
          <h2>{questions.length} Questions — {topic}</h2>
          {questions.map((q, i) => (
            <div className="q-item" key={i}>
              <div className="q-meta">Q{i + 1} · {q.type} · {q.meta}</div>
              <p>{q.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Tutor() {
  const [history, setHistory] = useState([
    { role: "assistant", content: "Hi! Tell me what you're working on." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const logRef = useRef(null);

  // Restore the conversation on mount. Only a real multi-turn chat is restored —
  // if the cache still holds just the greeting, keep the default initial state
  // so the tutor always opens with its welcome message.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const cached = readStore("tutor:history", null);
    if (Array.isArray(cached) && cached.length > 1) setHistory(cached);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStore("tutor:history", history);
  }, [history, hydrated]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [history, loading]);

  async function send(text, isRetry = false) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const nextHistory = isRetry ? history : [...history, { role: "user", content: msg }];
    if (!isRetry) setHistory(nextHistory);
    setInput("");
    setError("");
    setFailedMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setHistory((h) => [...h, { role: "assistant", content: data.reply }]);
    } catch {
      setError("The tutor couldn't respond. Please try again.");
      setFailedMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-busy={loading}>
      <h1 className="page-title">AI Tutor<Underline /></h1>
      <p className="page-desc">Ask about a concept or paste a problem. The tutor guides you toward the answer with questions instead of giving it away immediately.</p>
      <div className="starter-row">
        <button type="button" className="chip" onClick={() => send("I don't understand quadratic equations")} disabled={loading}>Quadratic equations</button>
        <button type="button" className="chip" onClick={() => send("Why does a ball thrown up come back down?")} disabled={loading}>Newton's laws</button>
        <button type="button" className="chip" onClick={() => send("How do I find the area of a triangle?")} disabled={loading}>Area of a triangle</button>
      </div>
      <div className="chat" aria-busy={loading}>
        <div className="chat-log" ref={logRef} aria-live="polite">
          {history.map((m, i) => (
            <div key={i} className={"bubble " + (m.role === "user" ? "student" : "tutor")}>{m.content}</div>
          ))}
          {loading && <div className="bubble tutor" aria-label="Tutor is responding"><TypingIndicator /></div>}
        </div>
        {error && <StatusNotice className="chat-notice" title="Unable to reach the tutor" message={error} onRetry={() => send(failedMessage, true)} />}
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type your question..."
          />
          <button type="button" className="btn" onClick={() => send()} disabled={loading}>Send</button>
        </div>
      </div>
    </section>
  );
}

function StatusNotice({ className = "", kind = "error", title, message, onRetry }) {
  return (
    <div className={`notice notice-${kind} ${className}`.trim()} role={kind === "error" ? "alert" : "status"}>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {onRetry && <button type="button" className="btn notice-retry" onClick={onRetry}>Try again</button>}
    </div>
  );
}

function Field({ label, wide, children }) {
  return (
    <div className="field" style={wide ? { flex: 2 } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="typing-dots" aria-label="typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

function GradingAgent() {
  const [grade, setGrade] = useState("Grade 9");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Quadratic Equations");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);         // grading result pending approval
  const [approved, setApproved] = useState(false);    // true after user approves
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(null);           // { total_finalized }

  async function grade_answer() {
    if (!studentAnswer.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setApproved(false);
    setSaved(null);
    setSaveError("");
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic, studentAnswer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grading failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function finalize(approve) {
    if (!approve) {
      setApproved(false);
      setResult(null);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/grade-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: result.grade,
          subject: result.subject,
          topic: result.topic,
          studentAnswer: result.studentAnswer,
          verdict: result.verdict,
          feedback: result.feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setApproved(true);
      setSaved(data);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setResult(null);
    setApproved(false);
    setSaved(null);
    setSaveError("");
    setStudentAnswer("");
    setError("");
  }

  const verdictClass = result
    ? result.verdict === "CORRECT" ? "verdict-correct"
    : result.verdict === "PARTIAL" ? "verdict-partial"
    : "verdict-incorrect"
    : "";

  return (
    <section aria-busy={loading}>
      <h1 className="page-title">Grading Agent<Underline /></h1>
      <p className="page-desc">
        Paste a student&apos;s answer — the agent fetches the official rubric, grades against expected
        concepts, then asks for your approval before saving the result.
      </p>

      {/* Input form — hidden once result is showing */}
      {!result && (
        <div className="form-card" aria-busy={loading}>
          <div className="field-row">
            <Field label="Grade">
              <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                {["Grade 7","Grade 8","Grade 9","Grade 10","Grade 11"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option>Mathematics</option>
                <option>Physics</option>
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Topic" wide>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quadratic Equations"
              />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Student's Answer" wide>
              <textarea
                className="grade-answer-input"
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                placeholder="Paste the student's full answer here…"
                rows={5}
              />
            </Field>
          </div>
          <div className="grade-starters">
            <span className="grade-starter-label">Try an example:</span>
            <button type="button" className="chip" disabled={loading}
              onClick={() => {
                setGrade("Grade 9"); setSubject("Mathematics"); setTopic("Quadratic Equations");
                setStudentAnswer("x² − 5x + 6 = 0, divide by x to get x − 5 + 6/x = 0, so x = 5.");
              }}>
              Wrong answer — Quadratic
            </button>
            <button type="button" className="chip" disabled={loading}
              onClick={() => {
                setGrade("Grade 9"); setSubject("Mathematics"); setTopic("Quadratic Equations");
                setStudentAnswer("x² − 5x + 6 = 0 factors as (x − 2)(x − 3) = 0, so x = 2 or x = 3.");
              }}>
              Correct answer — Quadratic
            </button>
            <button type="button" className="chip" disabled={loading}
              onClick={() => {
                setGrade("Grade 9"); setSubject("Physics"); setTopic("Newton's Laws of Motion");
                setStudentAnswer("A 10 kg cart is pushed with 25 N force, so acceleration is 25/10 = 2.5 m/s². Also its weight in kg is 10 kg.");
              }}>
              Partial answer — Newton
            </button>
          </div>
          <button type="button" className="btn" onClick={grade_answer} disabled={loading || !studentAnswer.trim()}>
            {loading && <svg className="spinner-svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5"/><path d="M14 8a6 6 0 0 0-6-6" stroke="var(--chalk-green)" strokeWidth="2.5" strokeLinecap="round"/></svg>}
            {loading ? "Grading…" : "Grade Answer"}
          </button>
        </div>
      )}

      {loading && (
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-bar skeleton-heading" />
          <div className="skeleton-group">
            <div className="skeleton-bar skeleton-label" />
            <div className="skeleton-bar skeleton-line w80" />
            <div className="skeleton-bar skeleton-line w65" />
          </div>
          <div className="skeleton-group">
            <div className="skeleton-bar skeleton-label" />
            <div className="skeleton-bar skeleton-line w90" />
            <div className="skeleton-bar skeleton-line w75" />
          </div>
        </div>
      )}

      {error && !loading && (
        <StatusNotice title="Grading failed" message={error} onRetry={grade_answer} />
      )}

      {/* Result card */}
      {result && !loading && (
        <div className="grade-result-card">
          <div className="grade-result-header">
            <div className="grade-result-meta">
              <span className="tag">{result.grade}</span>
              <span className="tag">{result.subject}</span>
              <span className="tag">{result.topic}</span>
            </div>
            <span className={`grade-verdict ${verdictClass}`}>{result.verdict}</span>
          </div>

          <div className="grade-result-section">
            <div className="grade-result-label">Feedback</div>
            <p className="grade-result-feedback">{result.feedback}</p>
          </div>

          {result.concepts_present?.length > 0 && (
            <div className="grade-result-section">
              <div className="grade-result-label">Concepts present ✓</div>
              <ul className="grade-concept-list grade-concept-present">
                {result.concepts_present.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {result.concepts_missing?.length > 0 && (
            <div className="grade-result-section">
              <div className="grade-result-label">Concepts missing ✗</div>
              <ul className="grade-concept-list grade-concept-missing">
                {result.concepts_missing.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Human approval step */}
          {!approved && !saved && (
            <div className="grade-approval-box">
              <div className="grade-approval-prompt">
                <span className="grade-approval-icon">⏸</span>
                <div>
                  <strong>Awaiting your approval</strong>
                  <p>Review the verdict above. Approve to save this grade to the record, or dismiss to discard.</p>
                </div>
              </div>
              {saveError && <p className="grade-save-error">{saveError}</p>}
              <div className="grade-approval-actions">
                <button type="button" className="btn btn-approve" onClick={() => finalize(true)} disabled={saving}>
                  {saving ? "Saving…" : "✓ Approve & Save"}
                </button>
                <button type="button" className="btn btn-dismiss" onClick={() => finalize(false)} disabled={saving}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Saved confirmation */}
          {approved && saved && (
            <div className="grade-saved-box">
              <span className="grade-saved-icon">✓</span>
              <div>
                <strong>Grade saved</strong>
                {saved.total_finalized && (
                  <p>{saved.total_finalized} record{saved.total_finalized !== 1 ? "s" : ""} in the grade store.</p>
                )}
              </div>
            </div>
          )}

          <button type="button" className="grade-grade-again" onClick={reset}>
            ← Grade another answer
          </button>
        </div>
      )}
    </section>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <strong>Ed Agent — AI for better teaching</strong>
      </div>
      <nav className="app-footer-links">
        <a href="https://github.com/Abdulla6h77/ed-agent" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </footer>
  );
}
