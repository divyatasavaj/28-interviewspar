import { Link } from 'react-router-dom';
import Brand from './Brand';
import UiIcon from './UiIcon';

/** Shared responsive authentication frame; forms keep their existing API contracts. */
export default function AuthLayout({ children }) {
  return <main className="auth-page">
    <section className="auth-story">
      <Brand/>
      <div className="auth-story-copy">
        <span className="section-kicker">A little practice. A clearer answer.</span>
        <h2>Your experience.<br/>Your words.<br/><span>Your next chapter.</span></h2>
        <p>A place to think through questions, find your examples, and get a little more prepared.</p>
        <div className="auth-note"><UiIcon name="chat"/><span>You don’t need the perfect answer.<br/><strong>Just a place to start.</strong></span></div>
      </div>
      <p className="text-xs text-slate-600 relative z-10">Practice at your pace. Make it your own.</p>
      <div className="auth-sun" aria-hidden="true"/>
    </section>
    <section className="auth-form-area">
      <div className="auth-form-wrap">
        <div className="flex items-center justify-between gap-4 mb-10"><span className="md:hidden"><Brand/></span><Link className="text-sm text-slate-600 hover:text-primary md:ml-auto" to="/">← Back to home</Link></div>
        {children}
      </div>
    </section>
  </main>;
}
