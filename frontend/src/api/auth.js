const API = "http://localhost:8000"

export function getToken() {
  return sessionStorage.getItem("token")
}

export function setToken(t) {
  sessionStorage.setItem("token", t)
}

export function clearToken() {
  sessionStorage.removeItem("token")
}

export async function signup(name, email, password) {
  const res = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Signup failed")
  }
  return res.json()
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Login failed")
  }
  return res.json()
}

export async function getMe() {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error("Unauthorized")
  return res.json()
}

export async function uploadResume(file) {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${API}/resume/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Upload failed")
  }
  return res.json()
}

export async function getLatestResume() {
  const res = await fetch(`${API}/resume/latest`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error("No resume found")
  return res.json()
}

export async function startInterview(interviewType) {
  const res = await fetch(`${API}/interview/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ interview_type: interviewType }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to start interview")
  }
  return res.json()
}

export async function answerInterview(sessionId, answer) {
  const res = await fetch(`${API}/interview/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ session_id: sessionId, answer }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to submit answer")
  }
  return res.json()
}

export async function listSessions() {
  const res = await fetch(`${API}/interview/sessions`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to fetch sessions")
  }
  return res.json()
}

export async function getInterviewFeedback(sessionId) {
  const res = await fetch(`${API}/interview/${sessionId}/feedback`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to fetch feedback")
  }
  return res.json()
}

export async function updateUserProfile(data) {
  const res = await fetch(`${API}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to update profile")
  }
  return res.json()
}

export async function changeUserPassword(old_password, new_password) {
  const res = await fetch(`${API}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ old_password, new_password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to change password")
  }
  return res.json()
}

export async function createRoleMatch(target_role_id) {
  const res = await fetch(`${API}/resume/analysis/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ target_role_id }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail?.message || err.detail || "Role match failed")
  }
  return res.json()
}

export async function createJobDescriptionMatch(job_description) {
  const res = await fetch(`${API}/resume/analysis/job-description`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ job_description }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail?.message || err.detail || "Job description match failed")
  }
  return res.json()
}

export async function getLatestMatch(mode, target_role_id) {
  const params = new URLSearchParams()
  if (mode) params.append("mode", mode)
  if (target_role_id) params.append("target_role_id", target_role_id)
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API}/resume/analysis/match/latest${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getMatchById(assessmentId) {
  const res = await fetch(`${API}/resume/analysis/match/${assessmentId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail?.message || err.detail || "Assessment not found")
  }
  return res.json()
}

export async function getLatestResumeAnalysis() {
  const res = await fetch(`${API}/resume/analysis/latest`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || "No resume analysis found")
  }
  return res.json()
}
