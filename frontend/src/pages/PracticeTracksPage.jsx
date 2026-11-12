import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Navbar from "../components/Navbar"
import { getToken } from "../api/auth"

const tracks = [
  {
    "id": "hr",
    "title": "HR & Behavioral Practice",
    "badge": "HR Track",
    "duration": "Self-paced",
    "questionsCount": "9 questions",
    "difficulty": "Communication practice",
    "description": "Practice screening, HR calibration, project ownership, team situations, and reflection. Feedback highlights text structure cues; external AI feedback is optional.",
    "curriculum": [
      "Explain your role and practice goals",
      "Describe your own project contribution",
      "Discuss team conflict and learning from mistakes",
      "Reflect on what to improve next"
    ],
    "sampleQuestions": [
      "Tell me about yourself and your background.",
      "Describe a challenge you faced and how you handled it.",
      "Describe a disagreement within a team. Explain the situation, your actions, and the result."
    ]
  },
  {
    "id": "technical",
    "title": "Technical & Behavioral Practice",
    "badge": "Technical Track",
    "duration": "Self-paced",
    "questionsCount": "Up to 13 questions",
    "difficulty": "Domain selection at start",
    "description": "Choose a domain for curated technical questions alongside HR and behavioral rounds. Eligible domains include a Two Sum coding question; execution requires a configured isolated provider.",
    "curriculum": [
      "Domain-specific calibration and technical questions",
      "Explain trade-offs when prompted",
      "Coding explanation and optional isolated tests",
      "Review communication and correctness separately"
    ],
    "sampleQuestions": [
      "Explain the difference between a process and a thread, with a short example.",
      "What is the time complexity of binary search, and when can you use it?",
      "Describe how you would debug a service that suddenly returns 500 errors in production."
    ]
  },
  {
    "id": "resume-project",
    "targetType": "technical",
    "title": "Add Resume Context to Practice",
    "badge": "Optional preparation",
    "duration": "Upload before practice",
    "questionsCount": "One resume-context question",
    "difficulty": "Uses a listed project or skill",
    "description": "Upload a resume to add context to the standard interview. This is not a separate project audit: source repositories and factual claims are not independently verified.",
    "curriculum": [
      "Upload a text PDF or DOCX with storage consent",
      "Review extracted skills and projects",
      "Start an HR or technical interview",
      "Delete your saved resume and interviews when needed"
    ],
    "sampleQuestions": [
      "For a project listed in your resume: explain one decision you made and the evidence for its outcome.",
      "For a listed skill when no project is found: describe where you used it and what you learned."
    ]
  }
]


export default function PracticeTracksPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("all")

  function handleStartTrack(track) {
    const isAuth = Boolean(getToken())
    const targetType = track.targetType || track.id
    if (isAuth) {
      navigate(track.id === "resume-project" ? "/account?tab=resume" : `/interview/start?persona=${targetType}`)
    } else {
      navigate("/login")
    }
  }

  const displayedTracks =
    activeTab === "all" ? tracks : tracks.filter((t) => t.id === activeTab)

  return (
    <div className="min-h-screen font-sans">
      <Navbar />

      <main className="public-page pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-primary uppercase bg-[var(--wash)] border border-[var(--line)] px-3.5 py-1.5 rounded-full mb-4">
            Curriculum & Tracks
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            Choose what you want to <span className="text-primary">practice.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
            Choose HR or technical practice, with optional resume context. Review your answers and the limits of automated feedback.
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-[var(--wash)] border border-[var(--line)] px-3 py-1 rounded-full">
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary hover:bg-[var(--action-hover)] text-white font-bold text-sm px-7 py-3.5 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span>{track.id === "resume-project" ? "Upload Resume" : "Choose Interview Settings"}</span>
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
                    Practice Focus Areas
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
                    <span>Example Practice Prompts</span>
                    <span className="text-[10px] text-primary lowercase font-medium">curated examples</span>
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
              We recommend starting with the <strong>HR & Behavioral Practice</strong> to work on explaining your experience before diving into technical rounds.
            </p>
          </div>
          <Link
            to="/student-guide"
            className="text-xs font-bold text-primary bg-[var(--wash)] hover:bg-[var(--wash)] border border-[var(--line)] px-5 py-3 rounded-full transition-all flex items-center gap-1.5 flex-shrink-0"
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
