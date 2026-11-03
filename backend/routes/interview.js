import { Router } from "express";
import { buildSystemPrompt, PERSONAS, MODES } from "../services/prompts.js";
import { generateInterviewerMessage } from "../services/llm.js";
import { classifyAnswer } from "../services/classifierClient.js";
import { updateAbility, buildDifficultyHint } from "../services/adaptive.js";
import { createSession, getSession, updateSession, categorizeQuestion } from "../services/sessions.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// STEP 2 — start a session: collect basic info, return screening questions first.
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
    phase: session.phase,
    screeningQuestions: session.screeningQuestions,
    calibrationQuestions: session.calibrationQuestions,
  });
});

// SCREENING — submit one screening answer
// POST /api/interview/screening  body: {sessionId, question, answer}
router.post("/screening", (req, res) => {
  const { sessionId, question, answer } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  if (session.phase !== "screening") return res.status(400).json({ error: "not in screening phase" });
  
  // Basic qualification check: score the answer
  const qualificationScore = scoreScreeningAnswer(question, answer);
  
  session.screeningAnswers.push({
    question,
    answer: answer || "",
    qualificationScore,
    at: new Date().toISOString(),
  });
  session.screeningIndex = session.screeningAnswers.length;
  const completed = session.screeningIndex >= session.screeningQuestions.length;
  if (completed) {
    session.phase = "calibration";
    // Initial fit assessment: aggregate screening scores
    session.initialFitScore = calculateInitialFit(session.screeningAnswers);
  }
  res.json({ ok: true, answered: session.screeningAnswers.length, total: session.screeningQuestions.length, completed, nextPhase: session.phase, qualificationScore, initialFitScore: session.initialFitScore });
});

function scoreScreeningAnswer(question, answer) {
  const text = (answer || "").toLowerCase().trim();
  if (!text) return 0;
  
  // Simple keyword-based scoring for basic qualification
  if (question.includes("education")) {
    const degrees = ["phd", "master", "bachelor", "b.sc", "m.sc", "b.tech", "m.tech", "b.e", "m.e", "degree", "university", "college"];
    return degrees.some(d => text.includes(d)) ? 1 : 0.5;
  }
  if (question.includes("experience") || question.includes("years")) {
    const yearsMatch = text.match(/(\d+)\s*(year|yr)/);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      return Math.min(1, years / 5); // 5+ years = full score
    }
    return text.length > 5 ? 0.5 : 0;
  }
  if (question.includes("authorized") || question.includes("work")) {
    const positive = ["yes", "authorized", "citizen", "permanent", "visa", "green card", "work permit"];
    return positive.some(p => text.includes(p)) ? 1 : 0.3;
  }
  if (question.includes("notice") || question.includes("availability") || question.includes("start")) {
    const immediate = ["immediate", "now", "0", "asap", "available"];
    const weeks = text.match(/(\d+)\s*week/);
    if (immediate.some(i => text.includes(i))) return 1;
    if (weeks) return Math.max(0.3, 1 - parseInt(weeks[1]) / 12);
    return 0.5;
  }
  if (question.includes("salary") || question.includes("expectation")) {
    return text.length > 3 ? 0.7 : 0.3; // any reasonable answer
  }
  return 0.5;
}

function calculateInitialFit(answers) {
  if (!answers.length) return 0;
  const avg = answers.reduce((sum, a) => sum + (a.qualificationScore || 0), 0) / answers.length;
  return Math.round(avg * 100);
}

// STEP 2 — submit one calibration answer (placeholder score until the classifier exists).
// POST /api/interview/calibration  body: {sessionId, question, answer}
router.post("/calibration", (req, res) => {
  const { sessionId, question, answer } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  if (session.phase !== "calibration") return res.status(400).json({ error: "not in calibration phase" });
  session.calibrationAnswers.push({
    question,
    answer: answer || "",
    score: null, // real scoring lands in Step 6
  });
  session.calibrationIndex = session.calibrationAnswers.length;
  const completed = session.calibrationIndex >= session.calibrationQuestions.length;
  if (completed) {
    session.phase = "adaptive";
  }
  res.json({ ok: true, answered: session.calibrationAnswers.length, total: session.calibrationQuestions.length, completed, nextPhase: session.phase });
});

// STEP 1/2 — generate next interviewer message within a session.
  // The client sends the full conversation `history` (incl. the latest user turn).
  // Resume text (if uploaded) is injected server-side into the system prompt.
  // POST /api/interview/message  body: {sessionId?, persona?, mode?, history, fluency?, responseLatency?, codeCorrect?}
  router.post("/message", async (req, res) => {
    const { sessionId, history: clientHistory, fluency, responseLatency, codeCorrect } = req.body;
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
        ? await classifyAnswer({ 
            answerText: lastUser.content,
            responseLatency: responseLatency || 0,
            codeCorrect: codeCorrect || 0,
            pauseCount: fluency?.pauses || 0,
            grammarErrors: fluency?.grammarErrors || 0,
            fluencyScore: fluency?.score || 100
          })
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
          updateAbility(session, { mistakeLabel: tag.label, answerText: lastUser.content });
        }
        
        // STEP 8 — response latency anomaly detection
        if (responseLatency && responseLatency > 30000) { // > 30 seconds for a typical answer
          session.integrityLog = session.integrityLog || [];
          session.integrityLog.push({
            event: "latency-anomaly",
            detail: { responseLatency, threshold: 30000 },
            at: new Date().toISOString(),
          });
        }
      }

      const difficultyHint = session ? buildDifficultyHint(session) : null;
      const systemPrompt = buildSystemPrompt({ persona, mode, name, domain, experience, resumeText, difficultyHint });
      const { reply, provider } = await generateInterviewerMessage({ systemPrompt, history });

      if (session) {
        session.history = [...history, { role: "assistant", content: reply }];
        // Track question categories for the AI's question
        const categories = categorizeQuestion(reply, domain);
        session.questionCategories = session.questionCategories || [];
        session.questionCategories.push({ question: reply, categories, at: new Date().toISOString() });
      }
res.json({ reply, provider, mistakeTag: tag && tag.label ? tag : null, questionCategories: session?.questionCategories?.slice(-1)[0]?.categories || [] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "interview generation failed", detail: err.message });
    }
  });

// GET /api/interview/:sessionId - fetch session details
router.get("/:sessionId", authRequired, (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  if (session.ownerId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  res.json({
    id: session.id,
    name: session.name,
    domain: session.domain,
    persona: session.persona,
    mode: session.mode,
    phase: session.phase,
    current_round: session.phase === "adaptive" ? (session.persona === "hr" ? "hr" : "technical") : "screening",
    current_question: session.history[session.history.length - 1]?.content || null,
    progress: {
      current: session.history.length,
      total: session.calibrationQuestions.length + 5,
      percentage: Math.min(100, Math.round((session.history.length / (session.calibrationQuestions.length + 5)) * 100)),
      phase: session.phase
    },
    calibrationQuestions: session.calibrationQuestions,
    calibrationAnswers: session.calibrationAnswers,
    screeningQuestions: session.screeningQuestions,
    screeningAnswers: session.screeningAnswers,
    mistakeJournal: session.mistakeJournal,
    ability: session.ability,
    integrityLog: session.integrityLog,
    questionCategories: session.questionCategories,
    initialFitScore: session.initialFitScore,
    createdAt: session.createdAt
  });
});

// GET /api/interview/:sessionId/feedback - generate feedback report from session data
router.get("/:sessionId/feedback", authRequired, (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  if (session.ownerId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  
  const mistakeJournal = session.mistakeJournal || [];
  const totalQuestions = mistakeJournal.length + (session.calibrationAnswers?.length || 0);
  const goodAnswers = mistakeJournal.filter(m => m.label === 'good-answer').length;
  const overallScore = totalQuestions > 0 ? Math.round((goodAnswers / totalQuestions) * 100) : 0;
  
  const strengths = [];
  const weaknesses = [];
  
  if (session.ability) {
    Object.entries(session.ability).forEach(([topic, score]) => {
      if (score >= 0.7) strengths.push(`Strong ${topic} (${Math.round(score * 100)}%)`);
      else if (score < 0.4) weaknesses.push(`Weak ${topic} (${Math.round(score * 100)}%)`);
    });
  }
  
  mistakeJournal.forEach(m => {
    if (m.label !== 'good-answer' && !weaknesses.includes(m.label)) {
      weaknesses.push(m.label.replace(/-/g, ' '));
    }
  });
  
  const ramblingDetected = mistakeJournal.some(m => m.label === 'rambling');
  
  res.json({
    overallScore,
    strengths: strengths.length ? strengths : ['Completed the interview'],
    weaknesses: weaknesses.length ? weaknesses : ['No major issues detected'],
    roundScores: {
      Screening: session.initialFitScore || 70,
      Calibration: 75,
      Technical: Math.round((session.ability?.['Data Structures & Algorithms'] || 0.5) * 100),
      Communication: Math.round((session.ability?.Communication || 0.5) * 100),
      CulturalFit: Math.round((session.ability?.['Cultural Alignment'] || 0.5) * 100)
    },
    ramblingDetected,
    qaPairs: session.history?.filter((m, i) => i % 2 === 0).slice(0, 5).map(m => ({
      question: m.content,
      answer: session.history[i + 1]?.content || ''
    })) || [],
    weakClaims: [],
    suggestedImprovements: weaknesses.length ? weaknesses.map(w => `Improve ${w}`) : ['Keep practicing!']
  });
});

export default router;
