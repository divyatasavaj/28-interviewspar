import { useState, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  clearToken,
  uploadResume,
  getLatestResume,
  listSessions,
  getInterviewFeedback,
  getMe,
  updateUserProfile,
  changeUserPassword,
} from "../api/auth"
import { fetchTtsVoices } from "../api/tts"
import { playHumanSpeech, stopAnySpeech } from "../utils/naturalSpeech"

const menuItems = [
  { label: "Personal Info", icon: "user", view: "profile" },
  { label: "Resume", icon: "file", view: "resume" },
  { label: "Interview Reports", icon: "report", view: "reports" },
  { label: "Voice & Preferences", icon: "settings", view: "preferences" },
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

function ProfileView({ user, onUserUpdate, completedCount }) {
  const [name, setName] = useState(user.name || "")
  const [targetRole, setTargetRole] = useState(user.target_role || "Software Engineer")
  const [experienceLevel, setExperienceLevel] = useState(user.experience_level || "mid")
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState("")
  const [pwdSuccess, setPwdSuccess] = useState("")

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg("")
    setErrorMsg("")
    try {
      const updated = await updateUserProfile({
        name,
        target_role: targetRole,
        experience_level: experienceLevel,
      })
      onUserUpdate(updated)
      setSuccessMsg("Profile details saved successfully!")
      setTimeout(() => setSuccessMsg(""), 4000)
    } catch (err) {
      setErrorMsg(err.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwdLoading(true)
    setPwdError("")
    setPwdSuccess("")
    try {
      await changeUserPassword(oldPassword, newPassword)
      setPwdSuccess("Password changed successfully!")
      setOldPassword("")
      setNewPassword("")
      setTimeout(() => {
        setShowPasswordModal(false)
        setPwdSuccess("")
      }, 1800)
    } catch (err) {
      setPwdError(err.message || "Failed to change password")
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <form onSubmit={handleSaveProfile} className="lg:w-[70%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Profile Details</h2>
            {successMsg && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full animate-fade-in">
                ✓ {successMsg}
              </span>
            )}
            {errorMsg && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                {errorMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-xl bg-gray-100 border border-gray-200 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Target Job Role</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
              >
                <option value="intern">Intern / New Grad (0–1 years)</option>
                <option value="junior">Junior Developer (1–3 years)</option>
                <option value="mid">Mid-Level Engineer (3–5 years)</option>
                <option value="senior">Senior Engineer (5–8 years)</option>
                <option value="lead">Staff / Lead (8+ years)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>

        <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-6">Candidate Metrics</h2>
          <div className="space-y-6 w-full">
            <div>
              <p className="text-3xl font-extrabold text-primary">{completedCount}</p>
              <p className="text-[10px] font-bold tracking-[0.12em] text-gray-400 mt-1 uppercase">MOCK SESSIONS COMPLETED</p>
            </div>
            <div className="w-full h-px bg-gray-100" />
            <div>
              <p className="text-3xl font-extrabold text-emerald-600">
                {user.resume_status === "present" ? "Active" : "None"}
              </p>
              <p className="text-[10px] font-bold tracking-[0.12em] text-gray-400 mt-1 uppercase">RESUME PROFILE STATUS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="lg:w-[70%] bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Security & Authentication</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-primary">
                  <Icon name="shield" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Account Password</p>
                  <p className="text-xs text-gray-400">Regularly updated for interview privacy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-l-4 border-l-primary p-8 flex flex-col justify-center">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Practice Advice</h2>
          <p className="text-xs text-gray-500 leading-relaxed italic">
            "Reviewing each AI scorecard for 10 minutes following an interview session boosts answer structure and STAR fluency by over 25%."
          </p>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Update Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            {pwdError && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg mb-3">{pwdError}</p>}
            {pwdSuccess && <p className="text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-lg mb-3">✓ {pwdSuccess}</p>}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-5 py-2 rounded-xl transition-all disabled:opacity-50"
                >
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function ResumeView() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [parsed, setParsed] = useState(null)
  const [existing, setExisting] = useState(null)

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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Resume Upload & Parser</h2>
        <p className="text-xs text-gray-500 mb-6">
          Upload your resume in PDF or DOCX format. The AI extracts your key skills, projects, and achievements to personalize interview questions.
        </p>

        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50">
          <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-semibold text-gray-700 mb-1">Select your resume file</p>
          <p className="text-xs text-gray-400 mb-4">Supported formats: PDF, DOCX (Up to 10MB)</p>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full max-w-sm mx-auto text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-[#5b22e0] file:cursor-pointer cursor-pointer"
          />
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-5 bg-primary hover:bg-[#5b22e0] text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              {uploading ? "Analyzing Resume..." : `Parse ${file.name}`}
            </button>
          )}
          {error && <p className="mt-4 text-xs font-semibold text-red-500">{error}</p>}
        </div>

        {data && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Extracted Background Profile</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Active for Interviews
              </span>
            </div>

            {data.skills && data.skills.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.skills.map((s, i) => (
                    <span key={i} className="bg-purple-50 border border-purple-100 text-primary text-xs font-medium px-3 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.work_experience && data.work_experience.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Experience</h4>
                <div className="space-y-3">
                  {data.work_experience.map((w, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                      <p className="text-xs font-bold text-gray-900">{w.role} <span className="text-gray-400 font-normal">at {w.company}</span></p>
                      {w.duration && <p className="text-[11px] text-gray-400 mt-0.5">{w.duration}</p>}
                      {w.description && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{w.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.projects && data.projects.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Key Projects</h4>
                <div className="space-y-3">
                  {data.projects.map((p, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:w-[30%] bg-white rounded-3xl shadow-sm border border-l-4 border-l-primary p-8 flex flex-col justify-center">
        <h2 className="text-sm font-bold text-gray-900 mb-3">AI Personalization</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          When an interview starts, our engine analyzes your extracted projects to formulate challenging technical questions like:
          <span className="block mt-2 font-medium text-gray-700 italic">
            "I noticed you built a distributed caching layer in your project. How did you handle cache invalidation and race conditions?"
          </span>
        </p>
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
        setSessions(data || [])
        const completed = (data || []).filter((s) => s.status === "completed")
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
    if (!iso) return ""
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
        <span className="text-4xl mb-3 block">📊</span>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No interviews yet</h3>
        <p className="text-sm text-gray-500 mb-6">Complete your first mock interview to generate performance feedback reports.</p>
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
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-purple-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
                s.interview_type === "hr" ? "bg-purple-50 text-primary" : "bg-blue-50 text-blue-600"
              }`}>
                {s.interview_type === "hr" ? "HR" : "DEV"}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {s.interview_type === "hr" ? "HR Behavioral Interview" : "Technical Interview"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {fb && typeof fb.overall_score === "number" && (
                <div className="text-right">
                  <span className={`text-xl font-extrabold ${
                    fb.overall_score >= 80 ? "text-emerald-600" : fb.overall_score >= 60 ? "text-amber-500" : "text-rose-500"
                  }`}>
                    {fb.overall_score}%
                  </span>
                  <span className="text-[10px] text-gray-400 block font-medium">Score</span>
                </div>
              )}

              <span className={`text-[10px] font-semibold tracking-wider rounded-full px-3 py-1 ${
                s.status === "completed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                {s.status === "completed" ? "COMPLETED" : "IN PROGRESS"}
              </span>

              <button
                onClick={() => navigate(`/interview-complete?session_id=${s.id}`)}
                className="text-xs font-semibold text-primary hover:text-white hover:bg-primary border border-primary/20 px-4 py-2 rounded-full transition-all"
              >
                View Report →
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PreferencesView() {
  const [voices, setVoices] = useState([])
  const [voice, setVoice] = useState(() => localStorage.getItem("interviewer_voice") || "en-US-AvaNeural")
  const [rate, setRate] = useState(() => localStorage.getItem("interviewer_rate") || "-3%")
  const [pitch, setPitch] = useState(() => localStorage.getItem("interviewer_pitch") || "+0Hz")
  const [testing, setTesting] = useState(false)
  const [savedMsg, setSavedMsg] = useState("")

  useEffect(() => {
    fetchTtsVoices().then((res) => {
      if (res && res.voices) setVoices(res.voices)
    })
  }, [])

  function handleSavePreferences() {
    localStorage.setItem("interviewer_voice", voice)
    localStorage.setItem("interviewer_rate", rate)
    localStorage.setItem("interviewer_pitch", pitch)
    setSavedMsg("Voice and cadence preferences saved!")
    setTimeout(() => setSavedMsg(""), 3000)
  }

  async function handleTestAudio() {
    if (testing) {
      stopAnySpeech()
      setTesting(false)
      return
    }
    setTesting(true)
    await playHumanSpeech(
      "Hello! This is a test of your chosen interviewer voice. I speak with natural phrasing, conversational pacing, and human cadence.",
      {
        voice,
        rate,
        pitch,
        onEnd: () => setTesting(false),
        onError: () => setTesting(false),
      }
    )
    setTesting(false)
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Interviewer Voice & Speech Preferences</h2>
          <p className="text-xs text-gray-400 mt-0.5">Customize the persona, speaking rate, and tone for your practice sessions</p>
        </div>
        {savedMsg && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            ✓ {savedMsg}
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Interviewer Persona (Neural Voice)
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            {voices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoice(v.id)}
                className={`text-left p-3.5 rounded-2xl border transition-all ${
                  voice === v.id
                    ? "bg-purple-50/80 border-primary shadow-sm"
                    : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">{v.name}</span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase">{v.gender}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{v.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Conversational Pacing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Calm (-7%)", value: "-7%" },
                { label: "Natural (-3%)", value: "-3%" },
                { label: "Standard (0%)", value: "+0%" },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRate(p.value)}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition-all ${
                    rate === p.value
                      ? "bg-primary text-white border-primary"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Pitch & Warmth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Warm (-2Hz)", value: "-2Hz" },
                { label: "Natural", value: "+0Hz" },
                { label: "Crisp (+2Hz)", value: "+2Hz" },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPitch(p.value)}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition-all ${
                    pitch === p.value
                      ? "bg-primary text-white border-primary"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestAudio}
            className="text-xs font-semibold text-primary bg-purple-50 hover:bg-purple-100 border border-purple-200 px-5 py-2.5 rounded-full transition-all flex items-center gap-2"
          >
            <span>{testing ? "⏹️ Stop Preview" : "🔊 Preview Voice Now"}</span>
          </button>

          <button
            type="button"
            onClick={handleSavePreferences}
            className="bg-primary hover:bg-[#5b22e0] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-md transition-all"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountManagement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view, setView] = useState(() => searchParams.get("tab") || "profile")
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam && ["profile", "resume", "reports", "preferences"].includes(tabParam)) {
      setView(tabParam)
    }
  }, [searchParams])

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
      .then((sessions) => setCompletedCount((sessions || []).filter((s) => s.status === "completed").length))
      .catch(() => {})
  }, [])

  if (!user) return null

  function handleLogout() {
    clearToken()
    navigate("/login")
  }

  return (
    <div className="min-h-screen font-sans flex bg-[#fbfaff]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-extrabold tracking-tight">
            <span className="text-gray-900">Interview</span>
            <span className="text-primary">Spar</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400">✕</button>
        </div>

        <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent border-4 border-white shadow-xl flex items-center justify-center text-white text-2xl font-bold">
            {user ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <h2 className="mt-4 text-base font-extrabold text-gray-900 text-center">{user?.name}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{user?.email}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { setView(item.view); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                view === item.view ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:bg-purple-50 hover:text-gray-900"
              }`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <button
            onClick={() => navigate("/interview-type")}
            className="w-full bg-primary hover:bg-[#5b22e0] text-white font-bold text-xs py-3 rounded-full shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1.5"
          >
            <span>New Mock Interview</span>
            <span>🚀</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 py-2 transition-colors"
          >
            <Icon name="logout" className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <div className="lg:hidden flex items-center justify-between px-6 h-[72px] bg-white border-b border-gray-100">
          <Link to="/dashboard" className="text-xl font-extrabold tracking-tight">
            <span className="text-gray-900">Interview</span>
            <span className="text-primary">Spar</span>
          </Link>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600" aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="p-6 lg:p-12 max-w-[1200px]">
          <div className="mb-8">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-[#5b22e0] transition-colors mb-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900">
              {view === "profile" && <>Personal <span className="text-primary">Profile</span></>}
              {view === "resume" && <>Resume <span className="text-primary">Management</span></>}
              {view === "reports" && <>Interview <span className="text-primary">Reports</span></>}
              {view === "preferences" && <>Voice & <span className="text-primary">Preferences</span></>}
            </h1>
          </div>

          {view === "profile" && <ProfileView user={user} onUserUpdate={setUser} completedCount={completedCount} />}
          {view === "resume" && <ResumeView />}
          {view === "reports" && <ReportsView />}
          {view === "preferences" && <PreferencesView />}
        </div>
      </div>
    </div>
  )
}
