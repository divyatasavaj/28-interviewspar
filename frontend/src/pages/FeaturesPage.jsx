import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"

const pillars = [
  {
    category: "Speech & Audio Engine",
    title: "Conversational Neural Voice",
    description:
      "Read interview questions aloud through the speech service, with browser speech as a fallback. Voice availability depends on the configured service and your browser.",
    highlights: [
      "Read questions aloud on demand",
      "Browser speech fallback",
      "Ava, Andrew, Emma & Brian vocal personas",
      "Voice and speed preferences",
    ],
    icon: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
  },
  {
    category: "Campus Behavioral Assessment",
    title: "Answer Structure Practice",
    description:
      "Highlights keyword and length cues that may help you review an answer. These indicators do not verify a complete STAR story, factual accuracy, or spoken fluency.",
    highlights: [
      "Outcome-related text cues",
      "Experimental coaching and filler-word signals",
      "Examples, reasoning, and outcome signals",
      "Structured constructive feedback rubrics",
    ],
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    category: "Resume Intelligence",
    title: "Questions from Resume Context",
    description:
      "The local parser extracts documented projects and skills. The interview can ask about a listed project or skill alongside curated questions.",
    highlights: [
      "Automatic parsing of skills, tools & project stacks",
      "Asks about a project decision and its outcome",
      "Fallback baseline calibration when no resume is uploaded",
      "Separates missing evidence from documented skills",
    ],
    icon: (
      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    category: "Technical & Systems Rigor",
    title: "Adaptive Question Complexity",
    description:
      "Technical prompts can ask for more detail after evaluated answers. Without technical evaluation, their difficulty stays at the default level.",
    highlights: [
      "Curated domain questions",
      "Systems trade-offs: Caching, CAP theorem, indexing",
      "Coding practice for eligible domains",
      "Difficulty prompts informed by previous answers",
    ],
    icon: (
      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    category: "Integrity & Fluency Analytics",
    title: "Consent and privacy controls",
    description:
      "Choose whether to enable external AI assessment. Resume parsing stays local, camera frames are not uploaded, and saved resumes and interviews can be deleted.",
    highlights: [
      "Local resume parsing",
      "Explicit consent for AI assessment",
      "Typed answers or optional browser dictation",
      "Delete saved interviews and resumes",
    ],
    icon: (
      <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 17h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    category: "Practice Reports",
    title: "Printable practice reports",
    description:
      "Generate comprehensive evaluation cards detailing recorded answers, communication evidence, improvement steps, and print-ready PDF exports.",
    highlights: [
      "Separate structure and evaluated correctness indicators",
      "Recorded answers and evaluation sources",
      "Recorded feedback to guide further practice",
      "Printable PDF format for college placement cells",
    ],
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#fbfaff] font-sans">
      <Navbar />

      <main className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-primary uppercase bg-purple-50 border border-purple-100/70 px-3.5 py-1.5 rounded-full mb-4">
            Platform Capabilities
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            Architected To Turn Students Into <span className="text-primary">Top Candidates</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
            Every feature is calibrated around campus recruitments and new-grad software engineering benchmarks.
            Eliminate guesswork and practice with high fidelity.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-20">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="group bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  {pillar.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-purple-50 px-2.5 py-0.5 rounded-full">
                  {pillar.category}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-3 mb-2 group-hover:text-primary transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-6">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-50 space-y-2">
                {pillar.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Call to Action */}
        <section className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-8 md:p-14 text-center relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="text-[11px] font-bold tracking-widest uppercase text-purple-300 bg-white/10 px-3 py-1 rounded-full">
              Zero Commitment Practice
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-4 mb-4 tracking-tight">
              Test Your Placement Readiness Today
            </h2>
            <p className="text-purple-200/80 text-sm sm:text-base leading-relaxed mb-8">
              Choose a domain, optionally upload a resume for a project question, and review your saved answers after practice.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/interview-type"
                className="bg-primary hover:bg-[#5b22e0] text-white font-bold text-sm px-8 py-4 rounded-full shadow-lg shadow-primary/30 transition-all hover:scale-105"
              >
                Launch Mock Session Now
              </Link>
              <Link
                to="/practice-tracks"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-7 py-4 rounded-full border border-white/20 transition-all"
              >
                Explore Practice Tracks
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
