import { Component, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import AuthPage from "./components/AuthPage.jsx";
import Home from "./components/Home.jsx";
import SessionView from "./components/SessionView.jsx";
import CollectView from "./components/CollectView.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Marketplace from "./components/Marketplace.jsx";
import DeveloperPortal from "./components/DeveloperPortal.jsx";
import CompanyPortal from "./components/CompanyPortal.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { ROLE_LABELS } from "./api.js";

// Catch render/effect crashes so the user sees a message instead of a blank screen.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("UI crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="mb-2 text-xl font-bold text-score-poor">Something broke in the UI</h1>
          <pre className="mb-4 overflow-auto rounded bg-ink-sidebar p-3 text-left text-xs">{String(this.state.error.message || this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })} className="rounded-full bg-brand-violet px-4 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Nav shown per role (PRD target users: Student / Company / Interviewer(gig-side) / Admin).
// Each role's module view leads with a profile dashboard (ProfileCard).
const NAV = {
  student: [["practice", "Practice"], ["dashboard", "Dashboard"], ["collect", "Data Collect"], ["marketplace", "Marketplace"]],
  developer: [["interviewer", "Dashboard"], ["marketplace", "Marketplace"]],
  company: [["company", "Dashboard"], ["marketplace", "Marketplace"]],
  admin: [["admin", "Dashboard"], ["marketplace", "Marketplace"]],
};

function defaultView(role) {
  return role === "student" ? "practice" : role;
}

function Shell() {
  const { user, logout } = useAuth();
  const [view, setView] = useState(defaultView(user.role));
  const [session, setSession] = useState(null);

  function renderView() {
    switch (view) {
      case "practice":
        return session
          ? <SessionView session={session} onEnded={() => { setSession(null); setView("dashboard"); }} />
          : <Home onStart={(s) => setSession(s)} />;
      case "dashboard": return <Dashboard />;
      case "collect": return <CollectView />;
      case "marketplace": return <Marketplace />;
      case "interviewer": return <DeveloperPortal />;
      case "company": return <CompanyPortal />;
      case "admin": return <AdminPanel />;
      default: return <Dashboard />;
    }
  }

  const nav = NAV[user.role] || NAV.student;

  return (
    <div className="min-h-screen bg-ink-bg text-ink-text">
      <nav className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="mr-2 text-lg font-bold text-brand-violet">InterviewSpar</span>
        {nav.map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={navCls(view === k)}>{label}</button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
            {ROLE_LABELS[user.role] || user.role}: {user.name}
          </span>
          <button onClick={logout} className="rounded-full bg-white/10 px-3 py-1 text-xs">Logout</button>
        </span>
      </nav>
      <main>
        <ErrorBoundary>{renderView()}</ErrorBoundary>
      </main>
    </div>
  );
}

function navCls(active) {
  return `rounded-full px-3 py-1 text-sm ${active ? "bg-brand-violet text-white" : "text-ink-muted hover:text-white"}`;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-ink-muted">Loading…</div>;
  if (!user) return <AuthPage />;
  return <Shell />;
}

export { AuthProvider };
