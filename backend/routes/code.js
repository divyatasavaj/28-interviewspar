import { Router } from "express";
import { publicProblems, getProblem } from "../data/codingProblems.js";
import { runCode } from "../services/codeRunner.js";
import { codeSimilarity } from "../services/similarity.js";

const router = Router();

// STEP 4 — list available coding problems (no answers exposed).
router.get("/problems", (_req, res) => {
  res.json(publicProblems());
});

// STEP 4 — run submitted code against the problem's test cases.
// POST /api/code/run  body: {problemId, language, code}
router.post("/run", async (req, res) => {
  const { problemId, language, code } = req.body;
  const problem = getProblem(problemId);
  if (!problem) return res.status(404).json({ error: "problem not found" });
  if (!["javascript", "python"].includes(language)) return res.status(400).json({ error: "unsupported language" });
  if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "empty code" });

  const result = await runCode({ language, code, testCases: problem.testCases });
  if (result.error) return res.status(200).json({ error: result.error, results: [], passed: 0, total: problem.testCases.length });
  res.json(result);
});

// STEP 8 — similarity of submitted code vs known solution bank (flags potential copying).
// POST /api/code/similarity  {problemId, code, language}
router.post("/similarity", (req, res) => {
  const { problemId, code, language = "javascript" } = req.body;
  const problem = getProblem(problemId);
  if (!problem) return res.status(404).json({ error: "problem not found" });
  const known = problem.knownSolution?.[language];
  if (!known) return res.status(400).json({ error: "no known solution for language" });
  const score = codeSimilarity(code, known);
  res.json({ similarity: score, flag: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low" });
});

export default router;
