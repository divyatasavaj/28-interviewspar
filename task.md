# InterviewSpar Project Tasks

## MEMBER 1: RUDRA VAGHELA

---

## Phase 1: Database Migration (PostgreSQL → MongoDB) ✓ COMPLETED

All SQLAlchemy/PostgreSQL code replaced with PyMongo + MongoDB Atlas.

---

## Phase 2: Backend Feature Implementation (flow.md) ✓ COMPLETED

| # | Module | Files | Status | Owner |
|---|---|---|---|---|
| 1 | Auth & User Mgmt | `routes/auth.py` — signup, login, me, update_profile, change_password, logout | Done | RUDRA VAGHELA |
| 2 | Resume Handling | `routes/resume.py` — upload, parse, summary extraction | Done | RUDRA VAGHELA |
| 3 | Question Bank | `routes/questions.py` — CRUD, calibration, next-question, reference | Done | RUDRA VAGHELA |
| 4 | Adaptive Engine | `adaptive.py` — BKT/IRT ability estimation, difficulty selection | Done | RUDRA VAGHELA |
| 5 | AI Interview Engine | `routes/interview.py` — legacy Q&A (kept), LLM with Groq/Gemini fallback | Done | RUDRA VAGHELA |
| 6 | Answer Capture | `routes/answers.py` — text/code capture, latency recording | Done | RUDRA VAGHELA |
| 7 | Answer Verification | `verification.py` — test cases, keyword, LLM-RAG, puzzle, trick, resume-consistency | Done | RUDRA VAGHELA |
| 8 | Fluency & Delivery | `fluency.py` — filler words, pause detection, grammar, mistake classification | Done | RUDRA VAGHELA |
| 9 | Anti-Cheat | `routes/integrity.py` — face/tab/copy-paste/code-similarity events | Done | RUDRA VAGHELA |
| 10 | Session Management | `routes/sessions.py` — start, end, list, active, ability-profile | Done | RUDRA VAGHELA |
| 11 | Report Generation | `routes/reports.py` — compile, fetch, list reports | Done | RUDRA VAGHELA |
| 12 | User Feedback | `routes/feedback.py` — submit rating/comments, history | Done | RUDRA VAGHELA |

---

## MongoDB Collections (all live)

- `users` — accounts + embedded resume
- `questions` — curated question bank with reference data
- `sessions` — practice/assessment sessions with ability profiles
- `answers` — per-question answers with correctness, fluency, mistake tags
- `integrity_logs` — anti-cheat event logs
- `reports` — compiled session reports
- `feedback` — user satisfaction ratings

---

## API Endpoints Summary

### Auth
| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Register |
| POST | /auth/login | Login |
| GET | /auth/me | Get profile |
| PUT | /auth/profile | Update name |
| POST | /auth/change-password | Change password |
| POST | /auth/logout | Logout |
| GET | /auth/check-db | Health check |

### Resume
| Method | Path | Description |
|---|---|---|
| POST | /resume/upload | Upload & parse PDF/DOCX |
| GET | /resume/latest | Get latest resume |
| GET | /resume/summary | Get resume summary |

### Questions
| Method | Path | Description |
|---|---|---|
| POST | /questions/ | Create question |
| GET | /questions/ | List questions |
| GET | /questions/calibration | Get calibration questions |
| GET | /questions/next | Get next adaptive question |
| GET | /questions/{id}/reference | Get question reference |

### Sessions
| Method | Path | Description |
|---|---|---|
| POST | /sessions/start | Start new session |
| POST | /sessions/{id}/end | End session |
| GET | /sessions/ | List sessions |
| GET | /sessions/active | Get active session |
| GET | /sessions/ability-profile | Get ability profile |

### Answers
| Method | Path | Description |
|---|---|---|
| POST | /answers/capture-text | Capture + verify text answer |
| POST | /answers/capture-code | Capture + verify code answer |
| POST | /answers/record-latency | Record response latency |
| GET | /answers/session/{id} | Get session answers |

### Reports
| Method | Path | Description |
|---|---|---|
| POST | /reports/compile/{id} | Compile session report |
| GET | /reports/{id} | Get report |
| GET | /reports/ | List reports |

### Feedback
| Method | Path | Description |
|---|---|---|
| POST | /feedback/ | Submit feedback |
| GET | /feedback/ | Get feedback history |

### Integrity
| Method | Path | Description |
|---|---|---|
| POST | /integrity/event | Log generic anti-cheat event |
| POST | /integrity/face-event | Log no_face / multi_face / face_left_frame |
| POST | /integrity/tab-switch | Log tab switch |
| POST | /integrity/fullscreen-exit | Log fullscreen exit |
| POST | /integrity/copy-paste | Log copy/paste with pasted length |
| POST | /integrity/latency-anomaly | Flag + log latency anomaly vs baseline |
| GET | /integrity/summary/{id} | Get aggregated integrity summary |
| POST | /integrity/check-code-similarity | Check code similarity vs known solutions |

### Legacy Interview (existing UI)
| Method | Path | Description |
|---|---|---|
| POST | /interview/start | Start AI interview |
| POST | /interview/answer | Answer question |
| GET | /interview/sessions | List sessions |
| GET | /interview/{id}/feedback | Get feedback |



## MEMBER 2: DIVYATA

---

## Phase 1: Initial Project Scaffold (main branch, commit `5b8e54b`) ✓ COMPLETED

Full-stack base of the InterviewSpar AI interview platform (backend + frontend skeleton).

| # | Module | Files | Status | Owner |
|---|---|---|---|---|
| 1 | Backend Core & Auth | `backend/main.py`, `app/database.py`, `app/models.py`, `app/auth.py`, `app/routes/auth.py`, `app/schemas.py`, `.env.example`, `migrations/001_create_users.sql` — SQLAlchemy + PostgreSQL foundation, signup/login | Done | DIVYATA |
| 2 | Resume & Interview Routes | `app/routes/resume.py`, `app/routes/interview.py` — initial resume upload + Q&A flow | Done | DIVYATA |
| 3 | Frontend Scaffold | `frontend/` — Vite + React + Tailwind app, `App.jsx`, `main.jsx`, `index.css`, `vite.config.js`, `api/auth.js`, routing | Done | DIVYATA |
| 4 | Landing & Auth Pages | `components/Navbar.jsx`, `Hero.jsx`, `Features.jsx`, `TrustedCompanies.jsx`, `DashboardNavbar.jsx`, `DashboardHero.jsx`, `ProtectedRoute.jsx`, `pages/Login.jsx`, `Signup.jsx`, `AccountManagement.jsx` | Done | DIVYATA |
| 5 | Interview Flow Pages | `pages/Interview.jsx`, `InterviewType.jsx`, `InterviewComplete.jsx` | Done | DIVYATA |

---

## Phase 2: Code-Runner, Similarity & Voice Panel; Model Restoration; Combined Person Presence (b2 branch, commit `17254da`) ✓ COMPLETED

| # | Module | Files | Status | Owner |
|---|---|---|---|---|
| 1 | Code Runner | `backend/app/services/code_runner.py`, `backend/app/routes/code.py` — execute submitted code | Done | DIVYATA |
| 2 | Code Similarity & Anti-Cheat | `backend/app/services/similarity.py`, `backend/app/services/anticheat.py`, `backend/app/routes/integrity.py` — code-similarity check vs known solutions, anti-cheat events | Done | DIVYATA |
| 3 | Voice & Video Panel Backend | `backend/app/routes/interview.py`, `backend/app/routes/video.py`, `backend/app/schemas.py`, `backend/main.py` — LLM voice interview + video routes | Done | DIVYATA |
| 4 | Human Model Restoration | `frontend/public/models/` — facemesh, handlandmark-lite, handtrack, iris, movenet-lightning recovered from UTF-16 corruption | Done | DIVYATA |
| 5 | Combined Face+Body Person Presence | `frontend/src/components/FaceDetection.jsx`, `frontend/src/lib/faceLogic.js` — face/body OR-gate person presence, head-pose attention | Done | DIVYATA |
| 6 | Code / Voice / Speech UI | `frontend/src/components/CodePanel.jsx`, `frontend/src/components/VoicePanel.jsx`, `frontend/src/hooks/useSpeech.js`, `frontend/src/api/auth.js` — panels + speech hook + auth client | Done | DIVYATA |
| 7 | Integrity Monitor UI | `frontend/src/components/IntegrityMonitor.jsx` — consent bar, tab-switch / fullscreen-exit logging | Done | DIVYATA |
| 8 | Interview Page Integration | `frontend/src/pages/Interview.jsx`, `frontend/src/components/InterviewAnalytics.jsx` — detection + panels wiring | Done | DIVYATA |

---

## Phase 3: Multi-Person Detection & Static Guard (b2 branch, commit `77f877e`) ✓ COMPLETED

| # | Module | Files | Status | Owner |
|---|---|---|---|---|
| 1 | Multi-Person Detector | `frontend/src/lib/personDetector.js`, `frontend/src/workers/personDetector.worker.js` — coco-ssd Web Worker (CPU), 320px frames @1250ms, track matching, hand-intrusion detection, raw-debug logging | Done | DIVYATA |
| 2 | Cocos-ssd Models | `frontend/public/models/coco-ssd/` — vendored model files (~18.5 MB) | Done | DIVYATA |
| 3 | Cumulative Static Guard | `personDetector.js` — 10-tick window, cumulative static threshold 0.02, `isTrackStatic`, static guard on by default | Done | DIVYATA |
| 4 | Debounced Absent/Present Frames | `frontend/src/lib/faceLogic.js` — `PERSON_ABSENT_FRAMES=6` / `PERSON_PRESENT_FRAMES=30` | Done | DIVYATA |
| 5 | Shared Multi-Person Resolve | `faceLogic.js` — exported `resolveMultiPersonCount` used in all 3 detection tiers | Done | DIVYATA |
| 6 | Badge Taxonomy | `FaceDetection.jsx` — Candidate not visible (red), Face not visible (amber), Candidate in frame (green), Additional person detected (red), Unidentified hand in frame (red) | Done | DIVYATA |
| 7 | Collapsible Analytics Panel | `InterviewAnalytics.jsx` — compact strip + tiered drawer | Done | DIVYATA |
| 8 | TFJS CPU Backend | `frontend/package.json` — added `@tensorflow/tfjs-backend-cpu` | Done | DIVYATA |

---

## Phase 4: UI/UX Polish — Layout, Fullscreen, Badge Overlap (b2 branch, commit `bff1ce9`) ✓ COMPLETED

| # | Module | Files | Status | Owner |
|---|---|---|---|---|
| 1 | Camera-Dominant Pane Split | `frontend/src/pages/Interview.jsx` — interviewer pane 35% / camera ~65% (`md:w-[35%]`), responsive mobile stacking preserved | Done | DIVYATA |
| 2 | Fullscreen on Interview Start | `frontend/src/components/IntegrityMonitor.jsx` — enter fullscreen on consent click, graceful rejection, "Go/Exit fullscreen" toggle | Done | DIVYATA |
| 3 | Top-Left Badge Overlap Fix | `pages/Interview.jsx`, `FaceDetection.jsx` — merged LIVE + multi-face into one wrapping row; badges moved below (`top-9`) | Done | DIVYATA |

---

## MEMBER 3: SHREYA