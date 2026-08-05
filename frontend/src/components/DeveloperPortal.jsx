import { useEffect, useState } from "react";
import { listRoles, acceptGig } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import ProfileCard from "./ProfileCard.jsx";

// Developer = the gig-side interviewer (PRD Module 7). They browse available roles,
// accept gigs (simulated), and see their assignment + payout summary.
export default function DeveloperPortal() {
  const { user } = useAuth();
  const [data, setData] = useState({ roles: [], assignments: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try { setData(await listRoles()); } catch (e) { setMsg(e.message); }
  }
  useEffect(() => { load(); }, []);

  const open = data.roles.filter((r) => !data.assignments.includes(r.id));
  const accepted = data.roles.filter((r) => data.assignments.includes(r.id));

  async function accept(roleId, handle) {
    setBusy(true); setMsg(null);
    try {
      await acceptGig(roleId, handle);
      setMsg(`Accepted gig ${roleId} as ${handle}.`);
      await load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <ProfileCard />
      <p className="text-xs text-ink-muted">Two-way anonymization: your real identity stays hidden from the company until a hire decision.</p>

      <section>
        <h3 className="mb-2 font-semibold">Available gigs</h3>
        {open.length === 0 && <p className="text-sm text-ink-muted">No open gigs match your domains yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {open.map((r) => (
            <div key={r.id} className="rounded-card border border-white/10 bg-white/5 p-3">
              <p className="font-medium">{r.domain}</p>
              <p className="text-xs text-ink-muted">Level: {r.level || "—"} · posted by {r.company}</p>
              <button disabled={busy} onClick={() => accept(r.id, user.handle)}
                className="mt-2 rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
                Accept gig
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Your assignments</h3>
        {accepted.length === 0 && <p className="text-sm text-ink-muted">You haven't accepted any gigs yet.</p>}
        <ul className="space-y-2">
          {accepted.map((r) => (
            <li key={r.id} className="rounded-card border border-white/10 bg-white/5 p-3 text-sm">
              {r.domain} · {r.level || "—"} · company: {r.company}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          Simulated payout: ₹{accepted.length * 1500} ({accepted.length} × ₹1500/interview, 75% of ₹2000). Real payouts land post-MVP via Razorpay/Stripe sandbox.
        </p>
      </section>

      {msg && <p className="text-sm text-score-warn">{msg}</p>}
    </div>
  );
}
