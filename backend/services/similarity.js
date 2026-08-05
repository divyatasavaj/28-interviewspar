// STEP 8/4 — code similarity check against the bank of known solutions.
// Token-overlap (Jaccard on token frequency) — no external ML needed (PRD Module 5).
export function codeSimilarity(submitted = "", known = "") {
  const tokenize = (s) =>
    s
      .replace(/[^a-zA-Z0-9_]/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  const a = tokenize(submitted);
  const b = tokenize(known);
  if (!a.length || !b.length) return 0;

  const fa = freq(a);
  const fb = freq(b);
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  let inter = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const x = fa[k] || 0;
    const y = fb[k] || 0;
    inter += x * y;
    magA += x * x;
    magB += y * y;
  }
  const cosine = inter / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  return Math.round(cosine * 100) / 100;
}

function freq(arr) {
  const m = {};
  for (const t of arr) m[t] = (m[t] || 0) + 1;
  return m;
}
