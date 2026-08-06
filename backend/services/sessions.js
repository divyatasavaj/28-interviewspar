// STEP 2 — in-memory session store. For MVP (JSON/SQLite per architecture.md §4).
// Holds basic info, calibration answers (placeholder score until Step 6), chat history,
// and resume text. Cleared on server restart — acceptable for MVP.
import { randomUUID } from "node:crypto";
import { getCalibrationQuestions } from "../data/calibration.js";

const sessions = new Map();

export function createSession({ name, domain, experience, persona, mode }) {
  const id = randomUUID();
  const calibrationQuestions = getCalibrationQuestions(domain, 3);
  const session = {
    id,
    name: name || "",
    domain: domain || "Software Engineering",
    experience: experience || "",
    persona: persona || "hr",
    mode: mode || "practice",
    calibrationQuestions,
    calibrationIndex: 0,
    calibrationAnswers: [], // {question, answer, score}
    resumeText: null,
    history: [], // chat turns for the adaptive engine
    mistakeJournal: [], // Step 6 tags accumulated during the session
    ability: {}, // Step 7 per-topic ability estimate
    integrityLog: [], // Step 8 events
    createdAt: new Date().toISOString(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id);
}

export function updateSession(id, patch) {
  const s = sessions.get(id);
  if (!s) return null;
  Object.assign(s, patch);
  sessions.set(id, s);
  return s;
}
