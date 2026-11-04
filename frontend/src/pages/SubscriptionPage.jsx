import {Link} from 'react-router-dom';
import Navbar from '../components/Navbar';
export default function SubscriptionPage(){
  return <div className="min-h-screen bg-[#f8f5ef] text-gray-900"><Navbar/>
    <main className="public-page mx-auto max-w-5xl px-6 pb-20 pt-32">
      <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">Practice access</p>
      <h1 className="mt-4 text-4xl font-bold">Build confidence, one interview at a time.</h1>
      <p className="mt-5 max-w-2xl text-gray-600">The current application is free to use. Paid subscriptions and university billing are not available, and no payment is collected.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-sky-200 bg-white p-8 shadow-sm"><span className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700">Available now</span><h2 className="mt-5 text-2xl font-bold">Individual practice</h2><p className="mt-2 text-3xl font-bold">Free</p>
          <ul className="my-6 space-y-3 text-sm text-gray-600">{['HR, technical, and behavioral rounds','Resume extraction and evidence-based matching','Saved interview history and printable reports','Optional AI assessment with your consent','Code submission with isolated evaluation when configured'].map(item=><li key={item}>✓ {item}</li>)}</ul>
          <Link to="/dashboard" className="inline-block rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white">Start practicing</Link>
        </section>
        <section className="rounded-3xl border border-gray-200 bg-gray-50 p-8"><span className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-600">Planned</span><h2 className="mt-5 text-2xl font-bold">Teams and universities</h2><p className="mt-4 text-sm leading-relaxed text-gray-600">Cohort management, human-interviewer scheduling, payments, and institution reporting are future capabilities. There is no active checkout or placement guarantee.</p><Link to="/student-guide" className="mt-6 inline-block text-sky-700 underline">Explore the student guide</Link></section>
      </div>
    </main>
  </div>;
}
