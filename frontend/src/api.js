const BASE = "/api";
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

async function req(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || `request failed: ${res.status}`);
  }
  return data;
}

// ---- auth ----
export async function getHealth() {
  return req("/health", { auth: false });
}
export async function login({ email, password }) {
  const data = await req("/auth/login", { method: "POST", body: { email, password }, auth: false });
  setToken(data.token);
  return data.user;
}
export async function register(payload) {
  const data = await req("/auth/register", { method: "POST", body: payload, auth: false });
  setToken(data.token);
  return data.user;
}
export async function fetchMe() {
  const data = await req("/auth/me");
  return data.user;
}
export async function updateProfile(patch) {
  const data = await req("/auth/me", { method: "PATCH", body: patch });
  return data.user;
}
export async function listUsers() {
  const data = await req("/auth/users");
  return data.users;
}

export const ROLE_LABELS = {
  student: "Student",
  developer: "Developer (Interviewer)",
  company: "Company",
  admin: "Admin",
};

// STEP 1 — send conversation to the AI interviewer, get next question back.
export function sendInterviewMessage(payload) {
  return req("/interview/message", { method: "POST", body: payload });
}
// STEP 2 — start session + get calibration questions
export function startSession(payload) {
  return req("/interview/start", { method: "POST", body: payload });
}
// STEP 2 — submit a calibration answer
export function submitCalibration(payload) {
  return req("/interview/calibration", { method: "POST", body: payload });
}
// STEP 3 — upload resume PDF
export function uploadResume(sessionId, file) {
  const headers = {};
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return fetch(`${BASE}/resume/upload?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf", ...headers },
    body: file,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "resume failed");
    return data;
  });
}
// STEP 4 — coding problems + run
export function getProblems() {
  return req("/code/problems", { auth: false });
}
export function runCode(payload) {
  return req("/code/run", { method: "POST", body: payload, auth: false });
}
// STEP 5 — data collection
export function addSample(payload) {
  return req("/collect/add", { method: "POST", body: payload });
}
export function getCollectCount() {
  return req("/collect/count");
}
// STEP 8 — integrity events + code similarity
export function logIntegrity(payload) {
  return req("/integrity/log", { method: "POST", body: payload });
}
export function getIntegrity(sessionId) {
  return req(`/integrity/${encodeURIComponent(sessionId)}`);
}
export function checkSimilarity(payload) {
  return req("/code/similarity", { method: "POST", body: payload, auth: false });
}
// STEP 10 — end session + dashboards
export function endSession(sessionId) {
  return req("/sessions/end", { method: "POST", body: { sessionId } });
}
export function listSessions() {
  return req("/sessions");
}
export function getSessionReport(id) {
  return req(`/sessions/${encodeURIComponent(id)}`);
}
// STEP 11 — marketplace
export function postRole(payload) {
  return req("/marketplace/role", { method: "POST", body: payload });
}
export function matchInterviewer(roleId) {
  return req("/marketplace/match", { method: "POST", body: { roleId } });
}
export function mockPayment(roleId, total) {
  return req("/marketplace/payment", { method: "POST", body: { roleId, total } });
}
export function listRoles() {
  return req("/marketplace/roles");
}
export function acceptGig(roleId, handle) {
  return req("/marketplace/accept", { method: "POST", body: { roleId, handle } });
}
