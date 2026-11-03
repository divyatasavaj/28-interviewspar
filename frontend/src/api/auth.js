const API = "/api";
const TOKEN_KEY = "interviewspar_token";
export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function errorMessage(data, fallback = "Request failed") {
  const detail = data?.detail ?? data?.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(item => item.msg).join("; ");
  return detail?.message || fallback;
}
export async function apiRequest(path, options = {}) {
  const requestToken = getToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? {"Content-Type":"application/json"} : {}),
      ...(requestToken ? {Authorization:`Bearer ${requestToken}`} : {}), ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && getToken() === requestToken) clearToken();
    const error = new Error(errorMessage(data)); error.status = response.status; throw error;
  }
  if (response.status !== 204 && (data === null || typeof data !== 'object')) {
    const error = new Error('The server returned an invalid API response. Please retry.');
    error.status = 502;
    throw error;
  }
  return data;
}
function authResult(data) {
  if (typeof data?.access_token !== 'string' || !data.access_token.trim()) {
    const error = new Error('The server did not return a valid sign-in token. Please retry.');
    error.status = 502;
    throw error;
  }
  return {...data, token:data.access_token};
}
export async function signup(name, email, password) {
  const data = await apiRequest("/auth/signup", {method:"POST",body:JSON.stringify({name,email,password})});
  return authResult(data);
}
export async function login(email,password) {
  const data = await apiRequest("/auth/login", {method:"POST",body:JSON.stringify({email,password})});
  return authResult(data);
}
export const getMe = () => apiRequest("/auth/me");
export async function uploadResume(file, consent = false) {
  if (!consent) throw new Error("Please consent to saving your resume first.");
  if (file.size > 10*1024*1024) throw new Error("Resume must be 10 MB or smaller.");
  const body = new FormData(); body.append("file",file);
  return apiRequest("/resume/upload", {method:"POST", body, headers:{"X-Data-Consent":"true"}});
}
export const getLatestResume = () => apiRequest("/resume/latest");
export const deleteResume = () => apiRequest("/resume/", {method:"DELETE"});
export const listSessions = () => apiRequest("/interview/sessions");
export const getInterviewFeedback = id => apiRequest(`/interview/${id}/feedback`);
export const updateUserProfile = data => apiRequest("/auth/profile", {method:"PUT",body:JSON.stringify(data)});
export async function changeUserPassword(old_password,new_password) {
  const data = await apiRequest("/auth/change-password",{method:"POST",body:JSON.stringify({old_password,new_password})});
  if (data.access_token) setToken(data.access_token);
  return data;
}
export async function logout() {
  try { await apiRequest("/auth/logout",{method:"POST"}); } finally { clearToken(); }
}
export const startInterview = settings => apiRequest("/interview/start",{method:"POST",body:JSON.stringify(settings)});
export const answerInterview = data => apiRequest("/interview/answer",{method:"POST",body:JSON.stringify(data)});

export const createRoleMatch = target_role_id => apiRequest("/resume/analysis/match", {
  method: "POST", body: JSON.stringify({ target_role_id }),
});
export const createJobDescriptionMatch = job_description => apiRequest("/resume/analysis/job-description", {
  method: "POST", body: JSON.stringify({ job_description }),
});
export async function getLatestMatch(mode, target_role_id) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (target_role_id) params.set("target_role_id", target_role_id);
  try {
    return await apiRequest(`/resume/analysis/match/latest?${params}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
export const getMatchById = id => apiRequest(`/resume/analysis/match/${encodeURIComponent(id)}`);
export const getLatestResumeAnalysis = () => apiRequest("/resume/analysis/latest");
