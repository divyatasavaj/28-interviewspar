import { useEffect, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { listSessions, getSessionReport } from "../api";
import ProfileCard from "./ProfileCard.jsx";

// STEP 10 — student dashboard: profile, ability radar, mistake journal, session history, report export.
export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => { listSessions().then(setSessions).catch(() => setSessions([])); }, []);

  async function openReport(id) {
    try { setReport(await getSessionReport(id)); } catch { setReport(null); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <ProfileCard />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 font-semibold">Session history</h2>
          {sessions.length === 0 && <p className="text-sm text-ink-muted">No completed sessions yet. End a session to see it here.</p>}
          <ul className="space-y-1 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded bg-ink-sidebar px-3 py-2">
                <span>{s.name || "Candidate"} · {s.domain} · {s.mode}</span>
                <button onClick={() => openReport(s.id)} className="text-brand-violet">Report</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 font-semibold">Ability estimate</h2>
          {report ? <AbilityRadar ability={report.ability || {}} /> : <p className="text-sm text-ink-muted">Open a report to see the ability breakdown.</p>}
        </div>
      </div>

      {report && (
        <div className="rounded-card border border-white/10 bg-white/5 p-4" id="report-print">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Session report — {report.name || "Candidate"}</h2>
            <button onClick={() => window.print()} className="rounded-full bg-brand-green px-3 py-1 text-xs font-semibold text-white">Export PDF</button>
          </div>
          <p className="text-sm text-ink-muted">{report.domain} · {report.persona} · {report.mode} · ended {new Date(report.endedAt).toLocaleString()}</p>

          <h3 className="mt-3 text-sm font-semibold">Mistake journal ({report.mistakeJournal?.length || 0})</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {report.mistakeJournal?.map((m, i) => (
              <li key={i} className="rounded bg-ink-sidebar px-2 py-1">
                <b className="text-score-warn">{m.label}</b> — “{String(m.answer).slice(0, 80)}…”
                {m.top_features && <span className="text-ink-muted"> · {m.top_features.map((f) => `${f.feature}=${f.value}`).join(", ")}</span>}
              </li>
            ))}
          </ul>

          <h3 className="mt-3 text-sm font-semibold">Integrity flags ({report.integrityLog?.length || 0})</h3>
          <p className="text-xs text-ink-muted">{report.integrityLog?.map((e) => e.event).join(", ") || "none"}</p>
        </div>
      )}
    </div>
  );
}

function AbilityRadar({ ability }) {
  const data = Object.entries(ability).map(([topic, v]) => ({ topic, ability: Math.round(v * 100) }));
  if (!data.length) return <p className="text-sm text-ink-muted">No ability data.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="topic" />
        <PolarRadiusAxis domain={[0, 100]} />
        <Radar dataKey="ability" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
