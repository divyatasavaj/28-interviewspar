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

// Topic keywords for detecting question category from LLM output / user answer
const TOPIC_KEYWORDS = {
  "Data Structures & Algorithms": ["array", "hash", "tree", "graph", "sort", "search", "dynamic programming", "recursion", "binary", "heap", "stack", "queue", "linked list", "complexity", "big-o"],
  "System Design": ["design", "architecture", "scale", "database", "cache", "queue", "load balancer", "microservice", "api", "shard", "replica", "consistency", "availability", "latency", "throughput"],
  "Communication": ["explain", "describe", "tell me", "walk me through", "example", "situation", "team", "conflict", "leadership", "stakeholder"],
  "Domain Knowledge": [], // filled dynamically from session.domain
  "Cultural Alignment": ["value", "culture", "mission", "team", "collaboration", "feedback", "growth", "learning", "ownership", "integrity", "diversity", "inclusion"],
};

export function topicFor(session, answerText = "") {
  const text = (answerText || "").toLowerCase();
  const domain = session.domain || "General";
  
  // Check for system design keywords first (high priority)
  if (TOPIC_KEYWORDS["System Design"].some(k => text.includes(k))) {
    return "System Design";
  }
  // Check for DSA keywords
  if (TOPIC_KEYWORDS["Data Structures & Algorithms"].some(k => text.includes(k))) {
    return "Data Structures & Algorithms";
  }
  // Check for cultural alignment keywords
  if (TOPIC_KEYWORDS["Cultural Alignment"].some(k => text.includes(k))) {
    return "Cultural Alignment";
  }
  // Check for communication/behavioral keywords
  if (TOPIC_KEYWORDS["Communication"].some(k => text.includes(k))) {
    return "Communication";
  }
  // Default to domain
  return domain;
}

export function updateAbility(session, { mistakeLabel, codeCorrect, answerText }) {
  session.ability = session.ability || {};
  
  // Determine the topic from the answer content
  const topic = topicFor(session, answerText);
  let a = session.ability[topic] ?? 0.5;
  if (mistakeLabel && LABEL_DELTA[mistakeLabel] !== undefined) a += LABEL_DELTA[mistakeLabel];
  if (codeCorrect) a += 0.1;
  a = Math.max(0, Math.min(1, a));
  session.ability[topic] = a;

  // Communication subtopic derived from filler/structure labels
  let comm = session.ability["Communication"] ?? 0.5;
  if (mistakeLabel === "rambling" || mistakeLabel === "no-structure") comm -= 0.1;
  if (mistakeLabel === "good-answer") comm += 0.08;
  session.ability["Communication"] = Math.max(0, Math.min(1, comm));

  // Cultural alignment tracked separately from communication
  let cultural = session.ability["Cultural Alignment"] ?? 0.5;
  if (mistakeLabel === "good-answer" && topic === "Cultural Alignment") cultural += 0.1;
  if (mistakeLabel === "underselling" && topic === "Cultural Alignment") cultural -= 0.05;
  session.ability["Cultural Alignment"] = Math.max(0, Math.min(1, cultural));

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
  const topics = Object.keys(session.ability).filter(k => k !== "Communication" && k !== "Cultural Alignment");
  const primaryTopic = topics[0] || (session.domain || "General");
  const a = session.ability[primaryTopic] ?? 0.5;
  const diff = difficultyFor(a);
  const comm = session.ability["Communication"] ?? 0.5;
  const cultural = session.ability["Cultural Alignment"] ?? 0.5;
  
  const commNote =
    comm < 0.45 ? "The candidate is struggling with structure/fluency — ask a simpler, more guided question and let them explain step by step."
    : comm > 0.7 ? "The candidate communicates clearly — you may probe with a more open, challenging follow-up."
    : "";
    
  const culturalNote =
    cultural < 0.45 ? "Candidate shows weak cultural alignment signals — include a values/behavioral question."
    : cultural > 0.7 ? "Candidate demonstrates strong cultural alignment — you may skip behavioral probing."
    : "";

  return `ADAPTIVE HINT (Module 2): current estimated ability on "${primaryTopic}" is ${a.toFixed(2)} → ask a ${diff} difficulty question on ${primaryTopic}. ${commNote} ${culturalNote}`.trim();
}
