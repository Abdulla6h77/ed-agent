const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-5";
// Primary first, then fallbacks. Gemini's free tier is 20 requests/day PER MODEL,
// so when the primary hits its quota wall we can still serve requests by moving to a
// model whose own quota bucket is untouched. gemini-3-flash-preview accepts the same
// thinkingLevel / responseMimeType flags as the primary.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3-flash-preview"];
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Alibaba Cloud Model Studio (DashScope) speaks the OpenAI chat-completions protocol, so it
// plugs in as a plain OpenAI-compatible provider. The workspace-specific gateway URL from
// the console overrides the public international default.
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || "qwen-plus";

// Both providers occasionally return a transient "high demand"/rate-limit status for a
// few seconds (Gemini does this a lot on free-tier keys). Retrying with backoff turns a
// demo-killing 503 into a ~2s pause nobody notices.
const TRANSIENT_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function statusOf(err) {
  const m = /^(\w[\w ]*?) API error \((\d{3})\)/.exec(err.message || "");
  return m ? Number(m[2]) : 0;
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = statusOf(err);
      // Only retry provider-side hiccups — never a parse bug or a bad API key.
      // A quota wall is excluded: retrying it cannot succeed, the caller fails over instead.
      if (attempt === MAX_ATTEMPTS || !TRANSIENT_STATUSES.has(status) || isQuotaWall(err)) {
        throw err;
      }
      // 429 means we are being rate-limited, so back off much harder than a 503:
      // hammering a throttled key in a tight loop only extends the penalty.
      const base = status === 429 ? 4000 : 1000;
      const waitMs = base * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
      console.warn(
        `[ai] ${label} transient ${status} (attempt ${attempt}/${MAX_ATTEMPTS}), ` +
          `retrying in ${waitMs}ms: ${err.message.slice(0, 100)}`
      );
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function callAnthropic({ system, messages, maxTokens }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

async function callGemini({ system, messages, maxTokens, jsonMode, model }) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // This model counts thinking tokens against maxOutputTokens (~250-430 per tutor reply)
  // and rejects thinkingBudget: 0 with a 400, so we REDUCE thinking via thinkingLevel
  // instead of disabling it. responseMimeType is opt-in: only JSON-producing routes
  // should force JSON — text routes (tutor) must answer in plain conversational text.
  const generationConfig = {
    maxOutputTokens: maxTokens,
    thinkingConfig: { thinkingLevel: "low" },
    ...(jsonMode ? { responseMimeType: "application/json" } : {}),
  };
  const res = await fetch(`${geminiUrl(model)}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: system }] },
      generationConfig,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  // Some Gemini models emit internal reasoning as separate parts flagged thought: true.
  // Join ONLY the non-thought parts so reasoning can never leak into a reply.
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts
    .filter((p) => p.thought !== true)
    .map((p) => p.text || "")
    .join("");
  return text.trim();
}

// Alibaba Cloud Model Studio (DashScope) via the OpenAI-compatible /chat/completions API.
// This is the same wire format as OpenAI, so the payload is the familiar
// { model, messages, max_tokens } and the reply lives in choices[0].message.content.
async function callDashScope({ system, messages, maxTokens, jsonMode }) {
  const chatMessages = [{ role: "system", content: system }, ...messages];
  const res = await fetch(`${DASHSCOPE_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: DASHSCOPE_MODEL,
      messages: chatMessages,
      max_tokens: maxTokens,
      // Ask for JSON structurally rather than trusting the prompt to comply.
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DashScope API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return (text || "").trim();
}

// A 429 quota wall ("exceeded your current quota... retry in 7h") is NOT transient:
// retrying the same model just burns time. Move to the next model's quota bucket instead.
function isQuotaWall(err) {
  return statusOf(err) === 429 && /quota|RESOURCE_EXHAUSTED|retry in \d/i.test(err.message || "");
}

async function callGeminiWithFailover(args) {
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      // Only short transient blips are retried here; a quota wall fails over fast.
      return await withRetry(`gemini:${model}`, () => callGemini({ ...args, model }));
    } catch (err) {
      lastErr = err;
      if (!isQuotaWall(err)) throw err;
      console.warn(`[ai] ${model} quota exhausted, failing over to the next Gemini model`);
    }
  }
  throw lastErr;
}

export async function callClaude({ system, messages, maxTokens = 1200, jsonMode = false }) {
  // Provider priority: an explicit AI_PROVIDER env var wins, otherwise the first
  // configured key is used. Set AI_PROVIDER=dashscope|gemini|anthropic to pin one.
  const preferred = (process.env.AI_PROVIDER || "").toLowerCase();
  const order = ["dashscope", "anthropic", "gemini"].filter((p) => !preferred || p === preferred);
  if (preferred && !process.env[`${preferred.toUpperCase()}_API_KEY`]) {
    throw new Error(`AI_PROVIDER=${preferred} is set but ${preferred.toUpperCase()}_API_KEY is missing`);
  }

  let lastErr;
  for (const provider of order) {
    if (provider === "dashscope" && !process.env.DASHSCOPE_API_KEY) continue;
    if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) continue;
    if (provider === "gemini" && !process.env.GEMINI_API_KEY) continue;
    try {
      if (provider === "dashscope") {
        return await withRetry("dashscope", () => callDashScope({ system, messages, maxTokens, jsonMode }));
      }
      if (provider === "anthropic") {
        return await withRetry("anthropic", () => callAnthropic({ system, messages, maxTokens }));
      }
      return await callGeminiWithFailover({ system, messages, maxTokens, jsonMode });
    } catch (err) {
      // Fall through to the next provider on quota/rate-limit walls rather than failing
      // the request — the user always gets an answer from whichever provider is free.
      lastErr = err;
      const recoverable = isQuotaWall(err) || TRANSIENT_STATUSES.has(statusOf(err));
      console.warn(`[ai] ${provider} unavailable (${err.message.slice(0, 80)}), trying next provider`);
      if (!recoverable) throw err;
    }
  }
  throw lastErr || new Error("No AI provider configured — set DASHSCOPE_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY");
}

export function parseJsonResponse(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  // The model sometimes adds stray text before/after the JSON object —
  // keep only the substring from the first "{" to the last "}".
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(
      `Failed to parse AI response as JSON (${err.message}). ` +
        `Raw response (first 300 chars): ${text.slice(0, 300)}`
    );
  }
}
