# PRD.md — InterviewSpar

## 1. Vision
InterviewSpar is an AI-adaptive interview platform with two sides:

1. **Practice Mode (MVP, built this semester):** Students practice HR/technical interviews against an AI interviewer that adapts question difficulty to real-time performance, checks for cheating, and syncs live code typing.
2. **Marketplace Mode (Phase 2 vision, simulated in MVP):** Companies post open roles → get matched with verified human interviewers (senior engineers/managers from other companies, paid per interview) who conduct real interviews on the platform → both sides stay anonymized from each other until hire.

Long-term goal: a global platform where a student's interview performance and a company's shortlisting decision are both backed by verifiable, unbiased data — not just a resume claim or one rushed internal interview.

## 2. Target Users
| User | What they get |
|---|---|
| **Student** | Free/low-cost adaptive AI mock interviews, honest feedback |
| **Company** | Faster hiring — outsource first-round technical interviews to vetted external interviewers instead of burning senior engineers' time |
| **Interviewer (gig-side)** | Paid opportunity to conduct interviews for other companies using free time/expertise |
| **College TPO cell (secondary)** | Aggregate readiness data across their students |

---

## 3. Modules — Full Requirements

### Module 1 — AI Interview Engine
**Functionality:**
- Interviewer personas: HR round, Technical round
- Opening flow: collect basic info (name, target domain/role, experience level) → 2-3 general warm-up questions → domain-specific questions begin
- Generates each question/follow-up live, stays in character, never gives away answers when student is stuck — asks a clarifying follow-up instead

**Calibration questions (new — fixes Module 2's "cold start" problem):**
- Before adaptive logic kicks in, every session opens with 2-3 **fixed, non-adaptive baseline questions** at a medium difficulty, same for every student in that domain
- Purpose: Module 2's ability estimate needs *some* real data point to start from — without this, question 1 of the adaptive engine is basically a guess
- These fixed questions are scored by Module 4 exactly like any other answer, and their result becomes the **initial ability estimate** Module 2 starts adapting from
- Simple to implement: just a small hardcoded question bank per domain (10-15 questions), randomly pick 2-3 per session so it doesn't feel repetitive across multiple practice attempts

**Practice Mode vs Assessment Mode (new):**
- Same interview engine, one mode flag that changes behavior:
  - **Practice Mode** (default for students practicing solo): AI can give a gentle hint if a student is badly stuck, slightly more encouraging tone, meant for learning
  - **Assessment Mode** (used for marketplace/company-facing sessions, Module 7): no hints, stricter follow-up pressure, closer to a real interview — used when the output needs to be a trustworthy signal for a company, not just practice
- Implementation: a single flag passed into the Module 1 system prompt that swaps a few instruction lines (hint policy, tone) — cheap to build, no separate engine needed

**How to build it:**
- No training needed — this is prompt engineering, not model training
- **API options (free):**
  - Groq API (console.groq.com) — free tier, fast, runs Llama 3.x models — recommended primary
  - Google Gemini API (aistudio.google.com) — free tier, rate-limited, good backup
- System prompt defines persona + strict rules (stay in character, don't reveal answers, ask domain-appropriate follow-ups) + mode-specific instructions (practice/assessment)
- No dataset needed for this module — it's live generation, not classification

---

### Module 2 — Adaptive Question Selection Model (core ML model)
**Functionality:**
- Tracks a per-topic "ability estimate" for each student, updated after every answer
- Picks next question's difficulty/topic based on current ability estimate
- Ability rises → harder question in that topic. Ability drops/mistake repeats → easier question targeting the same weak sub-topic

**Cold-start fix:** the 2-3 fixed calibration questions from Module 1 run *before* this model activates — their scored results seed the initial ability estimate, so question 4 onward is a real adaptive choice, not a guess based on zero data.

**How to build it:**
- Model type: **Item Response Theory (IRT)** or **Bayesian Knowledge Tracing (BKT)** — both are lightweight statistical models, not deep learning, easy to implement in Python (a few hundred lines, `pyBKT` library exists for BKT)
- **Training data:** You don't need a giant pre-existing dataset for this. Two realistic options:
  1. **Bootstrap with synthetic simulation** — generate simulated student response sequences (correct/incorrect patterns) to test and tune the model's update logic before real users touch it
  2. **Public reference dataset (for validation/citation in report):** ASSISTments dataset (assistments.org) — a well-known public knowledge-tracing dataset from education research, free to download, used in most BKT/IRT academic papers — you can cite it and even run your model on it to prove it works, even though your live data will be your own collected sessions
- Once real test users (classmates) use the app, their session data becomes your real training/tuning data — this is expected and normal for a model like this

---

### Module 3 — Resume-Aware Questioning
**Functionality:**
- Resume upload (PDF) → text extraction → structured summary
- LLM generates follow-ups tied to specific resume claims
- Flags when a student can't explain something they claimed

**How to build it:**
- PDF parsing library: `pdf-parse` (Node.js) or `PyPDF2` / `pdfplumber` (Python) — free, no API needed, purely local extraction
- No training/dataset needed — extracted resume text is just injected into the Module 1 LLM prompt as context

---

### Module 4 — Mistake & Answer-Quality Classifier
**Functionality:**
- Extracts features per answer: STAR-structure presence, hedge-word frequency, filler-word count, answer length, response latency, code-correctness (technical answers)
- Trained classifier tags mistake type: rambling, no-structure, resume-gap, silent-coding, underselling, etc.
- Output feeds Module 2's ability estimate as an "explanation quality" signal

**Fluency & filler-word sub-feature (new):**
- Counts filler words/hesitation markers in the transcript: "um," "uh," "like," "you know," "basically," etc.
- Measures pause length between words/sentences using speech timing (long dead-air gaps flagged separately from filler words)
- Basic grammar/sentence-structure check on the transcript (tense errors, broken sentence structure)
- These roll up into a simple **fluency score** shown alongside the mistake tags — e.g. "12 filler words in this answer, 2 long pauses, fluency: needs work"
- **Fairness note (state this in your report):** score structural fluency (filler frequency, pace, grammar), never accent or pronunciation — scoring accent would be unfair to non-native English speakers and is not something you should build or claim

**Explainability (new — makes the classifier defensible in your viva):**
- Every mistake tag shown to the student must come with the *specific feature value* that triggered it, not just the label
- Example: instead of just showing "Tag: Rambling," show "Tag: Rambling — answer length 340 words (avg good answer: ~120 words), no clear STAR structure detected, 3 topic shifts mid-answer"
- Implementation: `scikit-learn` models can expose feature importances / coefficients directly — when a prediction is made, pull the top 2-3 contributing features for that specific answer and render them alongside the tag (this is standard practice, no extra library needed beyond what you already have)
- This is also your strongest answer if a panel member asks "how do I know your model isn't just guessing" — you show the actual numbers, not a black box

**How to build it:**
- Model type: Logistic Regression or Random Forest (`scikit-learn`) — small, fast, explainable, appropriate for a hand-labeled dataset of a few hundred samples
- Filler-word detection: simple keyword matching against a predefined filler-word list on the Web Speech API transcript — no training needed, no API cost
- Pause detection: use timestamps from Web Speech API's interim results to measure gaps between speech segments
- Grammar check (free option): **LanguageTool** — open-source grammar checker with a free public API (has rate limits) or self-hostable — no training needed, plug-and-play
- These three signals (filler count, pause length, grammar errors) become additional input features to the same classifier described below, not a separate model
- **Where to get training data (this is the real bottleneck, plan for it early):**
  1. **Self-collect (primary source):** record yourself + teammates + classmates answering ~40-50 common interview questions each → hand-label each answer's mistake type → aim for 150-300 labeled samples total
  2. **LLM-assisted synthetic labeling (to speed this up):** ask Groq/Gemini to generate example answers on purpose that are "rambling," "well-structured," "underselling," etc., then you manually verify/correct the labels — this is a real, commonly used technique (weak supervision) and honest to disclose in your report
  3. **Public datasets to supplement/cite:**
     - **MIT Interview Dataset** (MIT Media Lab, used in hirability-prediction research papers) — search "MIT Interview dataset hirability" — real interview transcripts with outcome labels, useful for validating your feature approach even if you don't use it directly for training
     - Kaggle: search "interview questions dataset" / "HR interview transcripts" — quality varies, treat as supplementary, not primary
- Feature extraction itself uses simple text processing (word counts, keyword matching) — no API cost, runs locally in Python (`nltk` or `spaCy`, both free)

---

### Module 5 — Live Code IDE Sync
**Functionality:**
- Monaco editor embedded in student's screen
- Every keystroke streamed live via WebSocket to the interviewer/AI side — not just final submission
- AI reviews code live for correctness, complexity, and problem-solving approach (visible from keystroke pattern: rewrites, pauses, direction changes)

**Code plagiarism/similarity check (new — ties into the anti-cheat story):**
- Submitted code is compared against a small bank of common/known solutions for that problem (e.g. the top few textbook approaches to a given DSA question)
- Flags "this closely matches a known solution pattern" — not proof of cheating on its own, but a useful signal combined with Module 6's copy-paste detection (a solution that appears in one pasted block AND closely matches a known answer is a much stronger flag than either signal alone)
- Implementation: simple **token-overlap similarity** (e.g. compare normalized token sequences, or use a basic cosine-similarity on code embeddings) — no need for anything more advanced; a free, well-documented approach is Python's `difflib.SequenceMatcher` for a first version, upgrade to embedding-based comparison only if time allows

**How to build it:**
- Monaco Editor — free, open-source (same editor VS Code uses), npm package `@monaco-editor/react`
- WebSocket library: `socket.io` (Node.js) — free, well-documented
- Code correctness check: run submitted code against test cases using a sandboxed execution service — free/low-cost options: `Judge0` (has a free-tier public API) or run simple Python/JS execution in a sandboxed Docker container yourself if you want zero external dependency
- Similarity check: `difflib` (Python, built-in, free) for token-overlap comparison against your known-solutions bank
- No ML training needed here — this is a real-time data pipeline problem, not a model

---

### Module 6 — Anti-Cheat / Integrity Monitoring
**Functionality (honest, buildable signals only):**
- Face monitoring: no face detected / multiple faces detected / face leaves frame — timestamped flags
- Tab-switch / window-blur detection during session
- Copy-paste detection in code editor (large pasted block vs incrementally typed, using Module 5's keystroke stream)
- Fullscreen enforcement — exiting fullscreen is logged
- Right-click / dev-tools shortcut disabled in session window
- Response-latency anomaly flags (answers coming suspiciously fast for the question's complexity)
- Code-similarity flag (from Module 5) — combined with copy-paste detection for a stronger signal
- Consent-based session recording before it starts

**How to build it:**
- Face detection: `face-api.js` or `MediaPipe Face Detection` — both free, pretrained models, run entirely in-browser (no training needed, no video ever leaves the browser)
- Tab-switch/blur detection: native browser JS events (`window.onblur`, `visibilitychange`) — no library needed
- Fullscreen enforcement: native browser Fullscreen API — no library needed
- Copy-paste detection: JS clipboard event listeners on the Monaco editor
- **No dataset or model training required for this entire module** — it's all rule-based event detection, not ML
- Explicitly out of scope (state clearly in report): OS-level extension blocking, lockdown browser behavior, lip-sync/deepfake detection

---

### Module 7 — Human Interviewer Marketplace (Phase 2 vision, simulated logic in MVP)
**Functionality:**
- Company posts a role + candidate list (structured info, not full resumes)
- Platform matches company with an available interviewer qualified for that domain
- Interviewer conducts a real interview (~1 hour) through the platform (video + live code IDE)
- Payment split logic (e.g. company pays ₹2000 → ₹1500 interviewer, ₹500 platform fee) — simulated with mock transactions in MVP
- Two-way anonymization: interviewer identity hidden from company, candidate identity hidden from interviewer until hire decision
- Session recording (with consent) + report shared with hiring company

**How to build it (MVP = simulated):**
- Matching logic: simple rule-based matching (domain tag + availability), no ML needed at this stage
- Mock payment: just a database record showing the split, displayed on a dashboard — **no real payment gateway integrated yet**
- **When ready for real payments (post-MVP):** Razorpay or Stripe both have well-documented APIs and free sandbox/test modes to build and test the full flow before going live with real transactions
- No dataset/training needed for MVP version of this module

---

### Module 8 — Dashboards
**Functionality:**
- **Student dashboard:** session history, mistake journal, ability progress chart
- **Company dashboard:** candidate reports (score, transcript, recording, integrity flags), simulated billing view
- **Interviewer dashboard (Phase 2):** assigned interviews, payout history (simulated), ratings

**Exportable PDF report (new):**
- Every completed session can be exported as a downloadable PDF — not just viewed in-app
- Contents: candidate/student info, question-by-question breakdown, mistake tags with explainability notes (from Module 4), fluency score, integrity flags (from Module 6), overall ability estimate (from Module 2)
- Why it matters: companies and TPO cells need something they can save, email, or attach to an internal hiring file — an in-app-only report is much less useful in a real workflow
- Implementation: generate PDF server-side using a free library — `pdfkit` (Node.js) or `reportlab`/`weasyprint` (Python, can render from an HTML template which is often easiest to style)

**How to build it:**
- Standard React dashboard with charts (`recharts` or `chart.js`, both free)
- PDF export: `pdfkit` (Node) or `weasyprint` (Python, HTML-to-PDF) — both free
- No ML/dataset needed — pure data visualization/export of information generated by other modules

---

### Module 9 — Subtitles & Language
**Functionality:**
- Live speech-to-text subtitles during voice sessions
- English only for MVP

**How to build it:**
- Web Speech API — built into Chrome, completely free, no external API key needed
- No training/dataset required

---

## 4. What's Built vs What's Vision (be explicit about this in your report)
| Fully built this semester | Simulated / vision only |
|---|---|
| AI interview engine + calibration questions + Practice/Assessment mode (Module 1) | Real payment gateway (Module 7) |
| Adaptive ML question model (Module 2) | Full interviewer marketplace matching at scale |
| Resume-aware questioning (Module 3) | Real interviewer payout dashboard |
| Mistake classifier + fluency scoring + explainability (Module 4) | Multi-language support |
| Live code IDE sync + code similarity check (Module 5) | — |
| Anti-cheat signals (Module 6) | — |
| Dashboards + exportable PDF report (Module 8) | — |
| Subtitles (Module 9) | — |

## 5. Free API / Tooling Summary (quick reference)
| Need | Free Option |
|---|---|
| LLM (interviewer, question gen) | Groq API (primary) or Gemini Pro API (backup) — both free tier |
| Resume parsing | pdf-parse / PyPDF2 — local, no API |
| Face detection | face-api.js / MediaPipe — local, pretrained, no API |
| Code execution/testing | Judge0 free-tier API or local Docker sandbox |
| Speech-to-text | Web Speech API — built into browser, free |
| Charts/dashboard | recharts / chart.js — free npm libraries |

## 6. Success Criteria
- End-to-end demo: student joins → basic info → 2-3 calibration questions → adaptive interview → live-coded technical answer → integrity flags logged → feedback report → PDF export
- Classifier and adaptive model both show real evaluation metrics (accuracy, confusion matrix, ability-estimate curve over a session)
- Every mistake tag shown in the demo includes its explainability breakdown (the specific feature values behind it), not just a label
- At least one full mock "company view" demo: a simulated candidate report with recording + integrity flags + fluency score + simulated billing, exportable as PDF
- Practice Mode and Assessment Mode both demoable, showing the behavior difference (hints vs no hints)
- Every module in the "Vision only" column has a one-slide explanation of what it would take to make it real — this is what makes the "global platform" pitch credible without overclaiming what's actually built
