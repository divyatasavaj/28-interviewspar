// LLM service: Groq (primary) + Gemini (fallback). OpenAI-compatible Groq calls.
// Implements rules.md §3: every LLM call has a timeout; on total failure we return
// a safe fallback message instead of hanging the UI.
import "dotenv/config";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 15000;

function withTimeout(promise) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

async function groqChat(messages, model) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const { signal, clear } = withTimeout();
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: model || "llama-3.3-8b-versatile", messages, temperature: 0.7 }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } finally {
    clear();
  }
}

async function geminiChat(messages, model) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const { signal, clear } = withTimeout();
  // Gemini uses roles: system -> injected as first user turn prefix; user/model only
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const sys = messages.find((m) => m.role === "system");
  if (sys) contents.unshift({ role: "user", parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${sys.content}` }] });
  try {
    const res = await fetch(`${GEMINI_URL}/${model || "gemini-1.5-flash"}:generateContent?key=${key}`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return data.candidates[0].content.parts[0].text.trim();
  } finally {
    clear();
  }
}

// Returns { reply, provider }. Falls back Groq -> Gemini -> safe message.
export async function generateInterviewerMessage({ systemPrompt, history, model }) {
  const messages = [{ role: "system", content: systemPrompt }, ...history];

  // dev convenience: no keys configured -> deterministic mock so the UI is testable
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    const last = history[history.length - 1]?.content || "";
    return {
      reply: `(dev mock — set GROQ_API_KEY/GEMINI_API_KEY in .env for real LLM)\nThanks for that answer. Let me ask a follow-up: can you elaborate on "${String(last).slice(0, 40)}..." with a concrete example?`,
      provider: "mock",
    };
  }

  try {
    const reply = await groqChat(messages, model);
    return { reply, provider: "groq" };
  } catch (groqErr) {
    console.warn("Groq failed, trying Gemini:", groqErr.message);
    try {
      const reply = await geminiChat(messages, "gemini-1.5-flash");
      return { reply, provider: "gemini" };
    } catch (geminiErr) {
      console.error("Both LLM providers failed:", geminiErr.message);
      return { reply: "Let's try that question again — could you rephrase your last answer?", provider: "fallback" };
    }
  }
}
