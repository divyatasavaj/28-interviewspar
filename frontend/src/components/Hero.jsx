import { Link } from "react-router-dom"

export default function Hero() {
  return (
    <section className="pt-36 pb-20 md:pt-44 md:pb-28 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight text-gray-900">
            Practice Interviews
            <br />
            <span className="text-primary">with AI.</span>
            <br />
            Master Every
            <br />
            Opportunity.
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg">
            Our elite AI simulates high-stakes technical and behavioral interviews,
            providing real-time evaluation of your resume and responses. Experience
            precision prep tailored to your career trajectory.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-primary hover:bg-[#5b22e0] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              Start a Test 🚀
            </Link>
            <button className="inline-flex items-center gap-3 text-gray-600 font-semibold px-7 py-3.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all hover:-translate-y-0.5">
              <span className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center">
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-left leading-tight">
                Watch
                <br />
                Demo
              </span>
            </button>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-3">
              {["bg-purple-400", "bg-blue-400", "bg-emerald-400", "bg-amber-400"].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-full border-2 border-white ${color} shadow-sm`}
                  />
                )
              )}
            </div>
            <p className="text-sm text-gray-400">
              +12,000 Professionals Practicing Today
            </p>
          </div>
        </div>

        <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-purple-400/20 rounded-full blur-3xl" />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 sm:w-64 md:w-72 h-56 sm:h-64 md:h-72 rounded-full bg-white border-[3px] border-primary/20 shadow-[0_0_80px_rgba(109,40,217,0.1)]" />

          <div className="absolute top-4 sm:top-6 left-2 sm:left-4 md:left-8 w-56 sm:w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-gray-800">Live Analysis</span>
            </div>
            <div className="space-y-3 sm:space-y-3.5">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Technical Score</span>
                  <span>85%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "85%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Communication</span>
                  <span>72%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 sm:bottom-12 right-1 sm:right-2 md:right-6 w-44 sm:w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-5">
            <div className="text-xs text-gray-400 mb-0.5">Resume Match</div>
            <div className="text-2xl font-extrabold text-primary">94%</div>
            <div className="mt-3 flex items-end gap-1.5">
              {[40, 65, 50, 80, 55, 70, 94].map((h, i) => (
                <div
                  key={i}
                  className="w-2 sm:w-3 bg-primary rounded-t-sm"
                  style={{ height: `${h * 0.35}px` }}
                />
              ))}
            </div>
          </div>

          <div className="absolute top-16 sm:top-20 right-12 sm:right-16 w-3 h-3 rounded-full bg-primary/30" />
          <div className="absolute bottom-24 sm:bottom-32 left-8 sm:left-12 w-2 h-2 rounded-full bg-accent/40" />
        </div>
      </div>
    </section>
  )
}
