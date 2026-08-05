import { useState } from "react";
import { postRole, matchInterviewer, mockPayment } from "../api";
import { useAuth } from "../AuthContext.jsx";

// STEP 11 — marketplace simulation: post a role, rule-based match, mock payment split,
// two-way anonymization. All transactions simulated (no real gateway).
export default function Marketplace() {
  const { user } = useAuth();
  const [form, setForm] = useState({ company: "", domain: "Software Engineering", level: "Junior", candidate: "" });
  const [roleId, setRoleId] = useState(null);
  const [match, setMatch] = useState(null);
  const [pay, setPay] = useState(null);
  const [err, setErr] = useState(null);

  async function post() {
    setErr(null);
    try {
      const r = await postRole({ ...form, candidates: form.candidate ? [{ name: form.candidate, role: form.domain }] : [] });
      setRoleId(r.roleId);
    } catch (e) { setErr(e.message); }
  }

  async function doMatch() {
    setErr(null);
    try { setMatch(await matchInterviewer(roleId)); } catch (e) { setErr(e.message); }
  }

  async function doPay() {
    setErr(null);
    try { setPay(await mockPayment(roleId, 2000)); } catch (e) { setErr(e.message); }
  }

  const field = "w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none";
  const canPost = user?.role === "company";

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">Marketplace (simulated)</h1>

      {canPost ? (
        <div className="space-y-2 rounded-card border border-white/10 bg-white/5 p-4">
          <input className={field} placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <select className={field} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
            {["Software Engineering", "Data Science", "Frontend", "Backend", "Product Management", "HR"].map((d) => <option key={d}>{d}</option>)}
          </select>
          <input className={field} placeholder="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
          <input className={field} placeholder="Candidate name" value={form.candidate} onChange={(e) => setForm({ ...form, candidate: e.target.value })} />
          <button onClick={post} className="w-full rounded-full bg-brand-violet py-2 text-sm font-semibold text-white">Post Role</button>
        </div>
      ) : (
        <div className="rounded-card border border-white/10 bg-white/5 p-4 text-sm text-ink-muted">
          Role posting is available to <b>Company</b> accounts. Use the Company Portal to post a role, or log in as a company to try it here.
        </div>
      )}

      {roleId && (
        <div className="space-y-2 rounded-card border border-white/10 bg-white/5 p-4">
          <button onClick={doMatch} className="w-full rounded-full bg-white/10 py-2 text-sm">Match Interviewer</button>
          {match && (
            <div className="text-sm">
              <p>Matched handle: <b>{match.interviewerHandle}</b></p>
              <p className="text-xs text-ink-muted">{match.note}</p>
              <button onClick={doPay} className="mt-2 w-full rounded-full bg-brand-green py-2 text-sm font-semibold text-white">Run mock payment (₹2000)</button>
            </div>
          )}
          {pay && (
            <div className="text-sm text-ink-muted">
              Simulated split — interviewer ₹{pay.interviewerShare} / platform ₹{pay.platformFee}
            </div>
          )}
        </div>
      )}
      {err && <p className="text-sm text-score-poor">{err}</p>}
      <p className="text-xs text-ink-muted">No real payment gateway — all transactions are simulated records (PRD Module 7).</p>
    </div>
  );
}
