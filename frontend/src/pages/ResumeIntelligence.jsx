import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  getMe,
  clearToken,
  getLatestResume,
  getLatestResumeAnalysis,
  createRoleMatch,
  createJobDescriptionMatch,
  getLatestMatch,
  getMatchById,
} from "../api/auth"
import DashboardNavbar from "../components/DashboardNavbar"

import {
  CANONICAL_ROLES,
  FINDING_STATUS_CONFIG,
  RECOMMENDATION_GROUP_CONFIG,
  mapRoleToCanonicalId,
} from "../utils/resumeIntelligence"

export default function ResumeIntelligence() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [resumeState, setResumeState] = useState({
    loading: true,
    hasResume: false,
    resumeDocument: null,
    analysis: null,
    isOcrRequired: false,
    error: null,
  })

  // Assessment modes & inputs
  const [activeMode, setActiveMode] = useState("role") // "role" | "jd"
  const [selectedRoleId, setSelectedRoleId] = useState("software-engineer-sde")
  const [jdInput, setJdInput] = useState("")
  const [jdValidationMsg, setJdValidationMsg] = useState("")

  // Assessment execution & state
  const [submitting, setSubmitting] = useState(false)
  const [assessment, setAssessment] = useState(null)
  const [assessmentError, setAssessmentError] = useState(null)
  const [activeFilter, setActiveFilter] = useState("all") // "all" | status
  const [expandedSnippetId, setExpandedSnippetId] = useState(null)
  const [previousAssessment, setPreviousAssessment] = useState(null)
  const [showLimitations, setShowLimitations] = useState(false)

  // Load user
  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        setSelectedRoleId(mapRoleToCanonicalId(u.target_role))
      })
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  // Load resume & latest assessment
  useEffect(() => {
    if (!user) return

    setResumeState((prev) => ({ ...prev, loading: true }))

    Promise.allSettled([getLatestResume(), getLatestResumeAnalysis(), getLatestMatch()])
      .then(([resResult, analysisResult, matchResult]) => {
        const hasResume = resResult.status === "fulfilled" && !!resResult.value
        const resumeDoc = hasResume ? resResult.value : null
        let analysis = null
        let isOcr = false

        if (analysisResult.status === "fulfilled" && analysisResult.value?.analysis) {
          analysis = analysisResult.value.analysis
          if (analysis.warnings?.some((w) => w.toLowerCase().includes("ocr"))) {
            isOcr = true
          }
        } else if (resumeDoc?.analysis) {
          analysis = resumeDoc.analysis
          if (analysis.warnings?.some((w) => w.toLowerCase().includes("ocr"))) {
            isOcr = true
          }
        }

        setResumeState({
          loading: false,
          hasResume,
          resumeDocument: resumeDoc,
          analysis,
          isOcrRequired: isOcr,
          error: !hasResume && resResult.reason?.message ? resResult.reason.message : null,
        })

        if (matchResult.status === "fulfilled" && matchResult.value) {
          setAssessment(matchResult.value)
          setPreviousAssessment(matchResult.value)
          if (matchResult.value.assessment_mode === "job_description") {
            setActiveMode("jd")
          } else if (matchResult.value.target_role_id) {
            setSelectedRoleId(matchResult.value.target_role_id)
            setActiveMode("role")
          }
        }
      })
      .catch((err) => {
        setResumeState({
          loading: false,
          hasResume: false,
          resumeDocument: null,
          analysis: null,
          isOcrRequired: false,
          error: err.message || "Failed to load resume status",
        })
      })
  }, [user])

  // Submit Role Assessment
  async function handleAnalyzeRole() {
    if (submitting || !resumeState.hasResume || resumeState.isOcrRequired) return
    setSubmitting(true)
    setAssessmentError(null)

    try {
      const result = await createRoleMatch(selectedRoleId)
      setAssessment(result)
      setPreviousAssessment(result)
    } catch (err) {
      if (err.message && err.message.includes("Unauthorized")) {
        clearToken()
        navigate("/login")
        return
      }
      setAssessmentError(err.message || "Assessment request failed. Please verify your resume and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Job Description Assessment
  async function handleAnalyzeJobDescription(e) {
    e.preventDefault()
    if (submitting || !resumeState.hasResume || resumeState.isOcrRequired) return

    const trimmed = jdInput.trim()
    if (!trimmed) {
      setJdValidationMsg("Please paste a job description before analyzing.")
      return
    }
    if (trimmed.length < 40) {
      setJdValidationMsg(`Job description is too short (${trimmed.length} characters). Minimum required is 40 characters.`)
      return
    }
    if (trimmed.length > 20000) {
      setJdValidationMsg(`Job description exceeds the 20,000 character limit (${trimmed.length} characters).`)
      return
    }

    setJdValidationMsg("")
    setSubmitting(true)
    setAssessmentError(null)

    try {
      const result = await createJobDescriptionMatch(trimmed)
      setAssessment(result)
      setPreviousAssessment(result)
    } catch (err) {
      if (err.message && err.message.includes("Unauthorized")) {
        clearToken()
        navigate("/login")
        return
      }
      setAssessmentError(err.message || "Job description analysis failed. Please verify the text and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Reload an assessment
  async function handleReloadAssessment(assessmentId) {
    if (!assessmentId) return
    setSubmitting(true)
    try {
      const res = await getMatchById(assessmentId)
      setAssessment(res)
    } catch (err) {
      console.error("Failed to reload assessment", err)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedRole = CANONICAL_ROLES.find((r) => r.id === selectedRoleId) || CANONICAL_ROLES[0]

  // Flattened findings from matched_requirements, skill_gaps, and not_evaluated_requirements
  const allFindings = assessment
    ? [
        ...(assessment.matched_requirements || []),
        ...(assessment.skill_gaps || []),
        ...(assessment.not_evaluated_requirements || []),
      ]
    : []

  const unknownRequirements = assessment?.unknown_requirements || []

  const filteredFindings = allFindings.filter((finding) => {
    if (activeFilter === "all") return true
    return finding.match_status === activeFilter
  })

  // Format date helper
  function formatIsoDate(iso) {
    if (!iso) return "Recent"
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

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

      <main className="pt-28 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        {/* Area 1: Page Header and Introduction */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-full px-3.5 py-1 text-xs font-semibold text-primary mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Deterministic Skill Match Engine</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Resume Intelligence & Skill Readiness
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl leading-relaxed">
                Compare your extracted resume evidence against verified occupational rubrics or specific job descriptions.
                Assessments are deterministic, explainable, and never fabricate scores.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/account?tab=resume"
                className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold text-xs px-4 py-2.5 rounded-full transition-all hover:bg-gray-50 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Manage Resume</span>
              </Link>
              <Link
                to="/interview-type"
                className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-5 py-2.5 rounded-full transition-all shadow-md shadow-primary/20 flex items-center gap-2"
              >
                <span>Practice Interview</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Area 2: Resume Status & Selection Banner */}
        <section className="mb-8" aria-label="Resume Status">
          {resumeState.loading ? (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-center gap-3 text-gray-400 text-sm">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Checking resume status...</span>
            </div>
          ) : !resumeState.hasResume ? (
            /* Empty State: No Resume */
            <div className="bg-white rounded-3xl p-8 border border-dashed border-purple-200 text-center shadow-sm">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 text-primary flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900">No Resume Uploaded Yet</h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                Upload your PDF or DOCX resume to extract verified skills, project context, and work experience before running an assessment.
              </p>
              <Link
                to="/account?tab=resume"
                className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-[#5b22e0] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5"
              >
                <span>Upload Resume</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          ) : resumeState.isOcrRequired ? (
            /* OCR Required Warning */
            <div className="bg-amber-50/80 rounded-3xl p-6 border border-amber-200 text-amber-900 shadow-sm flex items-start gap-4">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h2 className="text-sm font-bold text-amber-900">Scanned Document Detected (OCR Required)</h2>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  The uploaded PDF appears to be a scanned image without selectable text. InterviewSpar requires a text-based PDF or DOCX document to extract structured skill evidence deterministically. OCR on image files is not currently supported.
                </p>
                <Link
                  to="/account?tab=resume"
                  className="mt-3 inline-block text-xs font-bold text-amber-900 underline hover:text-amber-950"
                >
                  Upload a text-based resume document →
                </Link>
              </div>
            </div>
          ) : !resumeState.analysis ? (
            /* Analysis Missing Warning (409) */
            <div className="bg-rose-50/80 rounded-3xl p-6 border border-rose-200 text-rose-900 shadow-sm flex items-start gap-4">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h2 className="text-sm font-bold text-rose-900">Structured Resume Analysis Missing</h2>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  Your resume document was uploaded, but the structured section analysis is not ready. Please re-upload your resume to generate the required skill evidence.
                </p>
                <Link
                  to="/account?tab=resume"
                  className="mt-3 inline-block text-xs font-bold text-rose-900 underline hover:text-rose-950"
                >
                  Re-upload resume now →
                </Link>
              </div>
            </div>
          ) : (
            /* Resume Ready State */
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900">Active Resume Analyzed & Ready</h2>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Indexed
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Parser Version: {resumeState.analysis.parser_version} • Uploaded {formatIsoDate(resumeState.resumeDocument.uploaded_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700">
                <div className="bg-gray-50 px-3.5 py-1.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-normal">Skills: </span>
                  <span className="text-primary font-bold">{resumeState.analysis.skills?.length || 0}</span>
                </div>
                <div className="bg-gray-50 px-3.5 py-1.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-normal">Projects: </span>
                  <span className="text-primary font-bold">{resumeState.analysis.projects?.length || 0}</span>
                </div>
                <div className="bg-gray-50 px-3.5 py-1.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-normal">Experience: </span>
                  <span className="text-primary font-bold">{resumeState.analysis.work_experience?.length || 0}</span>
                </div>
                <Link
                  to="/account?tab=resume"
                  className="text-primary hover:underline font-semibold"
                >
                  View Details →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Area 3: Assessment Mode Selection & Controls */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm mb-10" aria-label="Assessment Controls">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Choose Assessment Mode</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Evaluate against an approved occupational rubric or compare directly with a specific job posting.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-2xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveMode("role")}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                  activeMode === "role"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                aria-pressed={activeMode === "role"}
              >
                Mode A: Target Role
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("jd")}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                  activeMode === "jd"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                aria-pressed={activeMode === "jd"}
              >
                Mode B: Specific Job Description
              </button>
            </div>
          </div>

          {/* Mode A Form */}
          {activeMode === "role" ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div>
                  <label htmlFor="target-role-dropdown" className="block text-xs font-bold text-gray-700 mb-2">
                    Select Canonical Target Role
                  </label>
                  <select
                    id="target-role-dropdown"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    disabled={submitting || !resumeState.hasResume}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                  >
                    {CANONICAL_ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Canonical Role ID: <code className="text-primary font-mono bg-purple-50 px-1 py-0.5 rounded">{selectedRoleId}</code>
                  </p>
                </div>

                <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-900 mb-1">{selectedRole.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">
                    {selectedRole.description}
                  </p>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Rubric Status: Provisional (Curated Taxonomy)</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-gray-400">
                  Role assessment uses the canonical requirement rubric. No arbitrary hiring scores are generated for provisional rubrics.
                </p>
                <button
                  type="button"
                  onClick={handleAnalyzeRole}
                  disabled={submitting || !resumeState.hasResume || resumeState.isOcrRequired}
                  className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-6 py-3 rounded-full transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Evaluating Resume...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze My Resume</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Mode B Form */
            <form onSubmit={handleAnalyzeJobDescription} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="jd-input-box" className="text-xs font-bold text-gray-700">
                    Paste Real Job Description
                  </label>
                  <span
                    className={`text-xs font-semibold ${
                      jdInput.length > 20000
                        ? "text-rose-600"
                        : jdInput.length > 18000
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                  >
                    {jdInput.length.toLocaleString()} / 20,000 characters (min 40)
                  </span>
                </div>
                <textarea
                  id="jd-input-box"
                  rows={6}
                  value={jdInput}
                  onChange={(e) => setJdInput(e.target.value)}
                  disabled={submitting || !resumeState.hasResume}
                  placeholder="Paste the job qualifications and requirements here (e.g., 'Required skills: Python, React, SQL. Preferred: Docker, AWS. Experience building web APIs...')"
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none disabled:opacity-60"
                />
              </div>

              {jdValidationMsg && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100" role="alert">
                  {jdValidationMsg}
                </p>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-xs text-gray-400 max-w-xl">
                  Job descriptions are treated as private untrusted data. Embedded instructions (e.g. prompt injections) are neutralized. Content is tracked by SHA-256 hash only.
                </p>
                <button
                  type="submit"
                  disabled={submitting || !resumeState.hasResume || resumeState.isOcrRequired || !jdInput.trim()}
                  className="bg-primary hover:bg-[#5b22e0] text-white font-semibold text-xs px-6 py-3 rounded-full transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Analyzing Job Description...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Job Description</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Assessment Submission Error */}
          {assessmentError && (
            <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-3" role="alert">
              <span className="text-rose-600 font-bold text-sm">✕</span>
              <div>
                <p className="font-bold text-rose-900">Assessment Error</p>
                <p className="mt-0.5">{assessmentError}</p>
              </div>
            </div>
          )}
        </section>

        {/* Assessment Results Container */}
        {assessment && (
          <div className="space-y-10">
            {/* Area 4: Assessment Summary Card */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm" aria-label="Assessment Summary">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {assessment.assessment_mode === "role" ? "Role-Based Alignment" : "Job-Specific Textual Match"}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        assessment.assessment_status === "evidence_backed"
                          ? "bg-emerald-50 text-emerald-700"
                          : assessment.assessment_status === "heuristic"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {assessment.assessment_status.replace("_", " ")}
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {assessment.assessment_mode === "role"
                      ? assessment.target_role_title
                      : "Custom Job Description"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Assessment ID: <span className="font-mono text-gray-600">{assessment.assessment_id}</span> • Evaluated on {formatIsoDate(assessment.created_at)}
                  </p>
                </div>

                {/* Score Section: STRICT UNAVAILABLE SCORE HANDLING */}
                <div className="flex items-center gap-4">
                  {assessment.score_status === "unavailable" || assessment.score === null ? (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 max-w-md">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Numerical Score Unavailable</span>
                      </div>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Your role-based assessment is available, but a validated numerical score cannot be calculated yet because this role's rubric does not have sufficient supporting evidence.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 bg-purple-50/70 border border-purple-100 rounded-2xl p-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-semibold">Requirement Coverage</p>
                        <p className="text-3xl font-extrabold text-primary">{assessment.score}%</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Textual match only</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        JD
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Score Explanation & Disclaimers */}
              <div className="mt-4 pt-4 text-xs text-gray-600 leading-relaxed bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                <p className="font-medium text-gray-700">{assessment.score_explanation}</p>
                <p className="text-[11px] text-gray-400 mt-2">
                  Notice: Assessments measure demonstrated evidence against written requirements. Scores do not represent hiring probability, ATS pass rate, or labor market ranking.
                </p>
              </div>

              {/* Evidence Summary Stats */}
              {assessment.evidence_summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                  <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Evaluated</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{assessment.evidence_summary.evaluated_requirement_count}</p>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl text-center border border-emerald-100">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">Demonstrated</p>
                    <p className="text-lg font-bold text-emerald-800 mt-0.5">{assessment.evidence_summary.demonstrated_count}</p>
                  </div>
                  <div className="p-3 bg-blue-50/60 rounded-xl text-center border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-semibold uppercase">Mentioned</p>
                    <p className="text-lg font-bold text-blue-800 mt-0.5">{assessment.evidence_summary.mentioned_only_count}</p>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl text-center border border-amber-100">
                    <p className="text-[10px] text-amber-600 font-semibold uppercase">Weak Evidence</p>
                    <p className="text-lg font-bold text-amber-800 mt-0.5">{assessment.evidence_summary.weak_evidence_count}</p>
                  </div>
                  <div className="p-3 bg-rose-50/60 rounded-xl text-center border border-rose-100">
                    <p className="text-[10px] text-rose-600 font-semibold uppercase">Not Evidenced</p>
                    <p className="text-lg font-bold text-rose-800 mt-0.5">{assessment.evidence_summary.not_evidenced_count}</p>
                  </div>
                  <div className="p-3 bg-purple-50/60 rounded-xl text-center border border-purple-100">
                    <p className="text-[10px] text-purple-600 font-semibold uppercase">Review Queue</p>
                    <p className="text-lg font-bold text-purple-800 mt-0.5">{assessment.evidence_summary.unknown_requirement_count || 0}</p>
                  </div>
                </div>
              )}

              {/* Limitations Drawer / Toggle */}
              {assessment.limitations && assessment.limitations.length > 0 && (
                <div className="mt-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLimitations(!showLimitations)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
                  >
                    <span>{showLimitations ? "Hide assessment limitations" : "View assessment limitations"}</span>
                    <span className="text-[10px]">{showLimitations ? "▲" : "▼"}</span>
                  </button>

                  {showLimitations && (
                    <ul className="mt-3 space-y-1.5 text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100 list-disc list-inside">
                      {assessment.limitations.map((limit, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {limit}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Area 5: Skill Gap Analysis Section */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm" aria-label="Skill Gap Analysis">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Skill Gap & Evidence Breakdown</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Detailed finding status for each requirement extracted from the rubric or job description.
                  </p>
                </div>

                {/* Status Filter Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveFilter("all")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                      activeFilter === "all"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    All ({allFindings.length})
                  </button>
                  {Object.entries(FINDING_STATUS_CONFIG).map(([statusKey, config]) => {
                    const count = allFindings.filter((f) => f.match_status === statusKey).length
                    if (count === 0 && statusKey !== "unknown_requirement") return null
                    return (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setActiveFilter(statusKey)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                          activeFilter === statusKey
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                        <span>{config.label}</span>
                        <span className="opacity-70">({count})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Findings List */}
              {filteredFindings.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No findings in this filter category.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFindings.map((finding) => {
                    const statusConfig = FINDING_STATUS_CONFIG[finding.match_status] || FINDING_STATUS_CONFIG.not_evaluated
                    const isExpanded = expandedSnippetId === finding.requirement_id

                    return (
                      <div
                        key={finding.requirement_id}
                        className="bg-[#fcfcff] border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotClass}`} />
                            <h3 className="text-sm font-bold text-gray-900">{finding.display_name}</h3>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                finding.requirement_type === "required"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : finding.requirement_type === "preferred"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-gray-50 text-gray-600 border border-gray-200"
                              }`}
                            >
                              {finding.requirement_type}
                            </span>
                          </div>

                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border ${statusConfig.badgeClass} self-start sm:self-auto`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                          {finding.explanation}
                        </p>

                        {/* Evidence & Snippet */}
                        {finding.evidence && (
                          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <span>Source Section: <strong className="text-gray-700 capitalize">{finding.evidence.section_type}</strong></span>
                              <span>•</span>
                              <span>Classification: <strong className="text-gray-700 capitalize">{finding.evidence.classification.replace("_", " ")}</strong></span>
                              <span>•</span>
                              <span>Parser Confidence: <strong className="text-gray-700">{Math.round(finding.evidence.parser_confidence * 100)}%</strong></span>
                            </div>

                            {finding.evidence.snippet && (
                              <div className="mt-1 bg-white p-3 rounded-xl border border-gray-100 text-xs text-gray-700 font-mono">
                                <span className="text-gray-400 select-none">Excerpt: </span>
                                {isExpanded ? (
                                  <span>{finding.evidence.snippet}</span>
                                ) : (
                                  <span>
                                    {finding.evidence.snippet.slice(0, 120)}
                                    {finding.evidence.snippet.length > 120 && "..."}
                                  </span>
                                )}
                                {finding.evidence.snippet.length > 120 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSnippetId(isExpanded ? null : finding.requirement_id)}
                                    className="ml-2 text-primary font-sans text-xs underline font-semibold"
                                  >
                                    {isExpanded ? "Show less" : "Read full"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actionable Next Step */}
                        {finding.suggested_next_action && (
                          <div className="mt-3 bg-purple-50/40 p-3 rounded-xl border border-purple-100/60 text-xs text-purple-900 flex items-start gap-2">
                            <span className="font-bold text-primary">Next Action:</span>
                            <span>{finding.suggested_next_action}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Unknown Requirements / Review Queue */}
              {unknownRequirements.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Terms Queued for Taxonomy Review ({unknownRequirements.length})
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    These terms were detected in requirement-like clauses but are not yet canonical catalog skills. They are tracked for review rather than incorrectly penalized as missing candidate skills.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unknownRequirements.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-semibold px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl"
                        title={item.reason}
                      >
                        {item.source_term} ({item.requirement_type})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Area 6: Personalized Recommendations Section */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm" aria-label="Personalized Recommendations">
              <div className="pb-6 border-b border-gray-100 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Personalized Preparation Roadmap</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Actionable, deterministic recommendations grounded in your actual skill gaps. Ranked by priority.
                </p>
              </div>

              {!assessment.recommendations || assessment.recommendations.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No recommendations generated. All core requirements appear demonstrated!
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {assessment.recommendations.map((rec) => {
                    const groupConfig = RECOMMENDATION_GROUP_CONFIG[rec.group] || {
                      label: rec.group,
                      badgeClass: "bg-gray-50 text-gray-700",
                    }
                    const priorityConfig = {
                      high: { label: "High Priority", class: "bg-rose-100 text-rose-800 border-rose-200" },
                      medium: { label: "Medium Priority", class: "bg-amber-100 text-amber-800 border-amber-200" },
                      low: { label: "Low Priority", class: "bg-blue-100 text-blue-800 border-blue-200" },
                    }[rec.priority_band] || { label: rec.priority_band, class: "bg-gray-100 text-gray-700" }

                    return (
                      <div
                        key={rec.recommendation_id}
                        className="bg-[#fcfcff] border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:shadow-sm transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${priorityConfig.class}`}>
                              {priorityConfig.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${groupConfig.badgeClass}`}>
                              {groupConfig.label}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{rec.title}</h3>
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{rec.action}</p>

                          <div className="mt-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600">
                            <span className="font-semibold text-gray-700">Why it matters: </span>
                            <span>{rec.why_it_matters}</span>
                          </div>

                          {rec.learning_activity && (
                            <p className="text-xs text-primary font-medium mt-2.5">
                              💡 {rec.learning_activity}
                            </p>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-400 italic mt-4 pt-3 border-t border-gray-100">
                          {rec.safety_note}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Area 7: Previous Assessment History Section */}
            {previousAssessment && (
              <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm" aria-label="Previous Assessment">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Previous Assessment Record</h2>
                    <p className="text-xs text-gray-400">Stored idempotently under your account</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReloadAssessment(previousAssessment.assessment_id)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Re-inspect record
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <span className="font-bold text-gray-900">
                      {previousAssessment.assessment_mode === "role"
                        ? previousAssessment.target_role_title
                        : "Job Description Assessment"}
                    </span>
                    <span className="text-gray-400 ml-2">({formatIsoDate(previousAssessment.created_at)})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">
                      Score:{" "}
                      <strong className="text-gray-900">
                        {previousAssessment.score !== null ? `${previousAssessment.score}%` : "Unavailable (Provisional)"}
                      </strong>
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">{previousAssessment.assessment_id}</span>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
