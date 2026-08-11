const API = "http://localhost:8000"

export function getToken() {
  return sessionStorage.getItem("token")
}

export async function logIntegrity(sessionId, type, extra = {}) {
  const res = await fetch(`${API}/integrity/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ session_id: sessionId, type, ...extra }),
  })
  if (!res.ok) throw new Error("Failed to log integrity event")
  return res.json()
}

async function postIntegrity(path, payload) {
  const res = await fetch(`${API}/integrity/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to log integrity event (${path})`)
  return res.json()
}

export function logFaceEvent(sessionId, eventType, extra = {}) {
  return postIntegrity("face-event", { session_id: sessionId, event_type: eventType, ...extra })
}

export function logTabSwitch(sessionId) {
  return postIntegrity("tab-switch", { session_id: sessionId })
}

export function logFullscreenExit(sessionId) {
  return postIntegrity("fullscreen-exit", { session_id: sessionId })
}

export function logCopyPaste(sessionId, { question_id, pasted_content_length } = {}) {
  return postIntegrity("copy-paste", { session_id: sessionId, question_id, pasted_content_length })
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

export async function submitCalibration(sessionId, question, answer) {
  const res = await fetch(`${API}/interview/calibration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ session_id: sessionId, question, answer }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to submit calibration answer")
  }
  return res.json()
}

export async function sendInterviewMessage(sessionId, history) {
  const res = await fetch(`${API}/interview/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ session_id: sessionId, history }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to get interviewer message")
  }
  return res.json()
}

export async function endInterview(sessionId) {
  const res = await fetch(`${API}/interview/${sessionId}/end`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to end interview")
  }
  return res.json()
}

export async function getProblems() {
  const res = await fetch(`${API}/code/problems`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to fetch problems")
  }
  return res.json()
}

export async function runCode({ problemId, language, code }) {
  const res = await fetch(`${API}/code/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ problemId, language, code }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to run code")
  }
  return res.json()
}

export async function checkCodeSimilarity({ sessionId, problemId, language, code }) {
  const res = await fetch(`${API}/code/similarity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ sessionId, problemId, language, code }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to check similarity")
  }
  return res.json()
}
