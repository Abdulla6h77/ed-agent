import Link from "next/link";

export default function GradingAgent() {
  const steps = [
    {
      number: "01",
      title: "Identify the work",
      description: "Read the grade, subject, topic, homework question, and the student's submitted answer.",
    },
    {
      number: "02",
      title: "Retrieve the rubric",
      description: "Call get_rubric with the grade, subject, and topic to find the matching local criteria.",
    },
    {
      number: "03",
      title: "Verify the calculation",
      description: "For numerical or algebraic work, the configured instructions require an independent sandbox check before judging.",
    },
    {
      number: "04",
      title: "Compare the evidence",
      description: "Check expected concepts and common mistakes from the matching rubric against the submitted answer.",
    },
    {
      number: "05",
      title: "Return the assessment",
      description: "Give CORRECT, PARTIAL, or INCORRECT with concise feedback grounded in a specific rubric criterion.",
    },
  ];

  return (
    <div className="app grading-page">
      <header className="grading-header">
        <div className="grading-header-row">
          <div className="brand">
            <span className="brand-mark">Ed Agent</span>
            <span className="brand-sub">Static workflow overview · local grading agent</span>
          </div>
          <Link className="grading-back" href="/">Back to Ed Agent</Link>
        </div>
      </header>

      <main className="grading-main">
        <section className="grading-hero">
          <span className="grading-eyebrow">Homework Grading Agent</span>
          <h1 className="page-title">Rubric-grounded feedback<Underline /></h1>
          <p className="page-desc grading-desc">A static overview of the separate local grading agent. This page does not connect to TrueForge, call MCP tools, or grade student work.</p>
          <div className="grading-status" role="status">Configured local workflow · not a live execution record</div>
        </section>

        <section className="grading-section" aria-labelledby="workflow-heading">
          <h2 id="workflow-heading" className="grading-section-title">Configured grading workflow<Underline /></h2>
          <div className="grading-flow">
            {steps.map((step, index) => (
              <div className="flow-group" key={step.number}>
                <article className="flow-step">
                  <span className="flow-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
                {index < steps.length - 1 && <span className="flow-connector" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="grading-section grading-scope" aria-labelledby="scope-heading">
          <h2 id="scope-heading" className="grading-section-title">Available local rubric scope<Underline /></h2>
          <p className="grading-section-desc">The rubric MCP server currently reads static data for these two Grade 9 topics.</p>
          <div className="scope-grid">
            <article className="scope-card">
              <span className="tag">Grade 9</span>
              <h3>Mathematics</h3>
              <p>Quadratic Equations</p>
            </article>
            <article className="scope-card">
              <span className="tag">Grade 9</span>
              <h3>Physics</h3>
              <p>Newton&apos;s Laws of Motion</p>
            </article>
          </div>
        </section>

        <section className="grading-section" aria-labelledby="trace-heading">
          <h2 id="trace-heading" className="grading-section-title">Trace evidence<Underline /></h2>
          <figure className="trace-placeholder">
            <div className="trace-placeholder-mark">Trace media</div>
            <figcaption>
              <strong>Screenshot or recording placeholder</strong>
              <span>Replace this space with a verified local TrueForge trace when one is captured.</span>
            </figcaption>
          </figure>
        </section>

        <aside className="grading-boundary" aria-label="Static page boundary">
          <h2>Static overview only</h2>
          <p>The local files define one grading agent, a rubric MCP tool, and configured sandbox verification. They do not document an orchestrator, a grading subagent, or a human final-grade approval checkpoint.</p>
        </aside>
      </main>

      <footer>Ed Agent MVP — static overview only. No live TrueForge or MCP connection.</footer>
    </div>
  );
}

function Underline() {
  return (
    <svg className="underline" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 5 Q 50 0, 100 5 T 200 5" stroke="#C68A3D" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
