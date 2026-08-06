import { Router } from "express";
import { getSession, updateSession } from "../services/sessions.js";

const router = Router();

// STEP 8 — integrity event log. Rule-based signals are sent from the browser
// (tab-switch, blur, fullscreen-exit, copy-paste, latency anomaly, face events).
// POST /api/integrity/log  {sessionId, event, detail?}
router.post("/log", (req, res) => {
  const { sessionId, event, detail } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  session.integrityLog = session.integrityLog || [];
  const entry = { event, detail: detail || null, at: new Date().toISOString() };
  session.integrityLog.push(entry);
  res.json({ ok: true, count: session.integrityLog.length });
});

router.get("/:sessionId", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  res.json({ log: session.integrityLog || [] });
});

export default router;
