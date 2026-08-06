import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { ROLE_LABELS } from "../api.js";

const DEMO = [
  { email: "admin@interviewspar.dev", role: "admin", label: "Admin" },
  { email: "student@demo.dev", role: "student", label: "Student" },
  { email: "developer@demo.dev", role: "developer", label: "Developer" },
  { email: "company@demo.dev", role: "company", label: "Company" },
];
const ROLES = ["student", "developer", "company"];

const DOMAINS = ["Software Engineering", "Data Science", "Frontend", "Backend", "Product Management", "HR"];
const YEARS = ["1st year", "2nd year", "3rd year", "Final year", "Graduate", "Working professional"];
const GOALS = ["Crack job interviews", "Improve communication", "Practice coding", "General prep"];
const INDUSTRIES = ["Technology", "Finance", "Healthcare", "E-commerce", "Education", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", name: "", role: "student",
    domains: "", companyName: "", college: "", year: YEARS[3], targetRole: DOMAINS[0], goal: GOALS[0],
    experience: "", bio: "", rate: "", industry: INDUSTRIES[0], size: SIZES[2], website: "",
  });

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        const payload = { email: form.email, password: form.password, name: form.name, role: form.role };
        if (form.role === "developer") {
          payload.domains = form.domains.split(",").map((s) => s.trim()).filter(Boolean);
          payload.profile = { experience: form.experience, bio: form.bio, rate: Number(form.rate) || 0 };
        }
        if (form.role === "company") {
          payload.companyName = form.companyName;
          payload.profile = { industry: form.industry, size: form.size, website: form.website };
        }
        if (form.role === "student") {
          payload.college = form.college;
          payload.profile = { year: form.year, targetRole: form.targetRole, goal: form.goal };
        }
        await register(payload);
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  function demoLogin(email) {
    setForm({ ...form, email, password: "password" });
    setMode("login");
  }

  const field = "w-full rounded bg-ink-sidebar px-3 py-2 text-sm outline-none";

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">InterviewSpar</h1>
      <p className="mb-4 text-sm text-ink-muted">Role-based login — pick your role to enter the right workspace.</p>

      <div className="mb-4 flex gap-2 text-sm">
        {["login", "register"].map((m) => (
          <button key={m} onClick={() => { setMode(m); setErr(null); }}
            className={`rounded-full px-3 py-1 ${mode === m ? "bg-brand-violet text-white" : "bg-white/10"}`}>
            {m === "login" ? "Login" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        )}
        <input className={field} placeholder="Email" type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={field} placeholder="Password (min 4 chars)" type="password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {mode === "register" && (
          <>
            <input className={field} placeholder="Full name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />

            {form.role === "student" && (
              <>
                <input className={field} placeholder="College / University" value={form.college}
                  onChange={(e) => setForm({ ...form, college: e.target.value })} />
                <select className={field} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
                <select className={field} value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}>
                  {DOMAINS.map((d) => <option key={d}>{d}</option>)}
                </select>
                <select className={field} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                  {GOALS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </>
            )}

            {form.role === "developer" && (
              <>
                <input className={field} placeholder="Domains (comma separated, e.g. Software Engineering, Backend)"
                  value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} />
                <input className={field} placeholder="Years of experience" type="number" min="0" value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                <textarea className={field} placeholder="Short bio" rows={2} value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                <input className={field} placeholder="Expected rate ₹ / interview" type="number" min="0" value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </>
            )}

            {form.role === "company" && (
              <>
                <input className={field} placeholder="Company name" value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                <select className={field} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
                <select className={field} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                  {SIZES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <input className={field} placeholder="Website (optional)" value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </>
            )}
          </>
        )}
        {err && <p className="text-sm text-score-poor">Error: {err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-brand-violet py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "…" : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>

      <div className="mt-5 rounded-card border border-white/10 bg-white/5 p-3 text-xs text-ink-muted">
        <p className="mb-2">Demo accounts (password: <code>password</code>):</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button key={d.email} onClick={() => demoLogin(d.email)}
              className="rounded-full bg-white/10 px-2 py-1 hover:bg-white/20">
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
