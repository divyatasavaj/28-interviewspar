import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { clearToken, uploadResume, getLatestResume, listSessions, getInterviewFeedback, getMe } from "../api/auth"

const menuItems = [
  { label: "Personal Info", icon: "user", view: "profile" },
  { label: "Resume", icon: "file", view: "resume" },
  { label: "Interview Reports", icon: "report", view: "reports" },
  { label: "Preferences", icon: "settings", view: "preferences" },
]

function Icon({ name, className = "w-5 h-5" }) {
  const paths = {
    user: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
    file: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    report: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    settings: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    ),
    shield: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
    logout: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    ),
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths[name] || <path />}
    </svg>
  )
}

function ProfileView({ user, completedCount }) {
  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="lg:w-[70%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Profile Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input defaultValue={user.name} className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input defaultValue={user.email} className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Role</label>
              <input defaultValue="Senior Product Engineer" className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Experience Level</label>
              <div className="relative">
                <select defaultValue="senior" className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="intern">Intern (0–1 years)</option>
                  <option value="junior">Junior (1–3 years)</option>
                  <option value="mid">Mid (3–5 years)</option>
                  <option value="senior">Senior (5–10 years)</option>
                  <option value="lead">Lead (10+ years)</option>
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-4 mt-8">
            <button className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors px-4 py-2">Discard</button>
            <button className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-md shadow-primary/20 transition-all">Save Changes</button>
          </div>
        </div>
        <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-bold text-gray-900 mb-6">Interview Stats</h2>
          <div className="space-y-6">
            <div>
              <p className="text-3xl font-extrabold text-primary">{completedCount}</p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 mt-1">MOCK SESSIONS</p>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div>
              <p className="text-3xl font-extrabold text-green-500">0</p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 mt-1">OFFERS RECEIVED</p>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div>
              <p className="text-3xl font-extrabold text-gray-900">0h</p>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 mt-1">TOTAL PREP TIME</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="lg:w-[70%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Security</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-primary"><Icon name="shield" /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Password</p>
                  <p className="text-xs text-gray-400">Last updated 3 months ago</p>
                </div>
              </div>
              <button className="text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Update</button>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Icon name="shield" /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Two-Factor Authentication</p>
                  <p className="text-xs text-green-600 font-medium">Enabled via Authenticator App</p>
                </div>
              </div>
              <button className="text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Manage</button>
            </div>
          </div>
        </div>
        <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-l-4 border-l-primary p-8 flex flex-col justify-center">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Elite Tip</h2>
          <p className="text-sm text-gray-500 leading-relaxed italic">"Candidates who review their AI-generated feedback reports for at least 15 minutes post-session increase their confidence scores by 22%."</p>
        </div>
      </div>
    </>
  )
}

function ResumeView() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [parsed, setParsed] = useState(null)
  const [existing, setExisting] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getLatestResume()
      .then((data) => setExisting(data.parsed_data))
      .catch(() => {})
  }, [])

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError("")
    try {
      const data = await uploadResume(file)
      setParsed(data.parsed_data)
      setExisting(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const data = parsed || existing

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="lg:w-[70%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Resume Upload</h2>

        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-500 mb-4">Upload your resume (PDF or DOCX)</p>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-[#5b22e0] file:cursor-pointer cursor-pointer"
          />
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-6 bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm px-8 py-3 rounded-full shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              {uploading ? "Parsing..." : "Upload & Parse"}
            </button>
          )}
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>

        {data && (
          <div className="mt-8 space-y-8">
            {data.skills && data.skills.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {data.skills.map((s, i) => (
                    <span key={i} className="bg-purple-50 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {data.work_experience && data.work_experience.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Work Experience</h3>
                <div className="space-y-4">
                  {data.work_experience.map((w, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-900">{w.role} <span className="text-gray-400 font-normal">at {w.company}</span></p>
                      {w.duration && <p className="text-xs text-gray-400 mt-0.5">{w.duration}</p>}
                      {w.description && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{w.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.projects && data.projects.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Projects</h3>
                <div className="space-y-4">
                  {data.projects.map((p, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.description}</p>}
                      {p.technologies && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(Array.isArray(p.technologies) ? p.technologies : []).map((t, j) => (
                            <span key={j} className="bg-gray-200 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.education && data.education.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Education</h3>
                <div className="space-y-4">
                  {data.education.map((e, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-900">{e.degree} <span className="text-gray-400 font-normal">at {e.institution}</span></p>
                      {e.year && <p className="text-xs text-gray-400 mt-0.5">{e.year}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-l-4 border-l-primary p-8 flex flex-col justify-center">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Resume Tip</h2>
        <p className="text-sm text-gray-500 leading-relaxed italic">"Tailor your resume to highlight achievements with measurable impact. AI-powered parsing helps identify keyword gaps against job descriptions."</p>
      </div>
    </div>
  )
}

function ReportsView() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [feedbacks, setFeedbacks] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSessions()
      .then((data) => {
        setSessions(data)
        const completed = data.filter((s) => s.status === "completed")
        Promise.allSettled(
          completed.map((s) =>
            getInterviewFeedback(s.id).then((f) => ({ id: s.id, feedback: f }))
          )
        ).then((results) => {
          const map = {}
          for (const r of results) {
            if (r.status === "fulfilled") map[r.value.id] = r.value.feedback
          }
          setFeedbacks(map)
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading reports...</span>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No interviews yet</h3>
        <p className="text-sm text-gray-500 mb-6">Complete your first mock interview to see reports here.</p>
        <Link to="/interview-type" className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-md shadow-primary/20 transition-all inline-block">
          Start an Interview
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const fb = feedbacks[s.id]
        return (
          <div
            key={s.id}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              s.interview_type === "hr" ? "bg-purple-50 text-primary" : "bg-blue-50 text-blue-600"
            }`}>
              {s.interview_type === "hr" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {s.interview_type === "hr" ? "HR / Behavioral Interview" : "Technical Interview"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.created_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              {s.status === "completed" ? (
                <>
                  {fb && (
                    <span className={`text-lg font-extrabold ${
                      fb.overall_score >= 80 ? "text-green-500" : fb.overall_score >= 60 ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {fb.overall_score}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold tracking-wider text-green-600 bg-green-50 rounded-full px-3 py-1">COMPLETED</span>
                  <button
                    onClick={() => navigate(`/interview-complete?session_id=${s.id}`)}
                    className="text-sm font-medium text-primary hover:text-[#5b22e0] transition-colors"
                  >
                    View Report →
                  </button>
                </>
              ) : (
                <span className="text-[10px] font-semibold tracking-wider text-amber-600 bg-amber-50 rounded-full px-3 py-1">IN PROGRESS</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AccountManagement() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view, setView] = useState("profile")
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    listSessions()
      .then((sessions) => setCompletedCount(sessions.filter((s) => s.status === "completed").length))
      .catch(() => {})
  }, [])

  if (!user) return null

  function handleLogout() {
    clearToken()
    navigate("/login")
  }

  return (
    <div className="min-h-screen font-sans flex" style={{ background: "#faf8ff" }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-gray-100">
          <Link to="/dashboard" className="text-xl font-extrabold tracking-tight">
            <span className="text-gray-800">Interview</span>
            <span className="text-primary">Spar</span>
          </Link>
        </div>

        <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent border-4 border-white shadow-xl flex items-center justify-center text-white text-2xl font-bold">{user ? user.name.charAt(0).toUpperCase() : "?"}</div>
          <h2 className="mt-4 text-xl font-extrabold text-gray-900">{user?.name || "Mastery Profile"}</h2>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-gray-400 mt-1">{user?.email || "ELITE PERFORMANCE"}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { setView(item.view); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                view === item.view ? "bg-primary text-white" : "text-gray-500 hover:bg-purple-50 hover:text-gray-800"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-400 mb-1">Success Rate</p>
            <p className="text-2xl font-extrabold text-gray-900">88%</p>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full w-[88%] bg-primary rounded-full" />
            </div>
          </div>
          <button className="w-full bg-primary hover:bg-[#5b22e0] text-white font-semibold text-sm py-3 rounded-full shadow-md shadow-primary/20 transition-all">New Mock Interview</button>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center gap-3 text-sm font-medium text-red-500 hover:text-red-600 transition-colors px-4 py-2">
            <Icon name="logout" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <div className="lg:hidden flex items-center justify-between px-6 h-[72px] bg-white border-b border-gray-100">
          <Link to="/dashboard" className="text-xl font-extrabold tracking-tight">
            <span className="text-gray-800">Interview</span>
            <span className="text-primary">Spar</span>
          </Link>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600" aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="p-6 lg:p-12 max-w-[1440px]">
          <div className="mb-10">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-[#5b22e0] transition-colors mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900">
              {view === "profile" ? (
                <>Account <span className="text-primary">Management</span></>
              ) : view === "resume" ? (
                <>Resume <span className="text-primary">Parser</span></>
              ) : view === "reports" ? (
                <>Interview <span className="text-primary">Reports</span></>
              ) : (
                <>{view.charAt(0).toUpperCase() + view.slice(1)}</>
              )}
            </h1>
            <p className="mt-3 text-gray-500 text-lg">
              {view === "profile" && "Optimize your profile for peak interview readiness and review performance metrics."}
              {view === "resume" && "Upload your resume and let AI extract your skills, experience, projects, and education."}
              {view === "reports" && "Review your past interview sessions, scores, and AI-generated feedback."}
            </p>
          </div>

          {view === "profile" && <ProfileView user={user} completedCount={completedCount} />}
          {view === "resume" && <ResumeView />}
          {view === "reports" && <ReportsView />}
        </div>
      </div>
    </div>
  )
}
