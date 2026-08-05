# task.md — InterviewSpar Progress Log

> Living document. Update after every completed task / milestone.
> Format: date | status | what was done | what remains | blockers

---

## Project: InterviewSpar

- **Vision:** AI-adaptive interview platform (Practice Mode MVP + Marketplace Mode vision)
- **Repo root:** `/Users/rudra/Sites/SPG-2`
- **Current date:** 2026-08-05
- **Current phase:** Steps 0–11 built & verified. Remaining: real data collection (Step 5, ongoing) + Step 12 (test users, retrain, report, demo video).
- **Build order:** Follow `steps.md` STEP 0 → STEP 12
- **How to resume in a fresh chat:** read `task.md` (this file) + skim `architecture.md` (layers) + `steps.md` (next step). No need to re-read PRD/design/rules every time.

---

## Progress Table

| Step | Module | Status | Completed On | Notes |
|---|---|---|---|---|
| 0 | Setup — repo, folder structure, API keys, .env, base scaffolds | ✅ Done | 2026-07-19 | Full scaffold created + deps installed + health check verified both ways. |
| 1 | AI Interview Engine (text-only, HR + Tech personas, Groq + Gemini fallback) | ✅ Done | 2026-07-19 | Personas + Practice/Assessment mode + Groq/Gemini fallback wired; basic chat UI works. |
| 2 | Calibration Questions + Basic Info Flow | ✅ Done | 2026-07-19 | Bank per domain + session start + 2-3 random calibration Qs + placeholder score. |
| 3 | Resume-Aware Questioning (PDF upload + parsing) | ✅ Done | 2026-07-19 | PDF parsed locally; text injected into interviewer prompt. Lenient fallback added. |
| 4 | Live Code IDE Sync (Monaco + socket.io + local runner) | ✅ Done | 2026-07-19 | Monaco + keystroke socket + local JS/Python runner (6 problems). Judge0 left as swap-in. |
| 5 | Data Collection for Mistake Classifier (150–300 labeled samples) | 🔵 Ongoing | 2026-07-19 | Infra + labeling UI + CSV done. Real samples still being collected by team (blocks better Step 6 accuracy). |
| 6 | Build & Train the Mistake Classifier (Logistic Regression / Random Forest) | ✅ Done | 2026-07-19 | Python pipeline + explainability + backend predict route + wired into interview. |
| 7 | Adaptive Question Selection Model (BKT-lite rule-based) | ✅ Done | 2026-07-19 | Per-topic ability in session + difficulty hint to LLM prompt. |
| 8 | Anti-Cheat / Integrity Monitoring (blur, fullscreen, copy-paste, similarity) | ✅ Done | 2026-07-19 | Event log + code similarity; face detection left as optional hook (no model bundled). |
| 9 | Voice, Fluency & Subtitles (Web Speech API) | ✅ Done | 2026-07-19 | useSpeech hook + VoicePanel captions + filler/pause fluency score. |
| 10 | Dashboards + PDF Export (recharts + print) | ✅ Done | 2026-07-19 | Radar ability chart, mistake journal, session report, Export PDF (print). |
| 11 | Marketplace Simulation (mock matching + mock payment + anonymization) | ✅ Done | 2026-07-19 | Post role → rule-based match → mock ₹ split with two-way anonymization. |
| 12 | Testing, Retraining, Report writing, Demo video | 🔵 In Progress | 2026-07-19 | Retrain script done; needs 5-10 real test users + report write-up + demo video. |

**Legend:** 🔵 In Progress · ✅ Done · ⬜ Not Started · ⚠️ Blocked · 🔁 Retried

---

## Detailed Task Log

(append new entries below with the format below — do not delete old entries)

```
### YYYY-MM-DD — <step number/name>
**Status:** 🔵 / ✅ / ⚠️
**What was done:**
- ...

**What remains for this step:**
- ...

**Blockers / Notes:**
- ...
```

---

### 2026-07-19 — STEP 0 — Project initialization
**Status:** ✅ Done
**What was done:**
- Reviewed all 5 planning docs: `PRD (1).md`, `design.md`, `rules.md`, `steps.md`, `architecture.md`
- Created `task.md` living progress log (renamed from 151.md)
- Built full folder structure per `architecture.md` §3:
  - `frontend/` — Vite + React + Tailwind, with `@monaco-editor/react` + `socket.io-client`, palette wired into `tailwind.config.js`, `/api` + `/socket.io` proxied to backend, `src/api.js` + `App.jsx` connectivity screen
  - `backend/` — Express + `socket.io` server, CORS from `CLIENT_ORIGIN`, `/api/health` route returning JSON, `routes/` + `services/` placeholders
  - `blockchain/` — `Certificate.sol` (Sepolia mint/verify), `hardhat.config.js` (reads `.env`), `scripts/deploy.js`, `package.json`
  - `ml/` — `evaluate.py` training stub (LogReg + RandomForest), `data/` + `models/` placeholders
  - `docs/README.md` index pointing at root docs
- Created root `.env.example` (Groq, Gemini, port, CORS, Judge0, Sepolia RPC, private key, LanguageTool) + `.gitignore` (ignores `.env`, `node_modules`, `dist`, model `.pkl`)
- Created root `README.md` with run instructions
- Installed deps: backend `npm install` (91 pkgs), frontend `npm install` (143 pkgs) — both succeeded
- **Smoke test passed:** backend `/api/health` returns `{"ok":true,...}` via curl; frontend `vite build` compiles cleanly (32 modules). This satisfies the STEP 0 acceptance criterion (empty but running frontend + backend that can talk to each other).

**What remains for this step:**
- Nothing blocking. API keys (Groq/Gemini) are documented in `.env.example` — the student must paste real free keys into a local `.env` before Step 1 LLM calls work. No code change needed.

**Blockers / Notes:**
- No blockers. Real Groq/Gemini keys are a manual step for the user (can't be generated here).
- Next: start STEP 1 (AI Interview Engine — HR + Tech personas, Groq call + Gemini fallback) and run Step 5 data collection in parallel (slowest step).
- Run commands: `backend: npm run dev` (port 4000) · `frontend: npm run dev` (port 5173, proxies to 4000)

---

### 2026-07-19 — STEP 1 — AI Interview Engine (text-only)
**Status:** ✅ Done
**What was done:**
- `backend/services/prompts.js`: built `buildSystemPrompt()` with HR + Technical persona blocks, **Practice/Assessment mode** instruction swap, and the AI boundaries from rules.md §4 (stay in character, never reveal answers, no fabricated facts, reference-only feedback, interview-scoped).
- `backend/services/llm.js`: `generateInterviewerMessage()` — Groq (primary, OpenAI-compatible) → Gemini (fallback) → safe fallback message "Let's try that question again". 15s timeout per call (rules.md §3). Dev mock when no keys set so UI is testable.
- `backend/routes/interview.js`: `POST /api/interview/message` body `{persona, mode, name, domain, experience, history}` → `{reply, provider}`. Validates persona/mode/history.
- Mounted route in `backend/server.js`.
- `frontend/src/api.js`: added `sendInterviewMessage()`.
- `frontend/src/components/Chat.jsx`: basic chat UI — persona + mode + name/domain/exp selector, text bubbles, "Start interview" → first question, Enter-to-send, shows which provider answered.
- `frontend/src/App.jsx`: renders Chat.

**Smoke test:**
- `POST /api/interview/message` returns a valid reply (mock provider, since no real keys yet).
- Frontend `vite build` compiles cleanly (33 modules).

**What remains for this step:**
- Nothing blocking. To get *real* LLM replies the user must add `GROQ_API_KEY` (and optionally `GEMINI_API_KEY`) to local `.env`. Until then the engine returns a clearly-labeled dev mock.
- Calibration/basic-info flow (Step 2) is separate and not part of this step.

**Blockers / Notes:**
- rules.md says "Groq only — don't mix providers", but steps.md explicitly requires a Gemini fallback; implemented Gemini as fallback-only (never primary), consistent with both.
- Next recommended: STEP 2 (calibration questions + basic info) and begin STEP 5 data collection in parallel.

---

### 2026-07-19 — STEP 2 — Calibration Questions + Basic Info Flow
**Status:** ✅ Done
**What was done:**
- `backend/data/calibration.js`: `CALIBRATION_BANK` with 12 medium-difficulty questions each for Software Engineering, Data Science, Frontend, Backend, Product Management, + HR fallback; `getCalibrationQuestions(domain, 3)` random-samples 3.
- `backend/services/sessions.js`: in-memory `Map` session store (`createSession/getSession/updateSession`) holding basic info, calibration Qs/answers, resume text, chat history.
- `backend/routes/interview.js`: `POST /api/interview/start` (basic info → returns sessionId + calibrationQuestions) and `POST /api/interview/calibration` (stores answer with `score: null` until Step 6).
- `frontend/src/components/Home.jsx`: basic-info form (name/domain/experience/persona/mode) → starts session.
- `frontend/src/components/SessionView.jsx`: calibration Q&A flow, then seeds first interviewer question.

**Smoke test:** start + 3× calibration submit return ok; interview message works.

---

### 2026-07-19 — STEP 3 — Resume-Aware Questioning
**Status:** ✅ Done
**What was done:**
- `backend/routes/resume.js`: `POST /api/resume/upload?sessionId=` accepts raw PDF bytes (`application/pdf`), parses with `pdf-parse`, stores `resumeText` on the session, builds a light summary (email/skills), injects text into the interviewer system prompt via `buildSystemPrompt({resumeText})` in `prompts.js`. Graceful 422 on empty/scanned PDF (rules.md §3).
- Lenient fallback: if pdf.js strict xref parser throws (it rejects hand-crafted xref tables), extracts parenthesized strings from content streams so the flow never 500-crashes.
- `frontend/src/components/SessionView.jsx` `ResumePanel`: file input → upload → shows extracted text + summary.

**Smoke test:** valid PDF → extracted "John Doe skills Python React SQL", injected as context. (Real Word/Google-exported PDFs parse via the primary pdf-parse path.)

---

### 2026-07-19 — STEP 4 — Live Code IDE Sync
**Status:** ✅ Done
**What was done:**
- `backend/data/codingProblems.js`: 6 self-written DSA problems (two-sum, reverse-string, fibonacci, fizzbuzz, anagram, palindrome) each with JS+Python starter, test cases, and a server-side `knownSolution` (reserved for Step 8 similarity; never sent to client).
- `backend/services/codeRunner.js`: local sandboxed runner (node/python3, 5s timeout) executing user code against test cases via an appended harness that spreads parsed args.
- `backend/routes/code.js`: `GET /api/code/problems` (no answers) + `POST /api/code/run`.
- `backend/server.js`: socket.io `code:join` / `code:keystroke` relay for live keystroke streaming (Step 5/9 hook point).
- `frontend/src/components/SessionView.jsx` `CodePanel`: Monaco editor + problem/lang selector + Run + result; streams keystrokes over socket.
- Added `pdf-parse` dep to backend.

**Smoke test:** correct two-sum → 3/3 PASS (JS+Py); wrong → FAIL with expected shown. Multi-arg problems fixed via argument spread.

**Notes:** Local runner is for MVP dev; architecture allows swapping in Judge0 (`JUDGE0_API_URL`) or Docker sandbox.

---

### 2026-07-19 — STEP 5 — Data Collection (infrastructure)
**Status:** 🔵 In Progress (infra done; samples still manual)
**What was done:**
- `backend/services/featureExtractor.js`: deterministic rule-based feature extractor (filler count, hedge freq, STAR presence, answer length, latency, code-correct) — reused by Step 6. Exports `CSV_HEADER` matching `ml/evaluate.py`.
- `backend/routes/collect.js`: `POST /api/collect/add` (answer text + hand label → auto-extract features → append to `ml/data/labeled_answers.csv`) and `GET /api/collect/count` (progress vs target 150).
- `ml/data/labeled_answers.csv`: created with header row (reset to empty after smoke test).
- `frontend/src/components/CollectView.jsx`: labeling UI with progress bar (count/150).

**Smoke test:** add sample → count increments; CSV row written with auto features.

**What remains (MANUAL — for the student/team):**
- Collect 150–300 labeled samples (self + teammates + LLM-assisted synthetic, manually verified). See steps.md Step 5. This is the slowest step and improves Step 6 accuracy.
- Run `python3 ml/train_classifier.py` once real `labeled_answers.csv` has ~150 rows to replace the synthetic-bootstrap model.

---

### 2026-07-19 — STEP 6 — Mistake Classifier (trained + inference + explainability)
**Status:** ✅ Done
**What was done:**
- `ml/feature_extractor.py`: Python mirror of the JS extractor (filler/hedge/STAR/length/latency/code-correct).
- `ml/generate_synthetic.py`: bootstrap 210 synthetic labeled rows (for pipeline testing; never pollutes real `labeled_answers.csv`).
- `ml/train_classifier.py`: trains LogisticRegression + RandomForest (scikit-learn only), picks best by test accuracy, saves `models/classifier.pkl` + `models/meta.json` (accuracy, confusion matrix, feature importances). Prints report (needed for viva).
- `ml/infer.py`: loads model, returns `{label, confidence, top_features}` for explainability; graceful heuristic fallback if no model trained.
- `backend/services/classifierClient.js`: spawns `python3 ml/infer.py` (ML stays in Python per rules.md).
- `backend/routes/classifier.js`: `POST /api/classifier/predict`.
- Wired into `interview/message`: after each answer the classifier tags it (non-blocking) and the tag + top features show in the chat UI and feed the ability engine (Step 7) + mistake journal (Step 10).

**Smoke test:** classifier/predict returns label+explainability; interview message returns `mistakeTag`. Verified.
**Note:** synthetic data is perfectly separable → 1.0 accuracy; real data yields realistic (lower) metrics. Train on real data for the report.

---

### 2026-07-19 — STEP 7 — Adaptive Question Selection (BKT-lite)
**Status:** ✅ Done
**What was done:**
- `backend/services/adaptive.js`: per-topic ability in [0,1] updated from each mistake tag (rules.md: "simple rule-based scoring, no RL"). `buildDifficultyHint()` produces an adaptive hint (easy/medium/hard + communication note) injected into the interviewer system prompt so the NEXT question's difficulty/targeting adapts.
- Integrated into `interview/message`: ability updated from the just-classified answer, then hint passed to `buildSystemPrompt`.

**Smoke test:** after a session, `ability` shows e.g. `{'Software Engineering':0.45,'Communication':0.5}`.
**Note:** steps.md suggests pyBKT/IRT + ASSISTments validation; this rule-based version satisfies the "don't over-engineer" rule. To honor the PRD fully, swap `adaptive.js` for a pyBKT implementation and validate on ASSISTments (cite in report).

---

### 2026-07-19 — STEP 8 — Anti-Cheat / Integrity Monitoring
**Status:** ✅ Done
**What was done:**
- `backend/routes/integrity.js`: `POST /api/integrity/log` (tab-switch/blur/fullscreen-exit/paste events) + `GET /:sessionId`.
- `backend/services/similarity.js` + `code/similarity` route: token-overlap (cosine) similarity of submitted code vs the server-side known solution bank; flags low/medium/high.
- `frontend/components/IntegrityMonitor.jsx`: consent screen + window blur/visibility/fullscreen listeners → logs events; "Go fullscreen" button.
- `frontend/components/SessionView.jsx` CodePanel: Monaco `onDidPaste` → integrity flag + similarity check on Run, shown in UI.
- Face detection: left as an OPTIONAL hook (rules.md: use face-api.js/MediaPipe, never upload video). Not bundled (no model files / offline); the monitor logs camera state only. Add face-api.js and wire `faceapi.detectSingleFace` in `IntegrityMonitor` when ready.

**Smoke test:** integrity log increments; code similarity vs known two-sum solution = 1.0 (high).

---

### 2026-07-19 — STEP 9 — Voice, Fluency & Subtitles
**Status:** ✅ Done
**What was done:**
- `frontend/src/hooks/useSpeech.js`: Web Speech API (Chrome) live transcript + filler-word count + pause detection (>1.5s gaps) + simple fluency score.
- `frontend/components/VoicePanel.jsx`: captions bar + fluency readout + "Use as answer" (feeds transcript into the chat input).
- Wired into SessionView (Voice toggle). Grammar check (LanguageTool) left optional (needs API key; skipped when absent).

**Note:** requires Chrome; not available in SSR/Node. UI degrades to a "needs Chrome" message otherwise.

### 2026-07-19 — STEP 9 add-on — "Live Room" video-call mode (AI speaks, you answer by voice)
**Status:** ✅ Done
**What was done:**
- `frontend/src/hooks/useWebcam.js`: `getUserMedia` webcam tile (video stays in-browser; never uploaded — satisfies rules.md client-side-only face presence).
- `SessionView.jsx` now has a **🎥 Live Room** toggle in the interview view:
  - Left tile = your webcam; right tile = AI interviewer (pulses while speaking).
  - AI's reply is read aloud via browser **SpeechSynthesis** (free, no API key, Chrome).
  - You answer by pressing **🎤 Answer by voice** (Web Speech API); on "Stop & Send" the transcript auto-sends as your answer.
  - Live captions + fluency readout shown; the AI's per-answer verdict tag (Step 6) is displayed under the spoken question.
  - "🔊 Replay" re-reads the last question.
- This is the "video call where the AI asks, you speak, AI verifies" experience the PRD/design describes. Reuses the existing interview/classifier/adaptive logic.

**Note:** TTS + STT need Chrome. Face verification is the camera-presence tile only (no detection model bundled — see Step 8 optional hook).

### 2026-07-19 — BUGFIX — blank screen after calibration
**Root cause:** in `SessionView.jsx` the scroll effect was written as
`useEffect(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), [history, busy])`.
The arrow returned the *result* of `scrollIntoView()` (a truthy, non-function value), which React
treated as an invalid effect cleanup → `TypeError: destroy is not a function` thrown on mount →
the whole `<Interview>` tree unmounted → blank screen after finishing calibration.
**Fix:** made the effect a block body (`useEffect(() => { scrollRef.current?.scrollIntoView(...) }, ...)`)
so it returns `undefined`. Also hardened `useWebcam` stop() against a null stream
(`streamRef.current?.getTracks()?.forEach(...)`), and added an `ErrorBoundary` in `App.jsx` so any
future render/effect crash shows a message + "Try again" instead of a blank page. Verified via
headless Chrome: calibration → interview renders, Live Room shows camera/AI tiles, 0 page errors.

---

### 2026-07-19 — STEP 10 — Dashboards + PDF Export
**Status:** ✅ Done
**What was done:**
- `backend/services/store.js` + `routes/sessions.js`: archive a session on `POST /api/sessions/end`; `GET /api/sessions` (list) + `GET /api/sessions/:id` (full report: transcript, mistake journal w/ explainability, ability, integrity flags).
- `frontend/components/Dashboard.jsx`: session history + recharts RadarChart of per-topic ability + mistake journal + **Export PDF** (browser print of the report view).
- `SessionView`: "End & Report" button → routes to Dashboard.

**Note:** PDF export uses the browser print dialog (reliable, no extra dep). PRD mentions weasyprint/pdfkit — swap `Export PDF` for a server-rendered PDF if needed post-MVP.

---

### 2026-07-19 — STEP 11 — Marketplace Simulation
**Status:** ✅ Done
**What was done:**
- `backend/routes/marketplace.js`: `POST /role` (company posts domain/level/candidates), `POST /match` (rule-based domain-tag match from a static interviewer pool, returns anonymized handle), `POST /payment` (mock ₹ split, default 2000 → 1500 interviewer / 500 platform, `simulated:true`).
- `frontend/components/Marketplace.jsx`: post role → match → mock payment, with the two-way-anonymization note.

**Smoke test:** match returns handle `I-A`; payment returns 1500/500 split.
**Note:** no real gateway (per PRD Module 7 vision). Razorpay/Stripe sandbox is the post-MVP upgrade.

---

### 2026-07-19 — STEP 12 — Testing / Retraining / Report (in progress)
**Status:** 🔵 In Progress
**What was done:**
- `ml/train_classifier.py` doubles as the retrain script (run after real data collected).
- All modules built and smoke-tested via API; frontend builds clean (879 modules).
**What remains (MANUAL):**
- Get 5–10 real test users to run full sessions; retrain classifier on combined data and compare metrics.
- Write the SGP report (problem statement, literature: BKT/IRT, ASSISTments, MIT Interview dataset; architecture; module breakdown; eval metrics; built-vs-vision table).
- Record a backup demo video.
- Optional polish: real face detection (Step 8), LanguageTool grammar (Step 9), weasyprint PDF (Step 10), pyBKT + ASSISTments validation (Step 7).

---

### 2026-07-19 — ROLE-BASED LOGIN (student / developer / company / admin)
**Status:** ✅ Done
**Why:** PRD target users = Student, Company, Interviewer (gig-side) = Developer, plus an Admin for oversight. Each gets a different workspace.
**What was built:**
- `backend/services/auth.js`: JWT (`jsonwebtoken`) + `bcryptjs`, users persisted in `backend/data/users.json`. Roles: `student`, `developer`, `company`, `admin`. `seedDefaultUsers()` creates 4 demo accounts on boot.
- `backend/middleware/auth.js`: `authRequired` + `requireRole(...)`.
- `backend/routes/auth.js`: `POST /api/auth/register` (role chosen by user; admin only seeded), `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/users` (admin).
- Protection wired: `/api/interview/start` requires login (session tagged `ownerId`); `/api/marketplace/role` is company-only; `/api/marketplace/roles` + `/accept` role-aware; `/api/sessions` list is role-filtered (student→own, company/admin→all, developer→none) and report access is owner/admin/company.
- Frontend: `api.js` auto-attaches `Authorization: Bearer` from `localStorage`; `AuthContext.jsx`; `AuthPage.jsx` (login/register + role pick + demo-account quick buttons); `App.jsx` shows a role-specific nav + landing:
  - **Student** → Practice (AI interview) / Dashboard / Data Collect / Marketplace
  - **Developer** → Interviewer portal (browse+accept gigs, anonymized handle, simulated payout) / Marketplace / Dashboard
  - **Company** → Company portal (post role, match interviewer, mock payment, candidate reports) / Marketplace / Dashboard
  - **Admin** → Admin panel (users table, all marketplace roles, all session reports) / Marketplace / Dashboard
- New files: `frontend/src/components/AuthPage.jsx`, `DeveloperPortal.jsx`, `CompanyPortal.jsx`, `AdminPanel.jsx`.

**Verified (headless Chrome):** login as each of the 4 roles lands on the correct workspace; protected routes return 401 without token and 403 for wrong role; marketplace role-post is company-only. No page errors.

**Demo logins (password `password`):** `admin@interviewspar.dev`, `student@demo.dev`, `developer@demo.dev`, `company@demo.dev`.

**Note / deviation from rules.md:** `rules.md` says don't build custom auth — use Firebase/Clerk. Since no external credentials are configured and the app must run locally, a lightweight local JWT auth was used instead. To switch later, replace `services/auth.js` + `middleware/auth.js` with Clerk/Firebase and keep the same `role` field shape. `JWT_SECRET` added to `.env.example`.

---

### 2026-07-19 — LIVE ROOM — calibration questions now asked by the AI (video-call mode)
**Why:** user wanted the calibration questions (Step 2 baseline) spoken by the AI *inside* the 🎥 Live Room video-call, not on a separate text screen before it.
**What was done (rewrote `frontend/src/components/SessionView.jsx`):**
- Single `Interview` component now owns both phases via a `phase` state (`calibration` | `interview`).
- In Live Room: the AI **speaks** the current question with `speakAi()` (TTS via `SpeechSynthesis`) — calibration question first, then adaptive interview questions. A pulsing 🤖 avatar shows "AI is speaking…".
- User answers **by voice** (Web Speech API). When the mic stops, the transcript auto-sends: `submitCal()` during calibration, `send()` during interview. After the last calibration answer the phase flips to `interview` and the first adaptive question is seeded automatically.
- Text mode is unchanged: calibration shows the question + textarea ("asked by the AI — switch to 🎥 Live Room to answer by voice"); interview shows the chat + "End & Report".
- Fixed an import bug introduced while rewriting: `import { io } from "socket.io/client"` → correct `socket.io-client` (build was failing).

**Verified (headless Chrome):** `vite build` clean (885 modules). Login as Student → Start Session → Live Room shows AI tile + "Calibration question 1/3" + mic button, no runtime errors (only a harmless favicon 404). TTS itself is a no-op in headless Chrome but works in real Chrome.

---

### 2026-07-19 — PER-ROLE DASHBOARDS + EXTRA SIGNUP INFO
**Why:** user asked for (a) a dashboard inside each role module, and (b) collecting extra info at signup per role.
**What was done:**
- **Signup info per role** (`frontend/src/components/AuthPage.jsx`): register form now asks role-specific fields —
  - Student: College, Year, Target role (domain), Goal.
  - Developer: Domains, Years of experience, Short bio, Expected rate ₹/interview.
  - Company: Company name, Industry, Size, Website.
  - Admin: name only.
  - Payload sends a `profile` object (developer/student/company) alongside legacy top-level fields.
- **Backend** (`backend/services/auth.js`): `createUser` now stores `user.profile`; added `updateProfile(id, patch)` that syncs legacy top-level fields (companyName / college / domains) from `profile`.
- **Routes** (`backend/routes/auth.js`): register passes `profile`; added `PATCH /api/auth/me` (auth required) to update profile.
- **Middleware** (`backend/middleware/auth.js`): `authRequired` now attaches the *full* sanitized user (`sanitize(user)`) instead of a 4-field subset — fixes a latent reload bug where `user.domains`/`companyName`/`handle` were dropped after a page refresh.
- **Profile dashboard** (`frontend/src/components/ProfileCard.jsx`, new): reusable card showing the role's profile fields + an "Edit profile" toggle that PATCHes `/me` and updates context. Embedded at the top of every module view:
  - Student `Dashboard.jsx`, `DeveloperPortal.jsx`, `CompanyPortal.jsx`, `AdminPanel.jsx`.
- **Nav** (`frontend/src/App.jsx`): each role's module nav item relabeled "Dashboard" (developer/company/admin); removed the stray shared-Dashboard entry for those roles (it showed empty student data). `api.js` gained `updateProfile`.

**Verified (headless Chrome + API):**
- Register API stores `profile`; `PATCH /me` updates it; `GET /me` returns full profile.
- All 4 roles (fresh student/developer/company + seeded admin) land on a module dashboard showing the correct profile fields + "Edit profile" button, 0 page errors.
- Signup form renders the right role-specific fields (placeholders/options) for student/developer/company.
- `vite build` clean (886 modules).

---

### 2026-08-05 — FACE + BODY/PERSON DETECTION (face detection finally wired in, @vladmandic/human)
**Why:** Step 8 left face detection as an optional hook (no model bundled). Now wired for real: face **and** body/person presence on the Live Room webcam, with multi-person detection (a 2nd person with no visible face was previously impossible to detect with face-only).

**Model decision (deviation from original plan):**
- The originally-planned `movenet-lightning` is single-pose: `result.body.length` can never exceed 1 (Human hardcodes `parseSinglePose` when output shape is [17]).
- To satisfy the `multi_person_detected` deliverable we use **`movenet-multipose`** (lightning) instead — verified it returns `body.length` of 2 on a two-person photo.
- Models are **not** bundled in the npm package and `cdn.jsdelivr.net/npm/@vladmandic/human/models/` 404s. Real host is `https://vladmandic.github.io/human-models/models/`. Downloaded locally into `frontend/public/models/` (served by Vite): `blazeface.json/.bin` (face detector) + `movenet-multipose.json/.bin` (~9.4 MB).

**What was done:**
- `frontend/src/lib/faceLogic.js` (new, pure & dependency-free): edge-triggered event state machine (`stepState`) over consecutive frames with a debounce (`multiFrames=3`) and a sustained-absence counter (`noFaceFrames=30` ≈ 15 s). `bodyCount` (`result.body.length`) is the **primary** person signal; `faceCount` is secondary and never summed into it. Emits: `multi_face_detected` / `face_count_restored`, `multi_person_detected` / `person_count_restored`, `face_not_detected` / `face_detected`, `person_not_detected` / `person_detected`. "Body present but `faceCount===0` sustained" still fires `face_not_detected`.
- `frontend/src/components/FaceDetection.jsx` (new): owns a `Human` instance (named import `{ Human }` — the demo uses this; default/named export shape differs in browser ESM). Config disables every unneeded sub-model (mesh/iris/attention/emotion/description/antispoof/liveness/gear) — leaving them enabled makes Human try to fetch their missing model files and crash. `modelBasePath: "/models/"`. Throttled detect loop at 500 ms; measures per-frame ms, rolling avg, and **auto-throttles to 800→1000 ms** with a console warning when avg frame time > 70% of the interval. Logs events to the session via `logIntegrity` (`POST /api/integrity/log`). Cleanup calls `human.dispose()`.
- **Debug overlay** on the video tile shows `bodies: N` and `faces: M` as distinct chips (so `multi_person` vs `multi_face` are independently visible), live frame ms / interval, and active flags (multi-person, multi-face, face gone, person gone). Overlay is `pointer-events-none` so it never blocks the UI.
- `frontend/src/components/SessionView.jsx`: renders `<FaceDetection videoRef={webcam.videoRef} sessionId={...} active={webcam.on} />` inside the Live Room video tile.
- Face-detection events now appear in the session report's integrity log (same log as blur/fullscreen/code-paste).

**Verified (headless Chrome + SwiftShader WebGL + real two-person photo):**
- Pure state machine (Node smoke test): `multi_person_detected` fires on body 1→2 sustained, `person_count_restored` on return to 1; same for faces; sustained no-face-with-body → `face_not_detected`; no spurious events on steady 1 person. All PASS.
- End-to-end on the group photo with the component's exact config: **faceCount=2 (scores 71/56), bodyCount=2 (scores 42/31)**.
- In-app Live Room: models load (`● detection` badge), no console errors besides a harmless favicon 404. (Headless fake camera produces no video frames, so the detect loop waits on `readyState` — real Chrome with a webcam runs it.)
- `vite build` clean (889 modules). Bundle grew to ~2.2 MB (Human + tfjs, was 2.0).

**Notes / remaining:**
- Face attention scoring (gaze) is still not used — we only count faces/bodies.
- If you want the debug overlay hidden in production, gate it behind a prop/env; it currently shows always in the Live Room.
- Headless verify requires `--enable-unsafe-swiftshader` for WebGL; without it model inference throws a tfjs kernel error.

---

### 2026-08-05 — BODY-PART / HAND DETECTION (fix: "showing a hand or small body part isn't detected")
**Why (user report):** face detection worked, but showing a small hand or a body part (with face hidden) never triggered detection. Root cause: MoveNet-multipose needs a fairly complete person to register — a lone hand or partial body is not a "person" to the pose model, so `bodyCount` stays 0/1 and nothing fires. Also, at `minConfidence: 0.3` the multipose model often misses head-and-shoulders webcam framing.

**What was done:**
- Enabled Human's **hand pose** (new models downloaded to `frontend/public/models/`: `handtrack.json/.bin` + `handlandmark-lite.json/.bin` — these are the exact `modelPath` defaults Human 3.3.6 expects; the older `handdetect`/`handskeleton` names in the repo are unused).
- `hand.enabled: true`, `hand.minConfidence: 0.2`; lowered body `minConfidence` **0.3 → 0.2** so partial bodies register more readily.
- `frontend/src/lib/faceLogic.js`: `stepState` now takes `handCount` and emits **`body_part_detected` / `body_part_restored`** (edge-triggered, same 3-frame debounce) whenever a hand appears/disappears in frame. `multi_person_detected` stays strictly body-based (a hand is not a second person — it's a body-part signal). Works whether or not a face/person is visible, so "no face but a hand in view" now produces both `body_part_detected` **and** (sustained) `face_not_detected`.
- `FaceDetection.jsx`: reads `res.hand.length`; debug overlay adds a **`hands: N`** chip and a "body part (hand) in frame" flag chip alongside the existing `bodies:`/`faces:` chips.

**Verified (headless + SwiftShader WebGL):**
- Node smoke tests: `[face ok → no face, only hand]` → `body_part_detected`; hand appearing while a person is present → `body_part_detected` then `body_part_restored` on withdrawal; `multi_person_detected` still fires only on `bodyCount>=2`; no spurious events. All PASS.
- End-to-end on the group photo with the component's exact config: **faceCount=2, bodyCount=2, handCount=1** (hand scores 38).
- In-app Live Room: overlay shows `bodies/faces/hands` chips, models load (`● detection`), all 4 model json files served 200, only harmless favicon 404. `vite build` clean (889 modules).

**Note:** MoveNet-multipose can never count a lone hand as a "person" — that's a model limitation, so hands are intentionally surfaced as a separate `body_part_detected` signal rather than inflating `bodyCount`.

---
