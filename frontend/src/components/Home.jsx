import { useEffect, useState } from "react";
import { startSession, getHealth } from "../api";

const DOMAINS = [
  "Software Engineering", "Data Science", "Frontend", "Backend",
  "Product Management", "HR",
];

// STEP 2 — basic info collection. On submit, creates a session and returns calibration questions.
export default function Home({ onStart }) {
  const [form, setForm] = useState({
    name: "", domain: "Software Engineering", experience: "",
    persona: "hr", mode: "practice",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [backendUp, setBackendUp] = useState(null); // null=checking, true/false

  // surface backend connectivity so a dead backend isn't a cryptic 500 (rules.md §3)
  useEffect(() => {
    getHealth()
      .then(() => setBackendUp(true))
      .catch(() => setBackendUp(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const data = await startSession(form);
      onStart({ sessionId: data.sessionId, ...data });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none";
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">Start a practice session</h1>
      <p className="mb-4 text-sm">
        {backendUp === null && <span className="text-ink-muted">checking backend…</span>}
        {backendUp === true && <span className="text-score-good">● backend connected</span>}
        {backendUp === false && (
          <span className="text-score-poor">
            ● backend offline — run <code>npm run dev</code> in /backend (port 4000)
          </span>
        )}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input className={field} placeholder="Your name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={field} value={form.domain}
          onChange={(e) => setForm({ ...form, domain: e.target.value })}>
          {DOMAINS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <input className={field} placeholder="Experience (e.g. 2 yrs)" value={form.experience}
          onChange={(e) => setForm({ ...form, experience: e.target.value })} />
        <div className="flex gap-2">
          <select className={field} value={form.persona}
            onChange={(e) => setForm({ ...form, persona: e.target.value })}>
            <option value="hr">HR round</option>
            <option value="tech">Technical round</option>
          </select>
          <select className={field} value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="practice">Practice mode</option>
            <option value="assessment">Assessment mode</option>
          </select>
        </div>
        {err && <p className="text-sm text-score-poor">Error: {err}</p>}
        <button disabled={busy || backendUp === false} className="w-full rounded-full bg-brand-violet py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Starting…" : "Start Session"}
        </button>
      </form>
    </div>
  );
}
