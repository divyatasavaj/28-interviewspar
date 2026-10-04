import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { getMe, clearToken, listSessions, getInterviewFeedback, getLatestResume } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [feedbacks, setFeedbacks] = useState({})
  const [resumeData, setResumeData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    if (!user) return

    Promise.allSettled([
      listSessions().then(async (data) => {
        setSessions(data || [])
        const completed = (data || []).filter((s) => s.status === "completed").slice(0, 5)
        const fbEntries = await Promise.allSettled(
          completed.map((s) => getInterviewFeedback(s.id).then((fb) => ({ id: s.id, fb })))
        )
        const map = {}
        for (const r of fbEntries) {
          if (r.status === "fulfilled") map[r.value.id] = r.value.fb
        }
        setFeedbacks(map)
      }),
      getLatestResume().then((r) => setResumeData(r.parsed_data)).catch(() => setResumeData(null)),
    ]).finally(() => setLoading(false))
  }, [user])

  if (!user) return null

  const completedSessions = sessions.filter((s) => s.status === "completed")
  const scores = Object.values(feedbacks)
    .map((f) => f?.overall_score)
    .filter((s) => typeof s === "number")
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  function formatDate(iso) {
    if (!iso) return "Recent"
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="min-h-screen font-sans bg-[#fbfaff]">
      <div
        className="fixed top-0 right-0 w-[400px] md:w-[700px] h-[400px] md:h-[700px] pointer-events-none"
        style={{
          background: "radial-gradient(circle at top right, rgba(109,40,217,0.06) 0%, transparent 70%)",
        }}
      />
      <DashboardNavbar name={user.name} />

      <main className="pt-28 pb-20 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Top Welcome Banner */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-sm mb-8 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-3.5 py-1 text-xs font-semibold text-primary mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>AI Interview Spar Ready</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Welcome back, {user.name} 👋
              </h1>
              <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed">
                Target Role: <strong className="text-gray-800">{user.target_role || "Software Engineer"}</strong>.
                {resumeData
                  ? " Your resume is analyzed and questions are dynamically personalized to your background."
                  : " Upload your resume to unlock hyper-personalized behavioral and technical questions."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/interview-type"
                className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2"
              >
                <span>Start New Mock</span>
                <span>🚀</span>
              </Link>
              <Link
                to="/account?tab=resume"
                className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold text-sm px-5 py-3 rounded-full transition-all hover:bg-gray-50 flex items-center gap-2"
              >
                <span>{resumeData ? "📄 View Resume" : "⬆️ Upload Resume"}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400">Total Interviews</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{completedSessions.length}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ Active Candidate</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400">Avg Performance Score</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {averageScore !== null ? `${averageScore}%` : "—"}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{averageScore ? "Across all completed" : "Complete 1st session"}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400">Resume Status</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-2 truncate">
              {resumeData ? "Parsed & Active" : "No Resume"}
            </p>
            <Link to="/account?tab=resume" className="text-[11px] text-primary font-semibold hover:underline block mt-1">
              {resumeData ? "Update skills →" : "Upload now →"}
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400">Voice Persona</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-2">Natural Neural</p>
            <Link to="/account?tab=preferences" className="text-[11px] text-primary font-semibold hover:underline block mt-1">
              Configure voice →
            </Link>
          </div>
        </section>

        {/* Practice Modes */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Choose Practice Track</h2>
            <Link to="/interview-type" className="text-xs font-semibold text-primary hover:underline">
              View All Tracks →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-3xl p-7 relative overflow-hidden shadow-md flex flex-col justify-between">
              <div className="relative z-10">
                <span className="bg-white/10 text-purple-200 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  Behavioral & Leadership
                </span>
                <h3 className="text-2xl font-bold text-white mt-3">HR & Culture Fit</h3>
                <p className="text-purple-200/80 text-sm mt-2 leading-relaxed">
                  Master standard HR inquiries, the STAR method, conflict resolution, and career trajectory discussions with real-time feedback.
                </p>
              </div>
              <div className="relative z-10 mt-6 flex items-center justify-between">
                <span className="text-xs text-purple-300">6 Core Questions • ~10 mins</span>
                <Link
                  to="/interview?type=hr"
                  className="bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs px-5 py-2.5 rounded-full transition-all shadow-md"
                >
                  Start HR Spar →
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-slate-950 text-white rounded-3xl p-7 relative overflow-hidden shadow-md flex flex-col justify-between">
              <div className="relative z-10">
                <span className="bg-white/10 text-blue-200 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  System Design & Engineering
                </span>
                <h3 className="text-2xl font-bold text-white mt-3">Technical Interview</h3>
                <p className="text-blue-200/80 text-sm mt-2 leading-relaxed">
                  Deep-dive into architecture, caching, concurrency, databases, trade-offs, and complex system troubleshooting.
                </p>
              </div>
              <div className="relative z-10 mt-6 flex items-center justify-between">
                <span className="text-xs text-blue-300">Adaptive Engine • ~15 mins</span>
                <Link
                  to="/interview?type=technical"
                  className="bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs px-5 py-2.5 rounded-full transition-all shadow-md"
                >
                  Start Tech Spar →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Interviews / Reports Section */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent Interview Reports</h2>
              <p className="text-xs text-gray-400 mt-0.5">Track your scorecard history and actionable AI feedback</p>
            </div>
            <Link to="/account?tab=reports" className="text-xs font-semibold text-primary hover:underline">
              All Reports ({sessions.length}) →
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <div className="inline-block animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mb-2" />
              <p>Loading your past mock sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
              <span className="text-3xl mb-2 block">🎙️</span>
              <p className="text-sm font-semibold text-gray-800">No mock interviews completed yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Take your first interview to generate an instant AI performance scorecard with strength and weakness analysis.
              </p>
              <Link
                to="/interview-type"
                className="mt-4 inline-block bg-primary text-white text-xs font-semibold px-6 py-2.5 rounded-full shadow-md hover:bg-[#5b22e0] transition-all"
              >
                Launch First Session
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.slice(0, 5).map((s) => {
                const fb = feedbacks[s.id]
                return (
                  <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          s.interview_type === "hr"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {s.interview_type === "hr" ? "HR" : "DEV"}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {s.interview_type === "hr" ? "HR Behavioral Interview" : "Technical Interview"}
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {fb && typeof fb.overall_score === "number" && (
                        <div className="text-right">
                          <span
                            className={`text-base font-extrabold ${
                              fb.overall_score >= 80
                                ? "text-emerald-600"
                                : fb.overall_score >= 60
                                ? "text-amber-500"
                                : "text-rose-500"
                            }`}
                          >
                            {fb.overall_score}%
                          </span>
                          <span className="text-[10px] text-gray-400 block">Score</span>
                        </div>
                      )}

                      <span
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                          s.status === "completed"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {s.status === "completed" ? "COMPLETED" : "IN PROGRESS"}
                      </span>

                      <button
                        onClick={() => navigate(`/interview-complete?session_id=${s.id}`)}
                        className="text-xs font-semibold text-primary hover:text-[#5b22e0] bg-purple-50 hover:bg-purple-100 px-3.5 py-1.5 rounded-full transition-all"
                      >
                        View Scorecard →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
