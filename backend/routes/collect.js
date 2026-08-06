import { Router } from "express";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { CSV_HEADER, extractFeatures } from "../services/featureExtractor.js";

const router = Router();

// STEP 5 — mistake-classifier data collection.
// The team/testers submit an answer + hand-assigned mistake label; basic features are
// auto-extracted and appended to ml/data/labeled_answers.csv (seeded to 150-300 samples).
const CSV_PATH = new URL("../../ml/data/labeled_answers.csv", import.meta.url).pathname;

const VALID_LABELS = [
  "good-answer", "rambling", "no-structure", "resume-gap", "silent-coding", "underselling",
];

async function ensureCsv() {
  if (!existsSync(CSV_PATH)) {
    await writeFile(CSV_PATH, CSV_HEADER + "\n", "utf8");
  }
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.post("/add", async (req, res) => {
  const { answerText, mistakeLabel, responseLatency, codeCorrect } = req.body;
  if (!answerText || !answerText.trim()) return res.status(400).json({ error: "answerText required" });
  if (!VALID_LABELS.includes(mistakeLabel)) {
    return res.status(400).json({ error: `invalid label. use one of: ${VALID_LABELS.join(", ")}` });
  }
  const feats = extractFeatures(answerText, {
    responseLatency: Number(responseLatency) || 0,
    codeCorrect: codeCorrect ? 1 : 0,
  });
  const row = [
    csvCell(answerText),
    feats.star_present,
    feats.hedge_word_freq,
    feats.filler_word_count,
    feats.answer_length,
    feats.response_latency,
    feats.code_correct,
    mistakeLabel,
  ].join(",");

  await ensureCsv();
  await appendFile(CSV_PATH, row + "\n", "utf8");
  const count = (await readFile(CSV_PATH, "utf8")).trim().split("\n").length - 1;
  res.json({ ok: true, count, target: 150 });
});

// progress check for the team
router.get("/count", async (_req, res) => {
  if (!existsSync(CSV_PATH)) return res.json({ count: 0, target: 150 });
  const count = (await readFile(CSV_PATH, "utf8")).trim().split("\n").length - 1;
  res.json({ count, target: 150 });
});

export default router;
