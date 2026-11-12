import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { getMe, listSessions, getLatestResumeAnalysis, getLatestMatch } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"
import UiIcon from "../components/UiIcon"

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

const practiceOptions = [
  { title: "Practice coding", detail: "Solve two or three exercises with test cases.", icon: "code", to: "/interview/start?track=coding" },
  { title: "Technical practice", detail: "Explain your approach or add a coding round.", icon: "mic", to: "/interview/start" },
  { title: "HR practice", detail: "Rehearse behavioral interview questions.", icon: "chat", to: "/interview/start?persona=hr" },
]

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
    <div className="min-h-screen">
      <DashboardNavbar name={user.name} />
      <main className="workspace-page dashboard-page page-enter">
        <header className="dashboard-heading">
          <h1>Welcome, {user.name.split(" ")[0]}</h1>
        </header>

        <div className="dashboard-overview">
          <section id="practice" className="dashboard-welcome" aria-labelledby="next-practice-title">
            <span className="tile-icon"><UiIcon name={active ? "mic" : "arrow"} /></span>
            <h2 id="next-practice-title">{active ? "Pick up where you left off" : "Start a practice round"}</h2>
            <p>{active ? `${interviewName(active)} · Question ${active.progress.current} of ${active.progress.total}`
              : "Choose a track and set up your next interview."}</p>
            <div className="dashboard-hero-actions">
              <Link className="spar-button" to={active ? `/interview/${active.id}` : "/interview/start"}>
                {active ? "Resume interview" : "Start practice"} <UiIcon name="arrow" />
              </Link>
              {latestReport && <Link className="text-action" to={`/interview/${latestReport.id}/report`}>View latest report</Link>}
            </div>
          </section>

          <section id="resume-tools" className="dashboard-resume-tools" aria-labelledby="dashboard-resume-title">
            <span className="tile-icon"><UiIcon name="file" /></span>
            <h2 id="dashboard-resume-title">Resume Intelligence</h2>
            {resumeError && <p className="text-red-700" role="alert">{resumeError}</p>}
            <p>{hasResume ? "Compare your skills and projects with a role or job description."
              : "Upload a PDF or DOCX to review your skills and projects."}</p>
            {hasResume && match && <p className="dashboard-match">
              {coverage ? `Latest job description coverage · ${match.score}%`
                : match.target_role_title ? `Latest role review · ${match.target_role_title}`
                  : "Latest job description review available"}
            </p>}
            <div className="dashboard-resume-actions">
              <Link className="text-action" to={hasResume ? "/resume-intelligence" : "/account?tab=resume"}>
                {hasResume ? "Open Resume Intelligence" : "Upload resume"} <UiIcon name="arrow" />
              </Link>
              {hasResume && <Link className="text-action" to="/account?tab=resume">Manage resume</Link>}
            </div>
          </section>
        </div>

        <section id="practice-options" className="dashboard-tracks" aria-labelledby="practice-options-title">
          <h2 id="practice-options-title">Practice tracks</h2>
          <div className="practice-options">
            {practiceOptions.map(option => (
              <Link to={option.to} key={option.to}>
                <span className="tile-icon"><UiIcon name={option.icon} /></span>
                <div><strong>{option.title}</strong><p>{option.detail}</p></div>
                <UiIcon name="arrow" className="track-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section id="recent-interviews" className="dashboard-history" aria-labelledby="recent-interviews-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="recent-interviews-title">Recent interviews</h2>
            <Link className="text-action" to="/account?tab=reports">All interviews <UiIcon name="arrow" /></Link>
          </div>
          {historyError && <p className="mt-4 text-sm text-red-700" role="alert">{historyError}</p>}
          {loading && !historyError && <p className="mt-4 text-sm text-gray-600" role="status">Loading interviews…</p>}
          {!loading && !historyError && sessions.length === 0 && <p className="history-empty"><UiIcon name="chart" /> Your interviews and reports will appear here.</p>}
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

      </main>
    </div>
  )
}
