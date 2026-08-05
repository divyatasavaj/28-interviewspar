import { Router } from "express";
import { classifyAnswer } from "../services/classifierClient.js";

const router = Router();

// STEP 6 — mistake classifier prediction + explainability.
// POST /api/classifier/predict  {answerText, responseLatency?, codeCorrect?}
router.post("/predict", async (req, res) => {
  const { answerText, responseLatency, codeCorrect } = req.body;
  if (!answerText || !answerText.trim()) return res.status(400).json({ error: "answerText required" });
  const result = await classifyAnswer({ answerText, responseLatency: Number(responseLatency) || 0, codeCorrect: codeCorrect ? 1 : 0 });
  res.json(result);
});

export default router;
