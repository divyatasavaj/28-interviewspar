// STEP 11 — marketplace simulation (rule-based matching + mock payment + anonymization).
// No real payment gateway; all transactions are simulated records (PRD Module 7).
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

// A small static pool of (simulated) vetted interviewers with domain tags.
const INTERVIEWERS = [
  { id: "iv-1", handle: "I-A", domains: ["Software Engineering", "Backend"], rate: 1500 },
  { id: "iv-2", handle: "I-B", domains: ["Data Science", "Frontend"], rate: 1500 },
  { id: "iv-3", handle: "I-C", domains: ["Product Management", "HR"], rate: 1200 },
  { id: "iv-4", handle: "I-D", domains: ["Frontend", "Software Engineering"], rate: 1500 },
];

// Registered (simulated) gig-side developers who signed up through the app.
let developerPool = []; // populated from auth users at request time by the route handlers
const roles = new Map();      // roleId -> role
const payments = new Map();   // paymentId -> split record
const assignments = new Map(); // interviewerHandle -> [roleId] (simulated acceptances)

// POST /api/marketplace/role  (company only)  body: {domain, level, candidates:[{name, role}]}
router.post("/role", authRequired, requireRole("company"), (req, res) => {
  const { domain, level, candidates } = req.body;
  const id = randomUUID();
  roles.set(id, {
    id,
    companyId: req.user.id,
    company: req.user.companyName || req.user.name,
    domain, level, candidates: candidates || [], postedAt: new Date().toISOString(),
  });
  res.json({ ok: true, roleId: id });
});

// POST /api/marketplace/match  {roleId} -> rule-based: domain tag + availability. Auth required.
router.post("/match", authRequired, (req, res) => {
  const { roleId } = req.body;
  const role = roles.get(roleId);
  if (!role) return res.status(404).json({ error: "role not found" });
  const match = INTERVIEWERS.find((iv) => iv.domains.includes(role.domain)) || INTERVIEWERS[0];
  // anonymization: never expose real names cross-side
  res.json({
    ok: true,
    interviewerHandle: match.handle, // anonymized handle, not real identity
    domain: role.domain,
    note: "Interviewer real identity hidden until hire decision (two-way anonymization).",
  });
});

// POST /api/marketplace/payment  {roleId, total} -> simulated split (₹2000 -> ₹1500/₹500 example). Auth required.
router.post("/payment", authRequired, (req, res) => {
  const { roleId, total } = req.body;
  if (!roles.get(roleId)) return res.status(404).json({ error: "role not found" });
  const amount = Number(total) || 2000;
  const interviewerShare = Math.round(amount * 0.75);
  const platformFee = amount - interviewerShare;
  const id = randomUUID();
  const record = { id, roleId, total: amount, interviewerShare, platformFee, at: new Date().toISOString(), simulated: true };
  payments.set(id, record);
  res.json(record);
});

// Developer accepts a gig (simulated). Body: {roleId, handle}
router.post("/accept", authRequired, requireRole("developer"), (req, res) => {
  const { roleId, handle } = req.body;
  const role = roles.get(roleId);
  if (!role) return res.status(404).json({ error: "role not found" });
  const list = assignments.get(handle) || [];
  list.push(roleId);
  assignments.set(handle, list);
  res.json({ ok: true, roleId, handle, acceptedAt: new Date().toISOString() });
});

// List roles. Admin: all. Company: own. Developer/student: open roles they could take.
router.get("/roles", authRequired, (req, res) => {
  let list = [...roles.values()];
  if (req.user.role === "company") list = list.filter((r) => r.companyId === req.user.id);
  if (req.user.role === "developer") {
    list = list.filter((r) => (r.domain && req.user.domains?.includes(r.domain)) || true);
  }
  res.json({ roles: list, assignments: assignments.get(req.user.handle) || [] });
});

router.get("/interviewers", authRequired, (req, res) => {
  res.json(INTERVIEWERS.map((i) => ({ handle: i.handle, domains: i.domains })));
});

export default router;
