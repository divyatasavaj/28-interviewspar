import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  getMe,
  clearToken,
  listSessions,
  getInterviewFeedback,
  getLatestResume,
  createRoleMatch,
  createJobDescriptionMatch,
  getLatestMatch,
} from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

const CANONICAL_ROLES = [
  { id: "software-engineer-sde", label: "Software Engineer (SDE)" },
  { id: "frontend-developer", label: "Frontend Developer" },
  { id: "backend-developer", label: "Backend Developer" },
  { id: "data-analyst", label: "Data Analyst" },
  { id: "machine-learning-engineer", label: "Machine Learning Engineer" },
]

function mapTargetRoleToId(targetRole) {
  if (!targetRole) return "software-engineer-sde"
  const lowered = targetRole.toLowerCase()
  if (lowered.includes("frontend")) return "frontend-developer"
  if (lowered.includes("backend")) return "backend-developer"
  if (lowered.includes("data") || lowered.includes("analyst")) return "data-analyst"
  if (lowered.includes("machine") || lowered.includes("ml") || lowered.includes("ai"))
    return "machine-learning-engineer"
  return "software-engineer-sde"
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [feedbacks, setFeedbacks] = useState({})
  const [resumeData, setResumeData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Assessment & Resume Intelligence state
  const [assessment, setAssessment] = useState(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentTab, setAssessmentTab] = useState("role") // "role" | "jd"
  const [selectedRoleId, setSelectedRoleId] = useState("software-engineer-sde")
  const [jdInput, setJdInput] = useState("")
  const [jdError, setJdError] = useState("")

  useEffect(() => {
    getMe()
      .then((userData) => {
        setUser(userData)
        const initialRoleId = mapTargetRoleToId(userData.target_role)
        setSelectedRoleId(initialRoleId)
      })
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
      getLatestResume()
        .then((r) => {
          setResumeData(r.parsed_data || r.analysis || null)
        })
        .catch(() => setResumeData(null)),
      getLatestMatch()
        .then((m) => {
          if (m) setAssessment(m)
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [user])

  async function handleRunRoleMatch(roleId = selectedRoleId) {
    if (!resumeData) return
    setAssessmentLoading(true)
    try {
      const res = await createRoleMatch(roleId)
      setAssessment(res)
    } catch (err) {
      console.error("Role match failed:", err)
    } finally {
      setAssessmentLoading(false)
    }
  }

  async function handleRunJdMatch(e) {
    e.preventDefault()
    if (!jdInput.trim() || !resumeData) return
    setAssessmentLoading(true)
    setJdError("")
    try {
      const res = await createJobDescriptionMatch(jdInput)
      setAssessment(res)
    } catch (err) {
      setJdError(err.message || "Failed to analyze job description")
    } finally {
      setAssessmentLoading(false)
    }
  }

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
              <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100/70 rounded-full px-3.5 py-1 text-xs font-semibold text-primary mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Placement Simulation & AI Readiness Platform</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Welcome back, {user.name}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
                Target Role:{" "}
                <strong className="text-gray-900 font-semibold">{user.target_role || "Software Engineer"}</strong>.
                {resumeData
                  ? " Your resume intelligence and project evidence are indexed for skill matching and targeted AI sparring."
                  : " Upload your resume to unlock deterministic role match scoring and tailored project questions."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/interview-type"
                className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2 hover:-translate-y-0.5"
              >
                <span>Start Mock Session</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/account?tab=resume"
                className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold text-sm px-5 py-3 rounded-full transition-all hover:bg-gray-50 flex items-center gap-2 hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{resumeData ? "Manage Resume" : "Upload Resume"}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400">Total Interviews</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{completedSessions.length}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Active Candidate</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400">Avg Performance Score</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {averageScore !== null ? `${averageScore}%` : "—"}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {averageScore ? "Across completed sessions" : "Complete first session"}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400">Resume Status</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-2 truncate">
              {resumeData ? "Parsed & Indexed" : "No Resume"}
            </p>
            <Link to="/account?tab=resume" className="text-[11px] text-primary font-semibold hover:underline block mt-1">
              {resumeData ? "View parsed sections →" : "Upload document →"}
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-gray-400">Readiness Mode</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-2">
              {assessment?.assessment_mode === "job_description"
                ? "Job Specific"
                : "Role Benchmark"}
            </p>
            <span className="text-[11px] text-gray-400 mt-1 block">
              {assessment?.assessment_status === "heuristic"
                ? `Coverage: ${assessment.score}%`
                : "Taxonomy Benchmark"}
            </span>
          </div>
        </section>

        {/* Phase 4: Resume Intelligence & Skill Gap Alignment Section */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                <span>AI Career Intelligence</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">Resume Match & Skill Gap Radar</span>
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Placement Skill Readiness
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Deterministic matching against canonical industry rubrics and target job descriptions.
              </p>
            </div>

            {/* Assessment Tabs Switcher */}
            <div className="flex items-center bg-gray-100 p-1 rounded-2xl self-start md:self-auto">
              <button
                type="button"
                onClick={() => setAssessmentTab("role")}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                  assessmentTab === "role"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Target Role Rubric
              </button>
              <button
                type="button"
                onClick={() => setAssessmentTab("jd")}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                  assessmentTab === "jd"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Specific Job Description
              </button>
            </div>
          </div>

          {!resumeData ? (
            <div className="py-12 px-6 text-center bg-purple-50/40 rounded-2xl border border-dashed border-purple-200/60 mt-6">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100 text-primary flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Upload your resume to activate Skill Intelligence</h3>
              <p className="text-xs text-gray-600 max-w-md mx-auto mt-1 leading-relaxed">
                InterviewSpar extracts your verified skills and practical evidence from PDF or DOCX to run gap analysis against target engineering roles.
              </p>
              <Link
                to="/account?tab=resume"
                className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-[#5b22e0] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <span>Upload Resume</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              {assessmentTab === "role" ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/80 p-4 rounded-2xl border border-gray-100 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label htmlFor="role-select" className="text-xs font-bold text-gray-700 whitespace-nowrap">
                        Select Benchmark Role:
                      </label>
                      <select
                        id="role-select"
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {CANONICAL_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRunRoleMatch(selectedRoleId)}
                      disabled={assessmentLoading}
                      className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {assessmentLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <span>Run Role Fit Evaluation</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Role Assessment Overview */}
                  {assessment && assessment.assessment_mode === "role" && (
                    <div className="space-y-6">
                      {/* Notice Banner */}
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
                        <span className="text-amber-600 text-base leading-none mt-0.5">ⓘ</span>
                        <div className="text-xs text-amber-800 leading-relaxed">
                          <strong className="font-semibold">Provisional Taxonomy Benchmark:</strong>{" "}
                          Seed rubrics for {assessment.target_role_title} are based on curated occupational standards (ESCO/O*NET).
                          Numerical scores remain withheld until validated empirical Indian hiring weights are reviewed; skill findings and gap analysis below are live and grounded in your resume evidence.
                        </div>
                      </div>

                      {/* Split Grid: Verified Skills vs Gaps */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Verified & Demonstrated Skills */}
                        <div className="bg-[#fcfcff] border border-gray-100 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span>Evidenced in Resume ({assessment.matched_requirements.length})</span>
                            </h3>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Demonstrated
                            </span>
                          </div>

                          {assessment.matched_requirements.length === 0 ? (
                            <p className="text-xs text-gray-400 py-4">No direct matching skills evidenced yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assessment.matched_requirements.map((req) => (
                                <div
                                  key={req.requirement_id}
                                  className="inline-flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                  title={req.explanation}
                                >
                                  <span>{req.display_name}</span>
                                  {req.evidence && (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-normal">
                                      {req.evidence.classification.replace("_", " ")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Skill Gaps & Areas to Evidence */}
                        <div className="bg-[#fcfcff] border border-gray-100 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                              <span>Identified Skill Gaps ({assessment.skill_gaps.length})</span>
                            </h3>
                            <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              Not Evidenced / Weak
                            </span>
                          </div>

                          {assessment.skill_gaps.length === 0 ? (
                            <p className="text-xs text-gray-400 py-4">All core requirements are evidenced in this resume!</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assessment.skill_gaps.map((gap) => (
                                <div
                                  key={gap.requirement_id}
                                  className="inline-flex items-center gap-1.5 bg-rose-50/70 border border-rose-200/80 text-rose-900 px-3 py-1.5 rounded-xl text-xs font-semibold"
                                  title={gap.explanation}
                                >
                                  <span>{gap.display_name}</span>
                                  <span className="text-[10px] text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded font-normal">
                                    {gap.requirement_type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actionable Recommendations */}
                      {assessment.recommendations.length > 0 && (
                        <div className="pt-2">
                          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <span>Targeted Preparation Roadmap</span>
                            <span className="text-xs text-gray-400 font-normal">
                              (Prioritized based on {assessment.target_role_title} requirements)
                            </span>
                          </h3>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assessment.recommendations.slice(0, 3).map((rec) => (
                              <div
                                key={rec.recommendation_id}
                                className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                        rec.priority_band === "high"
                                          ? "bg-rose-100 text-rose-700"
                                          : rec.priority_band === "medium"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-blue-100 text-blue-700"
                                      }`}
                                    >
                                      {rec.priority_band} Priority
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-medium capitalize">
                                      {rec.group.replace("_", " ")}
                                    </span>
                                  </div>

                                  <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{rec.title}</h4>
                                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{rec.action}</p>
                                </div>

                                <p className="text-[10px] text-gray-400 italic mt-3 pt-2 border-t border-gray-200/60">
                                  {rec.safety_note}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Specific Job Description Matching Form */
                <div>
                  <form onSubmit={handleRunJdMatch} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="jd-textarea" className="text-xs font-bold text-gray-700">
                          Paste Target Job Description:
                        </label>
                        <span className="text-[11px] text-gray-400">
                          {jdInput.length} / 20,000 characters
                        </span>
                      </div>
                      <textarea
                        id="jd-textarea"
                        rows={5}
                        value={jdInput}
                        onChange={(e) => setJdInput(e.target.value)}
                        placeholder="Paste the job requirements, responsibilities, and qualifications here (e.g., 'Required skills: Python, SQL. Preferred: Docker, AWS.')..."
                        className="w-full bg-gray-50/60 border border-gray-200 text-gray-900 text-xs rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                      />
                    </div>

                    {jdError && (
                      <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-3 rounded-xl border border-rose-100">
                        {jdError}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-400">
                        Untrusted text is sanitized; prompt injections are disregarded. Content is indexed via SHA-256 hash.
                      </p>
                      <button
                        type="submit"
                        disabled={assessmentLoading || !jdInput.trim()}
                        className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50"
                      >
                        {assessmentLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Analyzing JD...</span>
                          </>
                        ) : (
                          <>
                            <span>Analyze Match Coverage</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* JD Assessment Results */}
                  {assessment && assessment.assessment_mode === "job_description" && (
                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-purple-50/60 p-5 rounded-2xl border border-purple-100/80">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            Job Description Alignment
                          </span>
                          <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">
                            Textual Coverage Score: {assessment.score !== null ? `${assessment.score}%` : "Unavailable"}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {assessment.score_explanation}
                          </p>
                        </div>

                        {assessment.score !== null && (
                          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-purple-100 flex flex-col items-center justify-center">
                            <span className="text-lg font-extrabold text-primary">{Math.round(assessment.score)}%</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">Match</span>
                          </div>
                        )}
                      </div>

                      {/* Matched vs Gaps for JD */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                          <h4 className="text-xs font-bold text-gray-900 mb-2">
                            Matching Requirements ({assessment.matched_requirements.length})
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {assessment.matched_requirements.map((m) => (
                              <span
                                key={m.requirement_id}
                                className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg"
                              >
                                {m.display_name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                          <h4 className="text-xs font-bold text-gray-900 mb-2">
                            Missing from Resume ({assessment.skill_gaps.length})
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {assessment.skill_gaps.map((g) => (
                              <span
                                key={g.requirement_id}
                                className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200/80 rounded-lg"
                              >
                                {g.display_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Unknown requirements (if any) */}
                      {assessment.unknown_requirements.length > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <strong className="text-gray-700">Terms queued for taxonomy review:</strong>{" "}
                          {assessment.unknown_requirements.map((u) => u.source_term).join(", ")}.
                          These terms were detected in the description but are not catalog skills; they are excluded from the score rather than penalized as missing.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Practice Modes */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Choose Practice Track</h2>
              <p className="text-xs text-gray-400 mt-0.5">Simulate actual company hiring loops with adaptive difficulty</p>
            </div>
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
            <div className="py-12 px-4 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100/60 text-primary flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">No mock interviews completed yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Take your first interview to generate an instant AI performance scorecard with strength and weakness analysis.
              </p>
              <Link
                to="/interview-type"
                className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-[#5b22e0] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <span>Launch First Session</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
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
