import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [tab, setTab] = useState("planner");
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
          ].map(([key, label]) => (
            <button
              key={key}
              className={`tab${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
          <Link className="tab" href="/grading-agent">Grading Agent ↗</Link>
        </nav>
      </header>
      <main>
        <div className="tab-content tab-enter" key={tab}>
          {tab === "planner" && <LessonPlanner />}
          {tab === "questions" && <QuestionGenerator />}
          {tab === "tutor" && <Tutor />}
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

function LessonPlanner() {
  const [grade, setGrade] = useState("Grade 9");
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("Quadratic Equations");
  const [duration, setDuration] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState(null);

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

  async function generate() {
    setLoading(true);
    setError("");
    setQuestions(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic, difficulty, count }),
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
        <div className="field-row">
          <Field label="Grade">
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {["Grade 7", "Grade 8", "Grade 9", "Grade 10"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option>Mathematics</option>
              <option>Physics</option>
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

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <strong>Ed Agent — AI for better teaching</strong>
      </div>
      <nav className="app-footer-links">
        <a href="/grading-agent">Grading Agent</a>
        <a href="https://github.com/Abdulla6h77/ed-agent" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </footer>
  );
}
