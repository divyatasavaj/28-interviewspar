import { useEffect, useState } from "react";
import { postRole, listRoles, matchInterviewer, mockPayment } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Dashboard from "./Dashboard.jsx";
import ProfileCard from "./ProfileCard.jsx";

const DOMAINS = ["Software Engineering", "Data Science", "Frontend", "Backend", "Product Management", "HR"];

// Company = posts roles, gets matched interviewers (anonymized), runs simulated billing,
// and reviews candidate reports (PRD Module 7 / Module 8).
export default function CompanyPortal() {
  const { user } = useAuth();
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [level, setLevel] = useState("Junior");
  const [candidates, setCandidates] = useState("");
  const [roles, setRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try { const d = await listRoles(); setRoles(d.roles); } catch (e) { setMsg(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const cand = candidates.split("\n").map((s) => s.trim()).filter(Boolean)
        .map((line) => ({ name: line, role: domain }));
      const r = await postRole({ domain, level, candidates: cand });
      setMsg(`Role posted (${r.roleId}).`);
      setCandidates("");
      await load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function doMatch(roleId) {
    try { const m = await matchInterviewer(roleId); setMsg(`Matched interviewer: ${m.interviewerHandle} (${m.note})`); }
    catch (e) { setMsg(e.message); }
  }
  async function doPay(roleId) {
    try { const p = await mockPayment(roleId, 2000); setMsg(`Simulated payment: ₹${p.total} → interviewer ₹${p.interviewerShare} / platform ₹${p.platformFee}`); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <ProfileCard />

      <form onSubmit={submit} className="space-y-3 rounded-card border border-white/10 bg-white/5 p-4">
        <h3 className="font-semibold">Post a role</h3>
        <div className="flex gap-2">
          <select className="flex-1 rounded bg-ink-sidebar px-3 py-2 text-sm outline-none" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAINS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input className="w-32 rounded bg-ink-sidebar px-3 py-2 text-sm outline-none" placeholder="Level" value={level}
            onChange={(e) => setLevel(e.target.value)} />
        </div>
        <textarea className="w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none" rows={2}
          placeholder="Candidates (one per line, optional)" value={candidates}
          onChange={(e) => setCandidates(e.target.value)} />
        <button disabled={busy} className="rounded-full bg-brand-violet px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Post role
        </button>
      </form>

      <section>
        <h3 className="mb-2 font-semibold">Your posted roles</h3>
        {roles.length === 0 && <p className="text-sm text-ink-muted">No roles posted yet.</p>}
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-card border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-medium">{r.domain} · {r.level || "—"}</p>
              <p className="text-xs text-ink-muted">posted {new Date(r.postedAt).toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => doMatch(r.id)} className="rounded-full bg-white/10 px-3 py-1 text-xs">Match interviewer</button>
                <button onClick={() => doPay(r.id)} className="rounded-full bg-white/10 px-3 py-1 text-xs">Simulate payment</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Candidate reports</h3>
        <Dashboard />
      </section>

      {msg && <p className="text-sm text-score-warn">{msg}</p>}
    </div>
  );
}
