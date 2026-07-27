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
| POST | /integrity/event | Log anti-cheat event |
| GET | /integrity/summary/{id} | Get integrity summary |
| POST | /integrity/check-code-similarity | Check code similarity |

### Legacy Interview (existing UI)
| Method | Path | Description |
|---|---|---|
| POST | /interview/start | Start AI interview |
| POST | /interview/answer | Answer question |
| GET | /interview/sessions | List sessions |
| GET | /interview/{id}/feedback | Get feedback |



## MEMBER 2: DIVYATA



## MEMBER 3: SHREYA