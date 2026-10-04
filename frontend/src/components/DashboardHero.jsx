import { Link } from "react-router-dom"

export default function DashboardHero({ name }) {
  return (
    <section className="pt-36 pb-20 md:pt-44 md:pb-28 px-6 min-h-[650px] flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interactive Campus Placement Suite</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight text-gray-900">
          Welcome back, {name}
          <br />
          <span className="text-primary">Ready for your next mock interview?</span>
        </h1>

        <p className="mt-5 text-base md:text-lg text-gray-600 leading-relaxed max-w-[560px]">
          Strengthen your fundamentals across algorithms, architecture, and behavioral STAR rounds.
          Get honest AI-driven feedback before facing real campus recruiters.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            to="/interview-type"
            className="inline-flex items-center gap-2.5 bg-primary hover:bg-[#5b22e0] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <span>Start Practice Round</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            to="/account?tab=reports"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-primary font-semibold px-6 py-3.5 rounded-full border border-gray-200 hover:border-primary/40 bg-white hover:bg-purple-50/50 transition-all"
          >
            <span>Review Past Feedback</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
