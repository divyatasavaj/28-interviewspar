import { useNavigate, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { getMe, clearToken, getLatestResume } from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"
import UiIcon from "../components/UiIcon"

const tracks = [
  {
    title: "Technical", icon: "mic", to: "/interview/start",
    description: "Explain design decisions, debug a problem out loud, or include coding exercises in the same interview.",
  },
  {
    title: "Coding", icon: "code", to: "/interview/start?track=coding",
    description: "Solve two or three exercises in the editor and run sample tests before submitting.",
  },
  {
    title: "HR and behavioral", icon: "chat", to: "/interview/start?persona=hr",
    description: "Rehearse questions about teamwork, past projects, and how you respond to change.",
  },
]

export default function InterviewType() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [hasResume, setHasResume] = useState(false)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    getMe()
      .then(account => {
        setUser(account)
        return getLatestResume()
          .then(() => setHasResume(true))
          .catch(error => {
            if (error.status !== 404) setLoadError(error.message)
          })
      })
      .catch(error => {
        if (error.status === 401) {
          clearToken()
          navigate("/login")
        } else setLoadError(error.message)
      })
  }, [navigate])

  if (!user) return <main className="workspace-page">
    <p role={loadError ? "alert" : "status"}>{loadError || "Loading account…"}</p>
    {loadError && <Link className="text-action" to="/login">Sign in</Link>}
  </main>

  return (
    <div className="min-h-screen">
      <DashboardNavbar name={user.name} />
      <main className="workspace-page page-enter">
        <header className="page-heading">
          <div>
            <h1>Choose a practice track</h1>
            <p>Set up the type of interview you want to rehearse.</p>
          </div>
        </header>

        {loadError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{loadError}</p>}
        <div className="feature-grid">
          {tracks.map(track => (
            <Link className="feature-tile" to={track.to} key={track.to}>
              <span className="tile-icon"><UiIcon name={track.icon} /></span>
              <h2>{track.title}</h2>
              <p>{track.description}</p>
              <span className="text-action">Set up interview <UiIcon name="arrow" /></span>
            </Link>
          ))}
        </div>

        <section className="dashboard-history" aria-labelledby="track-resume-heading">
          <h2 id="track-resume-heading">{hasResume ? "Your resume is ready to use" : "Add your resume anytime"}</h2>
          <p className="mt-2 mb-3 text-sm text-gray-600">{hasResume
            ? "Spoken questions can reference the skills or projects listed in your resume."
            : "A resume can help tailor spoken questions to your skills and projects. You can also practice without one."}</p>
          <Link className="text-action" to="/account?tab=resume">
            {hasResume ? "Manage resume" : "Upload resume"} <UiIcon name="arrow" />
          </Link>
        </section>
      </main>
    </div>
  )
}
