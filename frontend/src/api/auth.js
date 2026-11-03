const API = "/api";
const TOKEN_KEY = "interviewspar_token";

export function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(t) {
  if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export async function signup(name, email, password, role = "student") {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Signup failed")
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
    throw new Error(err.error || "Login failed")
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
    throw new Error(err.error || "Upload failed")
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
    body: JSON.stringify({ persona: interviewType }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to start interview")
  }
  return res.json()
}

export async function answerInterview(sessionId, answer) {
  const res = await fetch(`${API}/interview/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ sessionId, answer }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to submit answer")
  }
  return res.json()
}

export async function listSessions() {
  const res = await fetch(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to fetch sessions")
  }
  return res.json()
}

export async function getInterviewFeedback(sessionId) {
  const res = await fetch(`${API}/interview/${sessionId}/feedback`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to fetch feedback")
  }
  return res.json()
}

export async function updateUserProfile(data) {
  const res = await fetch(`${API}/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Failed to update profile")
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
    throw new Error(err.error || "Failed to change password")
  }
  return res.json()
}
