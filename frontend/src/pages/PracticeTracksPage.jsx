import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Navbar from "../components/Navbar"
import { getToken } from "../api/auth"

const tracks = [
  {
    id: "hr",
    title: "Campus HR & Culture Assessment",
    badge: "Universal Round 1",
    accent: "border-purple-200 bg-purple-50/30",
    gradient: "from-purple-600 to-indigo-600",
    duration: "10-15 Mins",
    questionsCount: "6 Core Inquiries",
    difficulty: "Foundational",
    description:
      "Essential for every college placement drive. Evaluates communication clarity, conflict resolution, behavioral ethics, and the classic 'Tell me about yourself' opener.",
    curriculum: [
      "STAR framework structuring (Situation, Task, Action, Result)",
      "Leadership in college societies & hackathon team conflicts",
      "Handling unexpected failures, deadlines & scope creep",
      "Career vision, company values alignment & ethics",
    ],
    sampleQuestions: [
      "Walk me through a challenging technical roadblock during a college project and how you resolved it.",
      "Describe a situation where a team member wasn't delivering their part before a demo. What did you do?",
      "Why are you interested in our engineering culture, and where do you envision your technical growth in 2 years?",
    ],
  },
  {
    id: "technical",
    title: "Software Engineering & Architecture",
    badge: "Core Technical Round",
    accent: "border-blue-200 bg-blue-50/30",
    gradient: "from-blue-600 to-cyan-600",
    duration: "15-20 Mins",
    questionsCount: "Adaptive Follow-ups",
    difficulty: "Intermediate to Rigorous",
    description:
      "Deep technical interrogation covering data structures, concurrency, database indexing, caching strategies, and system design trade-offs.",
    curriculum: [
      "Time & space complexity analysis (Big-O)",
      "Database schema design: Normalization vs NoSQL key-value stores",
      "REST APIs vs WebSockets and event-driven architecture",
      "Distributed cache eviction strategies (LRU, LFU, TTL)",
    ],
    sampleQuestions: [
      "How would you design a real-time leaderboard for a campus coding contest with 50,000 concurrent participants?",
      "Explain the trade-offs between optimistic locking and pessimistic locking in a high-traffic ticket booking service.",
      "What happens under the hood when a browser requests an endpoint: from DNS lookup to TCP handshake and TLS negotiation?",
    ],
  },
  {
    id: "resume-project",
    targetType: "technical",
    title: "Project & Resume Cross-Examination",
    badge: "Final Placement Round",
    accent: "border-emerald-200 bg-emerald-50/30",
    gradient: "from-emerald-600 to-teal-600",
    duration: "15 Mins",
    questionsCount: "Contextual to Resume",
    difficulty: "Tailored to Your Stack",
    description:
      "Recreates the intense scrutiny of senior campus tech leads interrogating your academic capstone projects, internships, and GitHub repositories.",
    curriculum: [
      "Defense of architectural and technology stack choices",
      "Scale limitations of college-built prototypes",
      "Authentication, authorization & security flaws (JWT, CSRF, SQLi)",
      "Live refactoring discussion of your personal contributions",
    ],
    sampleQuestions: [
      "I see you used MongoDB in your capstone project. Why MongoDB instead of PostgreSQL given your relational data?",
      "If 100,000 users hit your authentication service simultaneously, what would fail first and how would you fix it?",
      "Which specific component of this project did you personally author, and what would you re-architect from scratch today?",
    ],
  },
]

export default function PracticeTracksPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("all")

  function handleStartTrack(track) {
    const isAuth = Boolean(getToken())
    const targetType = track.targetType || track.id
    if (isAuth) {
      navigate(`/interview?type=${targetType}`)
    } else {
      navigate("/login")
    }
  }

  const displayedTracks =
    activeTab === "all" ? tracks : tracks.filter((t) => t.id === activeTab)

  return (
    <div className="min-h-screen bg-[#fbfaff] font-sans">
      <Navbar />

      <main className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-primary uppercase bg-purple-50 border border-purple-100/70 px-3.5 py-1.5 rounded-full mb-4">
            Curriculum & Tracks
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            Practice Tracks Built For <span className="text-primary">Campus Placements</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
            From preliminary HR screening rounds to rigorous technical design and capstone defense, practice with adaptive questions tailored to student recruitments.
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {[
              { id: "all", label: "All Placement Tracks" },
              { id: "hr", label: "HR & Culture" },
              { id: "technical", label: "Core Technical & DSA" },
              { id: "resume-project", label: "Project & Stack Defense" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tracks List */}
        <div className="space-y-10 mb-20">
          {displayedTracks.map((track) => (
            <div
              key={track.id}
              className={`bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 ${
                activeTab === track.id ? "ring-2 ring-primary/20" : ""
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-purple-50 border border-purple-100 px-3 py-1 rounded-full">
                      {track.badge}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {track.duration} • {track.questionsCount}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {track.difficulty}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {track.title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
                    {track.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() => handleStartTrack(track)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary hover:bg-[#5b22e0] text-white font-bold text-sm px-7 py-3.5 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span>Launch This Simulation</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid md:grid-cols-2 gap-8 pt-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Evaluation Matrix & Focus Areas
                  </h4>
                  <ul className="space-y-2.5">
                    {track.curriculum.map((c, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700">
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-50/80 rounded-2xl p-5 border border-gray-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center justify-between">
                    <span>Sample Live Questions</span>
                    <span className="text-[10px] text-primary lowercase font-medium">adaptive difficulty</span>
                  </h4>
                  <div className="space-y-2.5">
                    {track.sampleQuestions.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-white p-3 rounded-xl border border-gray-100/70 shadow-xs">
                        <span className="font-bold text-primary flex-shrink-0">Q{i + 1}.</span>
                        <p className="leading-relaxed">{q}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Student Placement Tip */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900">Unsure which track to begin with?</h3>
            <p className="text-sm text-gray-600 mt-1">
              We recommend starting with the <strong>Campus HR & Culture Assessment</strong> to calibrate your speaking pace and confidence before diving into technical rounds.
            </p>
          </div>
          <Link
            to="/student-guide"
            className="text-xs font-bold text-primary bg-purple-50 hover:bg-purple-100 border border-purple-200 px-5 py-3 rounded-full transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Read Student Guide</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>
      </main>
    </div>
  )
}
