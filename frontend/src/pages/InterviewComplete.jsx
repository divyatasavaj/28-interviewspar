import { useEffect, useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { getMe, clearToken, getInterviewFeedback } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

function scoreColor(score) {
  if (score >= 80) return "text-green-500"
  if (score >= 60) return "text-yellow-500"
  return "text-red-500"
}

function scoreRingColor(score) {
  if (score >= 80) return "stroke-green-500"
  if (score >= 60) return "stroke-yellow-500"
  return "stroke-red-500"
}

export default function InterviewComplete() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    if (!sessionId) return
    getInterviewFeedback(sessionId)
      .then(setFeedback)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (!user) return null

  return (
    <div className="min-h-screen font-sans" style={{ background: "#faf8ff" }}>
      <div
        className="fixed top-0 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(109,40,217,0.08) 0%, transparent 70%)",
        }}
      />
      <DashboardNavbar name={user.name} />

      <section className="pt-28 pb-16 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-4">
              Session Complete
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
              Interview <span className="text-primary">Feedback Report</span>
            </h1>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Generating your feedback report...</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-sm text-red-600 text-center max-w-lg mx-auto">
              <p>{error}</p>
              <button
                onClick={() => {
                  setError("")
                  setLoading(true)
                  getInterviewFeedback(sessionId)
                    .then(setFeedback)
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false))
                }}
                className="mt-3 text-xs font-semibold bg-primary text-white px-4 py-2 rounded-full hover:bg-[#5b22e0] transition-all"
              >
                Retry Generating Report
              </button>
            </div>
          )}

          {feedback && (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="relative w-40 h-40 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      className={scoreRingColor(feedback.overall_score)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(feedback.overall_score / 100) * 339.292} 339.292`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-4xl font-extrabold ${scoreColor(feedback.overall_score)}`}>
                      {feedback.overall_score}
                    </span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Overall Performance</h2>
                  <p className="text-gray-500 leading-relaxed">
                    {feedback.overall_score >= 80
                      ? "Excellent performance! You demonstrated strong interview skills and well-structured answers."
                      : feedback.overall_score >= 60
                      ? "Good effort! There are clear areas to build on to make your answers more compelling."
                      : "This is a starting point. Focus on structuring your answers and backing up claims with specifics."}
                  </p>
                  {feedback.rambling_detected && (
                    <div className="inline-flex items-center gap-2 mt-4 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-semibold text-amber-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Rambling detected in some answers
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Strengths</h2>
                  </div>
                  <ul className="space-y-3">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Weaknesses</h2>
                  </div>
                  <ul className="space-y-3">
                    {feedback.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-300 mt-1.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {feedback.qa_pairs && feedback.qa_pairs.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Question Analysis</h2>
                  </div>
                  <div className="space-y-5">
                    {feedback.qa_pairs.map((pair, i) => (
                      <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="bg-purple-50/50 px-5 py-3 flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            Q{i + 1}
                          </span>
                          <p className="text-sm text-gray-800 font-medium leading-relaxed">{pair.question}</p>
                        </div>
                        {pair.answer && (
                          <div className="px-5 py-3 flex items-start gap-3 bg-white">
                            <span className="w-6 h-6 rounded-full bg-green-50 text-green-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              A
                            </span>
                            <p className="text-sm text-gray-600 leading-relaxed">{pair.answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feedback.weak_claims && feedback.weak_claims.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Weak Claims</h2>
                  </div>
                  <div className="space-y-4">
                    {feedback.weak_claims.map((c, i) => (
                      <div key={i} className="bg-gray-50 rounded-2xl p-5">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          <span className="text-amber-600">Claim:</span> {c.claim}
                        </p>
                        <p className="text-sm text-gray-500">
                          <span className="text-gray-400 font-medium">Why it's weak:</span> {c.why_weak}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl shadow-sm border border-l-4 border-l-primary p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Suggested Improvements</h2>
                </div>
                <ul className="space-y-3">
                  {feedback.suggested_improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0">
                        {i + 1}
                      </span>
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-6 py-3.5 rounded-full transition-all flex items-center gap-2 shadow-sm hover:shadow"
                >
                  <span>🖨️ Print / Save PDF</span>
                </button>
                <Link
                  to="/interview-type"
                  className="bg-primary hover:bg-[#5b22e0] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-primary/25 transition-all"
                >
                  Start Another Interview
                </Link>
                <Link
                  to="/dashboard"
                  className="text-primary font-semibold px-7 py-3.5 rounded-full border-2 border-primary hover:bg-purple-50 transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
