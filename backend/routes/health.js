import { Router } from "express";

// STEP 0 health check — proves the backend is up and reachable from the frontend.
const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "InterviewSpar backend is live",
    time: new Date().toISOString(),
  });
});

export default router;
