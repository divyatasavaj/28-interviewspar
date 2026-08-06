// STEP 5/6 — lightweight feature extractor for interview answers.
// Used now to auto-fill the labeled dataset (Step 5) and expanded in Step 6.
// Kept deterministic / rule-based (no LLM) so the classifier input is numeric & defensible.

const FILLER_WORDS = [
  "um", "uh", "like", "you know", "basically", "actually", "literally",
  "right", "okay", "so", "well", "hmm", "i mean",
];
const HEDGE_WORDS = [
  "maybe", "i think", "sort of", "kind of", "perhaps", "possibly",
  "i guess", "somewhat", "might", "probably", "i suppose", "not sure",
];
const STAR_WORDS = ["situation", "task", "action", "result", "when i", "we ", "because"];

export function extractFeatures(text = "", { responseLatency = 0, codeCorrect = 0 } = {}) {
  const lower = ` ${text.toLowerCase()} `;
  const words = text.trim().split(/\s+/).filter(Boolean);

  const fillerWordCount = FILLER_WORDS.reduce(
    (n, w) => n + (lower.split(w).length - 1),
    0
  );
  const hedgeWordFreq = HEDGE_WORDS.reduce(
    (n, w) => n + (lower.split(w).length - 1),
    0
  );
  const starPresent = STAR_WORDS.some((w) => lower.includes(w)) ? 1 : 0;

  return {
    star_present: starPresent,
    hedge_word_freq: hedgeWordFreq,
    filler_word_count: fillerWordCount,
    answer_length: words.length,
    response_latency: responseLatency,
    code_correct: codeCorrect,
  };
}

// CSV column order must match ml/evaluate.py FEATURE_COLUMNS + label
export const CSV_HEADER =
  "answer_text,star_present,hedge_word_freq,filler_word_count,answer_length,response_latency,code_correct,mistake_label";
