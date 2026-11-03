// STEP 2 — in-memory session store. For MVP (JSON/SQLite per architecture.md §4).
// Holds basic info, calibration answers (placeholder score until Step 6), chat history,
// and resume text. Cleared on server restart — acceptable for MVP.
import { randomUUID } from "node:crypto";
import { getCalibrationQuestions, getScreeningQuestions } from "../data/calibration.js";

const sessions = new Map();

// Question category detection for tagging
export const QUESTION_CATEGORIES = {
  "technical-dsa": ["algorithm", "data structure", "array", "tree", "graph", "sort", "search", "complexity", "big-o", "hash", "heap", "stack", "queue", "linked list", "recursion", "dynamic programming"],
  "technical-system-design": ["design", "architecture", "scale", "database", "cache", "queue", "load balancer", "microservice", "api", "shard", "replica", "consistency", "availability", "latency", "throughput", "system design"],
  "technical-domain": [], // filled from domain
  "behavioral-star": ["situation", "task", "action", "result", "tell me about a time", "describe a situation", "give an example"],
  "behavioral-situational": ["how would you handle", "what would you do if", "imagine you", "scenario:", "hypothetically", "suppose you"],
  "cultural-fit": ["value", "culture", "mission", "team", "collaboration", "feedback", "growth", "learning", "ownership", "integrity", "diversity", "inclusion", "why this company", "why us"],
  "screening": ["education", "experience", "authorized", "notice", "salary", "availability"],
};

export function categorizeQuestion(questionText, domain = "") {
  const text = (questionText || "").toLowerCase();
  const categories = [];
  
  for (const [category, keywords] of Object.entries(QUESTION_CATEGORIES)) {
    if (category === "technical-domain") continue; // handled separately
    if (keywords.some(k => text.includes(k))) {
      categories.push(category);
    }
  }
  
  // Check domain-specific keywords
  const domainLower = domain.toLowerCase();
  if (domainLower && text.includes(domainLower)) {
    categories.push("technical-domain");
  }
  
  return categories.length > 0 ? categories : ["general"];
}

export function createSession({ name, domain, experience, persona, mode }) {
  const id = randomUUID();
  const calibrationQuestions = getCalibrationQuestions(domain, 3);
  const screeningQuestions = getScreeningQuestions(3);
  const session = {
    id,
    name: name || "",
    domain: domain || "Software Engineering",
    experience: experience || "",
    persona: persona || "hr",
    mode: mode || "practice",
    phase: "screening", // screening -> calibration -> adaptive
    screeningQuestions,
    screeningIndex: 0,
    screeningAnswers: [],
    calibrationQuestions,
    calibrationIndex: 0,
    calibrationAnswers: [], // {question, answer, score}
    resumeText: null,
    history: [], // chat turns for the adaptive engine
    mistakeJournal: [], // Step 6 tags accumulated during the session
    ability: {}, // Step 7 per-topic ability estimate
    integrityLog: [], // Step 8 events
    questionCategories: [], // Track question categories asked
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
