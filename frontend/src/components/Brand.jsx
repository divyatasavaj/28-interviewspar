import { Link } from 'react-router-dom';

/** Shared wordmark for public pages, accounts and the interview room. */
export default function Brand({ to = '/', className = '' }) {
  return <Link to={to} className={`spar-brand ${className}`} aria-label="InterviewSpar home">
    <span className="spar-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3 4 14h7v7l9-11h-7V3Z"/></svg></span>
    <span>Interview<span className="font-medium">Spar</span><span className="brand-dot" aria-hidden="true">.</span></span>
  </Link>;
}
