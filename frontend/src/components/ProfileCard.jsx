import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { updateProfile, ROLE_LABELS } from "../api.js";

// Role-specific profile fields collected at signup and shown on each module's dashboard.
// `csv` fields (e.g. domains) are stored as arrays and edited as comma-separated text.
const FIELDS = {
  student: [
    { key: "college", label: "College" },
    { key: "year", label: "Year" },
    { key: "targetRole", label: "Target role" },
    { key: "goal", label: "Goal" },
  ],
  developer: [
    { key: "domains", label: "Domains", csv: true },
    { key: "experience", label: "Experience (yrs)" },
    { key: "bio", label: "Bio" },
    { key: "rate", label: "Rate ₹/interview" },
  ],
  company: [
    { key: "companyName", label: "Company" },
    { key: "industry", label: "Industry" },
    { key: "size", label: "Size" },
    { key: "website", label: "Website" },
  ],
  admin: [{ key: "name", label: "Name" }],
};

const field = "w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none";

// Reusable profile dashboard card — leads every role's module view. Shows the
// signup-collected info and lets the user edit it (PATCH /api/auth/me).
export default function ProfileCard() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!user) return null;
  const fields = FIELDS[user.role] || [];
  const p = user.profile || {};

  function valueFor(f) {
    let v = p[f.key];
    if (v === undefined || v === null || v === "") v = user[f.key];
    if (Array.isArray(v)) return v.join(", ");
    return v;
  }

  function startEdit() {
    const d = {};
    for (const f of fields) {
      let v = p[f.key];
      if (v === undefined || v === null) v = user[f.key];
      d[f.key] = Array.isArray(v) ? v.join(", ") : (v ?? "");
    }
    if (user.role === "admin") d.name = user.name;
    setDraft(d);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const profile = {};
      for (const f of fields) {
        let val = draft[f.key];
        if (f.csv) val = String(val).split(",").map((s) => s.trim()).filter(Boolean);
        profile[f.key] = val;
      }
      const patch = { profile };
      if (user.role === "admin") patch.name = draft.name;
      const updated = await updateProfile(patch);
      setUser(updated);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const initial = user.name?.[0]?.toUpperCase() || "?";

  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-violet text-xl font-bold text-white">{initial}</div>
          <div>
            <h2 className="text-lg font-bold">{user.name}</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{ROLE_LABELS[user.role] || user.role}</span>
            {user.handle && <span className="ml-2 text-xs text-ink-muted">handle {user.handle}</span>}
          </div>
        </div>
        {!editing && (
          <button onClick={startEdit} className="rounded-full bg-white/10 px-3 py-1 text-xs">Edit profile</button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          {user.role === "admin" && (
            <div>
              <label className="text-xs text-ink-muted">Name</label>
              <input className={field} value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-ink-muted">{f.label}</label>
              <input className={field} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            </div>
          ))}
          {err && <p className="text-sm text-score-poor">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={save}
              className="rounded-full bg-brand-green px-4 py-1 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-full bg-white/10 px-4 py-1 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {fields.map((f) => {
            const v = valueFor(f);
            if (v === undefined || v === null || v === "") return null;
            return (
              <div key={f.key} className="flex justify-between border-b border-white/5 py-1">
                <dt className="text-ink-muted">{f.label}</dt>
                <dd className="text-right">{String(v)}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
