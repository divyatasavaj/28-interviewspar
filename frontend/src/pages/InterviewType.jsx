import { useNavigate, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { getMe, clearToken, getLatestResume } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

const types = [
  {
    id: "hr",
    title: "HR / Behavioral",
    subtitle: "Behavioral & Culture Fit",
    description:
      "Practice standard HR inquiries, leadership scenarios, and situational responses. Master the 'Tell me about yourself' opener and the STAR framework.",
    features: ["STAR method coaching", "Conflict & team dynamics", "Situational problem-solving", "Culture fit evaluation"],
    gradient: "from-purple-600 to-indigo-700",
    badge: "Recommended for all roles",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "technical",
    title: "Technical",
    subtitle: "Engineering & Architecture",
    description:
      "Tackle system architecture, concurrency, database indexing, caching strategies, and technical trade-offs tailored to your domain and target role.",
    features: ["System design trade-offs", "API & data modeling", "Debugging & bottlenecks", "Adaptive follow-up probes"],
    gradient: "from-blue-600 to-cyan-700",
    badge: "Coding & System Design",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
]

export default function InterviewType() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [hasResume, setHasResume] = useState(false)

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        return getLatestResume()
          .then(() => setHasResume(true))
          .catch(() => setHasResume(false))
      })
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  if (!user) return null

  return (
    <div className="min-h-screen font-sans bg-[#fbfaff]">
      <div
        className="fixed top-0 right-0 w-[400px] md:w-[700px] h-[400px] md:h-[700px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at top right, rgba(109,40,217,0.06) 0%, transparent 70%)",
        }}
      />
      <DashboardNavbar name={user.name} />

      <main className="pt-32 pb-24 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Select Interview Track</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            What kind of interview <span className="text-primary">are you preparing for?</span>
          </h1>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
            Select a specialized simulation track. The AI interviewer adapts dynamically to your answers in real time.
          </p>
        </div>

        {/* Resume status notification */}
        <div className={`mb-10 p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          hasResume
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-purple-50/80 border-purple-200 text-purple-950"
        }`}>
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              hasResume ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
            }`}>
              {hasResume ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-bold">
                {hasResume
                  ? "Resume Profile Active"
                  : "Standard Placement Baseline Mode (No Resume Attached)"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {hasResume
                  ? "Questions will cross-examine your actual academic projects, git repos, and technical stack."
                  : "You can start immediately with campus calibration drills, or upload a resume for targeted project questioning."}
              </p>
            </div>
          </div>
          <Link
            to="/account?tab=resume"
            className="text-xs font-bold text-primary bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-full text-center transition-all shadow-sm hover:shadow"
          >
            {hasResume ? "Update Resume" : "Upload Resume First"}
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {types.map((type) => (
            <div
              key={type.id}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col justify-between hover:shadow-xl hover:border-purple-200 hover:-translate-y-1.5 transition-all duration-300 group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-105`}>
                    {type.icon}
                  </div>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-gray-100 text-gray-700 px-3 py-1 rounded-full group-hover:bg-purple-50 group-hover:text-primary transition-colors">
                    {type.badge}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">{type.title}</h2>
                <p className="text-xs text-primary font-semibold mb-3">{type.subtitle}</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">{type.description}</p>

                <div className="space-y-2.5 mb-8 bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Curriculum & Competencies</p>
                  {type.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate(`/interview?type=${type.id}`)}
                className="w-full bg-primary hover:bg-[#5b22e0] text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Launch {type.title} Track</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
