// STEP 7 — adaptive ability engine. A lightweight BKT-lite / rule-based estimator kept in
// Node (rules.md: "don't over-engineer with complex RL — simple rule-based scoring is enough").
// Tracks a per-topic ability in [0,1]; after each answer it updates and picks the next
// question's topic + difficulty, which is fed to the LLM as a hint.

// mistake-label -> ability delta on the active topic
const LABEL_DELTA = {
  "good-answer": +0.12,
  "rambling": -0.10,
  "no-structure": -0.08,
  "underselling": -0.06,
  "resume-gap": -0.05,
  "silent-coding": -0.12,
};

export function topicFor(session) {
  // single primary topic = domain; communication tracked separately
  return session.domain || "General";
}

export function updateAbility(session, { mistakeLabel, codeCorrect }) {
  session.ability = session.ability || {};
  const topic = topicFor(session);
  let a = session.ability[topic] ?? 0.5;
  if (mistakeLabel && LABEL_DELTA[mistakeLabel] !== undefined) a += LABEL_DELTA[mistakeLabel];
  if (codeCorrect) a += 0.1;
  a = Math.max(0, Math.min(1, a));
  session.ability[topic] = a;

  // communication subtopic derived from filler/structure labels
  let comm = session.ability["Communication"] ?? 0.5;
  if (mistakeLabel === "rambling" || mistakeLabel === "no-structure") comm -= 0.1;
  if (mistakeLabel === "good-answer") comm += 0.08;
  session.ability["Communication"] = Math.max(0, Math.min(1, comm));
  return session.ability;
}

export function difficultyFor(ability) {
  if (ability >= 0.7) return "hard";
  if (ability >= 0.45) return "medium";
  return "easy";
}

// Build the hint text injected into the interviewer prompt for the NEXT question.
export function buildDifficultyHint(session) {
  session.ability = session.ability || {};
  const topic = topicFor(session);
  const a = session.ability[topic] ?? 0.5;
  const diff = difficultyFor(a);
  const comm = session.ability["Communication"] ?? 0.5;
  const commNote =
    comm < 0.45 ? "The candidate is struggling with structure/fluency — ask a simpler, more guided question and let them explain step by step."
    : comm > 0.7 ? "The candidate communicates clearly — you may probe with a more open, challenging follow-up."
    : "";
  return `ADAPTIVE HINT (Module 2): current estimated ability on "${topic}" is ${a.toFixed(2)} → ask a ${diff} difficulty question on ${topic}. ${commNote}`.trim();
}
