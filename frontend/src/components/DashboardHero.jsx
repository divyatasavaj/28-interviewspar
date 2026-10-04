import { Link } from "react-router-dom"

export default function DashboardHero({ name }) {
  return (
    <section className="pt-36 pb-20 md:pt-44 md:pb-28 px-6 min-h-[650px] flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Live Mock Sessions Available Now
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight text-gray-900">
          Welcome back, {name} 👋
          <br />
          <span className="text-primary">Ready for your next interview?</span>
        </h1>

        <p className="mt-6 text-base text-gray-500 leading-relaxed max-w-[520px]">
          Your trajectory toward Google is looking strong. You've consistently improved
          your system design scores. Take a quick drill or schedule a live session.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/interview-type"
            className="inline-flex items-center gap-2 bg-primary hover:bg-[#5b22e0] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            Start New Interview 🚀
          </Link>
          <Link
            to="#"
            className="inline-flex items-center gap-2 text-primary font-semibold px-7 py-3.5 rounded-full border-2 border-primary hover:bg-purple-50 transition-all"
          >
            View Study Plan
          </Link>
        </div>
      </div>
    </section>
  )
}
