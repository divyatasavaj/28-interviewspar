import { useEffect, useState } from "react";
import { addSample, getCollectCount } from "../api";

const LABELS = [
  "good-answer", "rambling", "no-structure", "resume-gap", "silent-coding", "underselling",
];

// STEP 5 — manual data-collection UI for the mistake classifier.
// Enter a sample answer + hand-assigned label; features are auto-extracted and saved to CSV.
export default function CollectView() {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("rambling");
  const [latency, setLatency] = useState("0");
  const [codeCorrect, setCodeCorrect] = useState(false);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCollectCount().then((c) => setCount(c.count)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await addSample({
        answerText: text, mistakeLabel: label,
        responseLatency: Number(latency) || 0, codeCorrect,
      });
      setCount(r.count);
      setText("");
      setMsg(`Saved! ${r.count}/150 samples collected.`);
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none";
  const pct = Math.min(100, Math.round((count / 150) * 100));

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Classifier Data Collection</h1>
        <p className="text-sm text-ink-muted">Target: 150–300 labeled samples (Step 5).</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-brand-green" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-muted">{count} / 150 collected</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <textarea className={field} rows={5} placeholder="Paste a sample interview answer…"
          value={text} onChange={(e) => setText(e.target.value)} required />
        <div className="flex gap-2">
          <select className={field} value={label} onChange={(e) => setLabel(e.target.value)}>
            {LABELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input className={field} type="number" min="0" step="0.1" placeholder="latency s"
            value={latency} onChange={(e) => setLatency(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={codeCorrect} onChange={(e) => setCodeCorrect(e.target.checked)} />
          code answer correct (technical only)
        </label>
        <button disabled={busy} className="w-full rounded-full bg-brand-violet py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Add sample"}
        </button>
        {msg && <p className="text-sm text-ink-muted">{msg}</p>}
      </form>
    </div>
  );
}
