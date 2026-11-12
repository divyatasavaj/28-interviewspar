import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { getMe, listSessions, getLatestResumeAnalysis, getLatestMatch } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

function interviewName(session) {
  if (session.coding_only) return `${session.domain} coding practice`
  return session.interview_type === "hr" ? "HR + behavioral" : session.domain
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [resume, setResume] = useState(null)
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accountError, setAccountError] = useState("")
  const [historyError, setHistoryError] = useState("")
  const [resumeError, setResumeError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    getMe().then(async account => {
      if (controller.signal.aborted) return
      setUser(account)
      await Promise.allSettled([
        listSessions().then(data => {
          if (!controller.signal.aborted) setSessions(data)
        }).catch(error => {
          if (!controller.signal.aborted) setHistoryError(error.message)
        }),
        getLatestResumeAnalysis().then(data => {
          if (!controller.signal.aborted) setResume(data)
        }).catch(error => {
          if (!controller.signal.aborted && error.status !== 404) setResumeError(error.message)
        }),
        getLatestMatch().then(data => {
          if (!controller.signal.aborted) setMatch(data)
        }).catch(error => {
          if (!controller.signal.aborted) setResumeError(error.message)
        }),
      ])
      if (!controller.signal.aborted) setLoading(false)
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error.status === 401) navigate("/login", { replace: true })
      else setAccountError(error.message)
    })
    return () => controller.abort()
  }, [navigate])

  if (!user) return <main className="workspace-page">
    <p role={accountError ? "alert" : "status"}>{accountError || "Loading account…"}</p>
  </main>

  const active = sessions.find(session => session.status === "active")
  const completed = sessions.filter(session => session.status === "completed")
  const latestReport = completed[0]
  const hasResume = Boolean(resume || user.resume_status === "present")
  const coverage = match?.assessment_mode === "job_description" && Number.isFinite(match.score)

  return (
    <div className="min-h-screen bg-[#f8f5ef]">
      <DashboardNavbar name={user.name} />
      <main className="workspace-page dashboard-page page-enter">
        <section id="practice" className="dashboard-welcome">
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-gray-600">Practice an interview and review your feedback.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {active ? <Link className="spar-button" to={`/interview/${active.id}`}>Resume interview</Link>
              : <Link className="spar-button" to="/interview/start">Start practice</Link>}
            {latestReport && <Link className="self-center text-sm font-semibold text-primary underline" to={`/interview/${latestReport.id}/report`}>View latest report</Link>}
          </div>
          {active && <p className="mt-3 text-sm text-gray-600">
            {interviewName(active)} · Question {active.progress.current} of {active.progress.total}
          </p>}
          <div id="practice-options" className="practice-options mt-5" aria-label="Practice options">
            <Link to="/interview/start?track=coding"><strong>Practice coding</strong><span>Two or three exercises</span></Link>
            <Link to="/interview/start"><strong>Technical practice</strong><span>Spoken questions or a combined interview</span></Link>
            <Link to="/interview/start?persona=hr"><strong>HR practice</strong><span>Behavioral interview questions</span></Link>
          </div>
        </section>

        <section id="recent-interviews" className="dashboard-history rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Recent interviews</h2>
            <Link className="text-sm font-semibold text-primary underline" to="/account?tab=reports">All interviews</Link>
          </div>
          {historyError && <p className="mt-4 text-sm text-red-700" role="alert">{historyError}</p>}
          {loading && !historyError && <p className="mt-4 text-sm text-gray-600" role="status">Loading interviews…</p>}
          {!loading && !historyError && sessions.length === 0 && <p className="mt-4 text-sm text-gray-600">Your interviews and reports will appear here.</p>}
          <ul className="mt-2 divide-y divide-gray-100">
            {sessions.slice(0, 5).map(session => {
              const inProgress = session.status === "active"
              const date = new Date(session.created_at)
              return <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <h3 className="text-sm font-semibold">{interviewName(session)}</h3>
                  <p className="mt-1 text-xs text-gray-600">
                    {Number.isFinite(date.getTime()) && `${dateFormat.format(date)} · `}
                    {inProgress ? `Question ${session.progress.current} of ${session.progress.total}` : "Completed"}
                    {!inProgress && Number.isFinite(session.overall_score) && ` · Text structure ${session.overall_score}/100`}
                  </p>
                </div>
                <Link className="spar-button secondary" to={`/interview/${session.id}${inProgress ? "" : "/report"}`}>
                  {inProgress ? "Resume interview" : "View report"}
                </Link>
              </li>
            })}
          </ul>
        </section>

        <section id="resume-tools" className="dashboard-resume-tools p-5 sm:p-7" aria-labelledby="dashboard-resume-title">
          <h2 id="dashboard-resume-title" className="text-xl font-bold">Resume Intelligence</h2>
          {resumeError && <p className="mt-3 text-sm text-red-700" role="alert">{resumeError}</p>}
          <p className="mt-2 text-sm text-gray-600">
            {hasResume ? "Review your resume evidence and compare it with a role or job description."
              : "Upload a PDF or DOCX to review your skills and project evidence."}
          </p>
          {hasResume && match && <p className="mt-3 text-sm font-medium">
            {coverage ? `Latest job description coverage · ${match.score}%`
              : match.target_role_title ? `Latest role review · ${match.target_role_title}`
                : "Latest job description review available"}
          </p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="spar-button secondary" to={hasResume ? "/resume-intelligence" : "/account?tab=resume"}>
              {hasResume ? "Open Resume Intelligence" : "Upload resume"}
            </Link>
            {hasResume && <Link className="spar-button secondary" to="/account?tab=resume">Manage resume</Link>}
          </div>
        </section>
      </main>
    </div>
  )
}
