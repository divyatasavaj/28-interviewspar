import { Router } from "express";
import { getSession } from "../services/sessions.js";
import { completeSession, listSessions, getSessionReport } from "../services/store.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// STEP 10 — end a live session and archive it for the dashboard/report.
// POST /api/sessions/end  {sessionId}
router.post("/end", authRequired, (req, res) => {
  const { sessionId } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  const rec = completeSession(session);
  res.json({ ok: true, id: rec.id });
});

// list of archived sessions — role-aware:
// admin/company see all (candidate reports); student sees only their own; developer sees none.
router.get("/", authRequired, (req, res) => {
  let list = listSessions();
  if (req.user.role === "student") list = list.filter((s) => s.ownerId === req.user.id);
  if (req.user.role === "developer") list = [];
  res.json(list);
});

// full report for one session. Allowed to: admin, company, or the session owner.
router.get("/:id", authRequired, (req, res) => {
  const rec = getSessionReport(req.params.id);
  if (!rec) return res.status(404).json({ error: "not found" });
  const allowed =
    req.user.role === "admin" ||
    req.user.role === "company" ||
    rec.ownerId === req.user.id;
  if (!allowed) return res.status(403).json({ error: "forbidden" });
  res.json(rec);
});

export default router;
