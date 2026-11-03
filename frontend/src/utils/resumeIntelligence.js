/**
 * Resume Intelligence Configuration & Utility Helpers
 * Centralized for consistent UI rendering, testability, and strict scoring semantics.
 */

export const CANONICAL_ROLES = [
  {
    id: "software-engineer-sde",
    title: "Software Engineer (SDE)",
    label: "Software Engineer (SDE)",
    description:
      "Builds and maintains software systems across the stack, with emphasis on data structures, algorithms, APIs, testing, and collaboration.",
    badge: "General SDE",
  },
  {
    id: "frontend-developer",
    title: "Frontend Developer",
    label: "Frontend Developer",
    description:
      "Builds accessible, responsive web interfaces and integrates them with APIs and design systems.",
    badge: "Frontend",
  },
  {
    id: "backend-developer",
    title: "Backend Developer",
    label: "Backend Developer",
    description:
      "Designs APIs, services, data access, and server-side business logic with reliability and security in mind.",
    badge: "Backend",
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    label: "Data Analyst",
    description:
      "Cleans, queries, analyzes, and communicates data to support business decisions.",
    badge: "Analytics",
  },
  {
    id: "machine-learning-engineer",
    title: "Machine Learning Engineer",
    label: "Machine Learning Engineer",
    description:
      "Builds, evaluates, deploys, and monitors machine-learning systems.",
    badge: "AI / ML",
  },
]

export const FINDING_STATUS_CONFIG = {
  demonstrated: {
    label: "Demonstrated Skills",
    description: "Skills practically applied in projects or work experience with concrete context or outcomes.",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  mentioned_only: {
    label: "Mentioned Only",
    description: "Skills declared in skills lists or summary sections without practical project context.",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  weak_evidence: {
    label: "Weak Evidence",
    description: "Skills mentioned in context but lacking strong application or measurable scope.",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  not_evidenced: {
    label: "Not Evidenced in Resume",
    description: "Requirements with no detectable evidence in this resume. (Absence here does not mean you lack real-world ability).",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    dotClass: "bg-rose-500",
  },
  unknown_requirement: {
    label: "Queued for Review",
    description: "Terms detected in requirement clauses that are not yet canonical skills. Excluded from scoring pending review.",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    dotClass: "bg-purple-500",
  },
  not_evaluated: {
    label: "Could Not Be Evaluated",
    description: "Requirements with ambiguous evidence or low extraction confidence (<0.50).",
    badgeClass: "bg-gray-50 text-gray-800 border-gray-200",
    dotClass: "bg-gray-400",
  },
}

export const RECOMMENDATION_GROUP_CONFIG = {
  skill_development: {
    label: "Skill Development",
    title: "Skill Development",
    subtitle: "Recommended core competencies to acquire or study to meet job requirements.",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  evidence_improvement: {
    label: "Evidence Improvement",
    title: "Evidence & Context Improvement",
    subtitle: "Skills you know but need stronger proof (outcomes, metrics, project links) on your resume.",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  resume_improvement: {
    label: "Resume Structure",
    title: "Resume Wording & Structure",
    subtitle: "Action verbs, impact phrasing, formatting clarity, and project framing recommendations.",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
}

export const JD_MIN_CHARS = 40
export const JD_MAX_CHARS = 20000

/**
 * Validates job description character length.
 */
export function validateJobDescription(text) {
  const trimmed = (text || "").trim()
  const length = trimmed.length
  if (length === 0) {
    return { valid: false, length: 0, error: "Job description cannot be empty." }
  }
  if (length < JD_MIN_CHARS) {
    return {
      valid: false,
      length,
      error: `Job description is too short (${length} characters). Please provide at least ${JD_MIN_CHARS} characters.`,
    }
  }
  if (length > JD_MAX_CHARS) {
    return {
      valid: false,
      length,
      error: `Job description exceeds maximum limit (${length}/${JD_MAX_CHARS} characters). Please shorten it.`,
    }
  }
  return { valid: true, length, error: null }
}

/**
 * Determines score availability and safe display properties.
 * CRITICAL SEMANTIC RULE: If score is null or status is "unavailable", NEVER format as 0% or empty gauge.
 */
export function formatScoreDisplay(score, scoreStatus) {
  if (score === null || score === undefined || scoreStatus === "unavailable") {
    return {
      isAvailable: false,
      displayValue: null,
      label: "Score Unavailable (Provisional Rubric)",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      description:
        "Numerical matching is withheld for this role because target rubrics are currently provisional (unweighted taxonomy baseline). Detailed skill findings and recommendations below are fully valid and actionable.",
    }
  }

  const rounded = Math.round(Number(score))
  return {
    isAvailable: true,
    displayValue: `${rounded}%`,
    rawNumber: rounded,
    label: "Textual Requirement Coverage",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description:
      "Represents deterministic keyword and semantic requirement coverage against the provided job description text. This is not a hiring guarantee or ATS pass rate.",
  }
}

/**
 * Maps a candidate target role string to the canonical role ID.
 */
export function mapRoleToCanonicalId(role) {
  if (!role) return "software-engineer-sde"
  const lowered = role.toLowerCase()
  if (lowered.includes("frontend")) return "frontend-developer"
  if (lowered.includes("backend")) return "backend-developer"
  if (lowered.includes("data") || lowered.includes("analyst")) return "data-analyst"
  if (lowered.includes("machine") || lowered.includes("ml") || lowered.includes("ai"))
    return "machine-learning-engineer"
  return "software-engineer-sde"
}

/**
 * Normalizes API error objects and status codes to user-friendly messages.
 */
export function extractErrorMessage(err) {
  if (!err) return "An unexpected error occurred."
  if (typeof err === "string") return err

  const status = err.status || err.response?.status
  const detail = err.response?.data?.detail || err.message

  if (status === 401) {
    return "Your session has expired. Please log in again to continue."
  }
  if (status === 404) {
    return "Resume not found. Please upload a resume before requesting an assessment."
  }
  if (status === 409) {
    return "Resume analysis is still processing or unavailable. Please wait a moment and try again."
  }
  if (status === 422) {
    return typeof detail === "string" ? detail : "Invalid input parameters. Please verify your role or job description text."
  }
  if (detail && typeof detail === "string") {
    return detail
  }
  return "Could not complete assessment. Please check your network connection or try again."
}
