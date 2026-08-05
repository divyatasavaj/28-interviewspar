import { Router } from "express";
import { buildSystemPrompt, PERSONAS, MODES } from "../services/prompts.js";
import { generateInterviewerMessage } from "../services/llm.js";
import { classifyAnswer } from "../services/classifierClient.js";
import { updateAbility, buildDifficultyHint } from "../services/adaptive.js";
import { createSession, getSession, updateSession } from "../services/sessions.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// STEP 2 — start a session: collect basic info, return calibration questions.
// POST /api/interview/start  body: {name, domain, experience, persona, mode}
// Requires login; the session is tagged with the owner (student/developer/company) id.
router.post("/start", authRequired, (req, res) => {
  const { name, domain, experience, persona = "hr", mode = "practice" } = req.body;
  if (!PERSONAS.includes(persona)) return res.status(400).json({ error: "invalid persona" });
  if (!MODES.includes(mode)) return res.status(400).json({ error: "invalid mode" });
  const session = createSession({ name, domain, experience, persona, mode });
  session.ownerId = req.user.id;
  session.ownerRole = req.user.role;
  session.ownerName = req.user.name;
  res.json({
    sessionId: session.id,
    name: session.name,
    domain: session.domain,
    persona: session.persona,
    mode: session.mode,
    calibrationQuestions: session.calibrationQuestions,
  });
});

// STEP 2 — submit one calibration answer (placeholder score until the classifier exists).
// POST /api/interview/calibration  body: {sessionId, question, answer}
router.post("/calibration", (req, res) => {
  const { sessionId, question, answer } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  session.calibrationAnswers.push({
    question,
    answer: answer || "",
    score: null, // real scoring lands in Step 6
  });
  res.json({ ok: true, answered: session.calibrationAnswers.length, total: session.calibrationQuestions.length });
});

// STEP 1/2 — generate next interviewer message within a session.
// The client sends the full conversation `history` (incl. the latest user turn).
// Resume text (if uploaded) is injected server-side into the system prompt.
// POST /api/interview/message  body: {sessionId?, persona?, mode?, history}
router.post("/message", async (req, res) => {
  const { sessionId, history: clientHistory } = req.body;
  const session = sessionId ? getSession(sessionId) : null;

  const persona = req.body.persona || session?.persona || "hr";
  const mode = req.body.mode || session?.mode || "practice";
  const name = session?.name;
  const domain = session?.domain;
  const experience = session?.experience;
  const resumeText = session?.resumeText || null;

  if (!PERSONAS.includes(persona)) return res.status(400).json({ error: "invalid persona" });
  if (!MODES.includes(mode)) return res.status(400).json({ error: "invalid mode" });

  const history = Array.isArray(clientHistory)
    ? clientHistory
    : session
    ? session.history
    : [];

  // STEP 6 — classify the candidate's latest answer. The tag updates the ability estimate
  // (Step 7) which shapes the NEXT question's difficulty.
  const lastUser = [...history].reverse().find((m) => m.role === "user");

  try {
    const tag = lastUser
      ? await classifyAnswer({ answerText: lastUser.content })
      : { label: null };

    if (session) {
      session.mistakeJournal = session.mistakeJournal || [];
      if (tag && tag.label) {
        session.mistakeJournal.push({
          answer: lastUser.content,
          label: tag.label,
          top_features: tag.top_features,
          at: new Date().toISOString(),
        });
        updateAbility(session, { mistakeLabel: tag.label });
      }
    }

    const difficultyHint = session ? buildDifficultyHint(session) : null;
    const systemPrompt = buildSystemPrompt({ persona, mode, name, domain, experience, resumeText, difficultyHint });
    const { reply, provider } = await generateInterviewerMessage({ systemPrompt, history });

    if (session) {
      session.history = [...history, { role: "assistant", content: reply }];
    }
    res.json({ reply, provider, mistakeTag: tag && tag.label ? tag : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "interview generation failed", detail: err.message });
  }
});

export default router;
