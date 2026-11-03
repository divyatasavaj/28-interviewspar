import { Link } from "react-router-dom"
import { useState } from "react"

export default function Hero() {
  const [activeTab, setActiveTab] = useState("technical")

  return (
    <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Background Decorative Aura */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-purple-200/30 via-indigo-200/20 to-pink-200/30 blur-3xl -z-10 pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Left Column: Mission & CTAs */}
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-purple-200/80 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Built For University Students & New Grads</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight text-gray-950">
            Ace your next tech interview{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              without the anxiety.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
            Practice HR and technical questions with saved answers and feedback. Review text structure cues, and enable optional AI assessment with your consent. Technical correctness is shown only when evaluated.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/interview/start"
              className="inline-flex items-center gap-2.5 bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm sm:text-base px-7 py-3.5 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Start Free Practice</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              to="/practice-tracks"
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-950 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-white transition-all hover:-translate-y-0.5 shadow-sm"
            >
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Explore Practice Tracks</span>
            </Link>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-200/70">
            <p className="text-xs text-gray-500">
              Designed for <strong className="text-gray-800 font-semibold">engineering students</strong> preparing for top tech roles
            </p>
          </div>
        </div>

        {/* Right Column: Live Mock Simulation Mockup */}
        <div className="lg:col-span-5 relative">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 relative z-10 card-hover">
            {/* Simulation Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-xs font-semibold text-gray-700 ml-2">Example interview question</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                Preview
              </span>
            </div>

            {/* Interactive Track Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl my-4">
              <button
                type="button"
                onClick={() => setActiveTab("technical")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "technical"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Technical Architecture
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("behavioral")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "behavioral"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                HR & STAR Method
              </button>
            </div>

            {/* Mock Question Preview */}
            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Question preview</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed">
                {activeTab === "technical"
                  ? '"When designing an API endpoint that experiences bursty traffic spikes, what strategies would you use for rate limiting and database protection?"'
                  : '"Can you walk me through a challenging project where requirements changed midway through? How did you adapt your timeline and communication?"'}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">Practice suggestion</p>
              <p className="mt-2">Explain your approach, why you chose it, and an example or observed result. This preview is illustrative; it does not evaluate an answer.</p>
            </div>
          </div>

          {/* Floating Feature Tag */}
          <div className="absolute -bottom-4 -left-4 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl p-3 shadow-lg flex items-center gap-3 animate-float-slow z-20 hidden sm:flex">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Saved practice report</p>
              <p className="text-[10px] text-gray-400">Print or save as PDF</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
