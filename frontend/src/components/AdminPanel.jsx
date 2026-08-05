import { useEffect, useState } from "react";
import { listUsers, listRoles, ROLE_LABELS } from "../api.js";
import Dashboard from "./Dashboard.jsx";
import ProfileCard from "./ProfileCard.jsx";

// Admin = platform oversight: manage users, see all marketplace roles and all session reports.
export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    listUsers().then(setUsers).catch((e) => setErr(e.message));
    listRoles().then((d) => setRoles(d.roles)).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <ProfileCard />
      <h2 className="text-lg font-bold">Admin Panel</h2>
      {err && <p className="text-sm text-score-poor">Error: {err}</p>}

      <section className="rounded-card border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 font-semibold">Users ({users.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr><th className="py-1 pr-3">Name</th><th className="py-1 pr-3">Email</th><th>Role</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-1 pr-3">{u.name}</td>
                  <td className="py-1 pr-3 text-ink-muted">{u.email}</td>
                  <td><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{ROLE_LABELS[u.role] || u.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 font-semibold">Marketplace roles ({roles.length})</h3>
        <ul className="space-y-1 text-sm">
          {roles.map((r) => (
            <li key={r.id} className="border-t border-white/5 pt-1">{r.domain} · {r.level || "—"} · {r.company}</li>
          ))}
          {roles.length === 0 && <li className="text-ink-muted">No roles posted yet.</li>}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">All session reports</h3>
        <Dashboard />
      </section>
    </div>
  );
}
