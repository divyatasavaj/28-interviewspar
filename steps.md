# steps.md — InterviewSpar Build Sequence

This is the exact order to build things, with dataset sources and training details spelled out where relevant. Follow top to bottom — later steps depend on earlier ones.

---

## STEP 0 — Setup (Day 1)
1. Create repo, set up folder structure (see `architecture.md`)
2. Get free API keys:
   - Groq: console.groq.com → sign up → create API key (free tier, no card needed)
   - Google Gemini: aistudio.google.com → sign up → create API key (free tier, backup LLM)
3. Create `.env.example` with placeholders for both keys — never commit real keys
4. Install core dependencies: React frontend scaffold, Node/Python backend scaffold, `@monaco-editor/react`, `socket.io`

**Output of this step:** empty but running frontend + backend that can talk to each other.

---

## STEP 1 — AI Interview Engine, text-only (Week 1-2)
1. Write the system prompt for the HR interviewer persona (tone, rules: stay in character, never reveal answers, ask domain-relevant follow-ups)
2. Write the system prompt for the Technical interviewer persona
3. Wire up Groq API call: send conversation history + system prompt, get next question back
4. Build the basic chat UI (just text bubbles, no styling polish yet)
5. Add Gemini as a fallback call if Groq errors/rate-limits

**Output:** you can type an answer and get a believable next question back.

**No dataset/training needed for this step** — it's pure prompt engineering.

---

## STEP 2 — Calibration Questions + Basic Info Flow (Week 2)
1. Build a small hardcoded question bank per domain (10-15 fixed medium-difficulty questions per domain — write these yourself, no dataset needed)
2. On session start: collect name, target domain, experience level → then serve 2-3 random questions from the fixed bank before adaptive logic turns on
3. Store each calibration answer + a placeholder score (real scoring comes in Step 5, once the classifier exists)

**Output:** every session opens the same reliable way, giving you a real data point to seed the adaptive model later.

---

## STEP 3 — Resume-Aware Questioning (Week 3)
1. Add resume upload (PDF) to the UI
2. Extract text using `pdf-parse` (Node) or `pdfplumber` (Python) — test on 5-10 real resumes (yours, teammates', friends') to catch weird formatting edge cases early
3. Feed extracted resume text into the Module 1 system prompt as extra context so the LLM can generate resume-specific follow-ups
4. Test: upload your own resume, confirm the AI asks about a real project you listed

**Output:** the interviewer now asks personalized questions, not generic ones.

**No dataset/training needed** — this is text extraction + prompt injection only.

---

## STEP 4 — Live Code IDE Sync (Week 3-4, can run parallel with Step 3 if team-split)
1. Embed Monaco editor in the technical-round UI
2. Set up `socket.io` so every keystroke is sent to the backend live
3. Add code execution: connect to Judge0's free-tier API (or set up a local sandboxed Docker container if you want zero external dependency) — run submitted code against 2-3 test cases per problem
4. Build a small bank of coding questions (10-20 DSA problems with known correct solutions + test cases) — write these yourself or pull from LeetCode-style public problem sets (respect licensing, don't copy full problem text verbatim if scraped — better to write your own versions of common problems)

**Output:** student writes code, correctness is checked automatically, keystrokes are visible live.

---

## STEP 5 — Data Collection for the Mistake Classifier (Week 4-5 — START THIS EARLY, it's the slowest step)
This is the step people always underestimate. Start collecting the moment Step 1 works, don't wait.

1. **Self-collect (primary source, do this first):**
   - Each team member answers ~40-50 common interview questions (mix of HR + technical) into the app, or just recorded/typed manually
   - Target: 150-300 total labeled samples across the team + a few friends/classmates
   - For each answer, hand-label the mistake type: `rambling`, `no-structure`, `resume-gap`, `silent-coding`, `underselling`, `good-answer` (include positive examples too, not just mistakes)
2. **LLM-assisted synthetic labeling (to speed up volume):**
   - Prompt Groq/Gemini to generate example answers on purpose that are deliberately rambling, well-structured, underselling, etc.
   - Manually review and correct every LLM-generated label before adding it to your dataset — don't trust it blindly, this is what makes it defensible as "your" labeled data
3. **Public datasets to supplement/cite (not primary training data, but useful for validation and citing in your report):**
   - **MIT Interview Dataset** — search "MIT Interview dataset hirability prediction" (MIT Media Lab) — real interview transcripts with outcome labels, good for sanity-checking your feature choices
   - Kaggle — search "interview questions dataset" or "HR interview transcripts" — variable quality, use only to supplement, not as your core dataset
4. Store your final labeled dataset as a simple CSV: `answer_text, feature_values, mistake_label`

**Output:** a labeled CSV with 150-300+ rows, ready for Step 6.

**Do not proceed to Step 6 until you have at least ~150 labeled samples.** If you're behind, keep collecting in parallel while building Steps 4/7/8 — don't block the whole team on this alone.

---

## STEP 6 — Build & Train the Mistake Classifier (Week 5-6)
1. Feature extraction script (Python, `nltk` or `spaCy`):
   - STAR-structure presence (keyword/pattern matching for situation/task/action/result language)
   - Hedge-word frequency (count words like "maybe," "I think," "sort of")
   - Filler-word count (from Step 9's transcript, or run this step after Step 9 if voice comes first)
   - Answer length (word count)
   - Response latency (time between question shown and answer submitted)
   - Code correctness (pass/fail from Step 4, technical answers only)
2. Split your labeled dataset: 80% train / 20% test (use `train_test_split` from `scikit-learn`)
3. Train a Logistic Regression model first (simplest baseline) — check accuracy on the test set
4. Try Random Forest next — compare accuracy, pick whichever performs better (Random Forest usually wins with more features)
5. Generate and save: accuracy score, confusion matrix, feature importance chart — **you need these for your report, generate them now while the model is fresh, don't leave it for later**
6. Wire the trained model into the backend: after every technical/behavioral answer, run feature extraction → run classifier → return mistake tag
7. Add explainability: for each prediction, pull the top 2-3 feature values that contributed most, show them alongside the tag

**Output:** every answer gets a real, trained mistake tag with an explanation — this is your core "real ML" deliverable.

**When to retrain:** retrain once more near the end (Week 10-11) after you've collected additional real session data from test users — shows the model improving with more data, good for your report.

---

## STEP 7 — Adaptive Question Selection Model (Week 6-7)
1. Implement Bayesian Knowledge Tracing using the `pyBKT` library (or implement simple IRT manually if you want more control — either is fine, pick one and commit)
2. Initialize each student's per-topic ability estimate using their Step 2 calibration question results
3. After every answer (once Step 6's classifier tag comes back), update the ability estimate for that topic
4. Write the selection logic: pick next question's difficulty/topic based on current ability estimate (weak topic → easier/targeted question, strong topic → harder question)
5. **Validate against the ASSISTments dataset** (assistments.org, free download) — run your BKT/IRT implementation on a sample of that public dataset to prove your model's update logic behaves correctly before trusting it on your own live data. Cite this in your report as your validation method.

**Output:** two different test users with different weak spots visibly get different next questions.

---

## STEP 8 — Anti-Cheat / Integrity Monitoring (Week 7-8)
1. Face detection: integrate `face-api.js` or MediaPipe (pretrained, no training) — run in-browser, flag no-face/multi-face/face-left-frame events with timestamps
2. Tab-switch/blur detection: `window.onblur` + `visibilitychange` listeners — log every occurrence
3. Fullscreen enforcement: browser Fullscreen API, log every exit
4. Copy-paste detection: clipboard event listener on the Monaco editor from Step 4
5. Code similarity check: build a small bank of "known solution" code snippets per coding question (write these yourself), compare submissions using `difflib.SequenceMatcher` (Python, free, built-in), flag high-similarity submissions
6. Response-latency anomaly flag: compare answer submission time against question complexity baseline (set simple thresholds per question type)
7. Consent screen before any recording starts

**Output:** every session produces a timestamped integrity log alongside the interview transcript.

---

## STEP 9 — Voice, Fluency & Subtitles (Week 8-9)
1. Integrate Web Speech API for live transcript + subtitles (English only)
2. Filler-word detection: keyword match against a predefined list ("um," "uh," "like," "you know," etc.) on the transcript
3. Pause detection: measure gaps between speech segments using Web Speech API's interim result timestamps
4. Grammar check: integrate LanguageTool's free public API (or self-host if you hit rate limits) — run on the transcript, count errors
5. Combine filler count + pause length + grammar errors into a fluency score, feed as additional features into Step 6's classifier (may require a light retrain if these features weren't in the original dataset)

**Output:** every answer now shows a fluency score alongside the mistake tag.

---

## STEP 10 — Dashboards + PDF Export (Week 9-10)
1. Student dashboard: session history, mistake journal, ability progress chart (use `recharts`)
2. Company dashboard (simulated data for now): candidate report view, integrity flags, simulated billing view
3. PDF export: build an HTML report template → convert with `weasyprint` (Python) or `pdfkit` (Node) — include everything: transcript, mistake tags with explainability, fluency score, integrity flags, ability estimate

**Output:** a downloadable, shareable report per session.

---

## STEP 11 — Marketplace Simulation (Week 10-11, if time allows)
1. Company posts a role (form: domain, level, candidate list with structured info only)
2. Simple rule-based matching: domain tag + interviewer availability → suggest a match
3. Mock payment record: store and display the simulated split (e.g. ₹2000 in → ₹1500 interviewer / ₹500 platform) on both dashboards, no real gateway yet
4. Two-way anonymization: hide company identity from interviewer and candidate identity from company until a hire decision field is set

**Output:** a believable demo of the marketplace flow, clearly labeled as simulated in your report.

---

## STEP 12 — Testing, Retraining, Report (Week 11-13)
1. Get 5-10 real test users (classmates) to run full sessions end-to-end
2. Retrain the Step 6 classifier on the combined self-collected + real test-user data — compare new accuracy/confusion matrix to the original, show improvement in your report
3. Fix bugs found during real testing (this always takes longer than expected — don't skip buffer time)
4. Write the SGP report: problem statement, literature survey (cite BKT/IRT papers, ASSISTments dataset, MIT Interview dataset), architecture, module breakdown, evaluation metrics, built-vs-vision table
5. Record a backup demo video in case the live demo fails during viva

---

## Quick Reference — When Each Dataset/Model Gets Used
| What | Dataset/Source | When |
|---|---|---|
| Mistake classifier training | Self-collected (150-300 labeled samples) + LLM-assisted synthetic + MIT/Kaggle supplement | Step 5-6 (Week 4-6), retrain Step 12 (Week 11-13) |
| Adaptive model validation | ASSISTments dataset (assistments.org) | Step 7 (Week 6-7) |
| Coding question bank | Self-written (10-20 problems) | Step 4 (Week 3-4) |
| Calibration question bank | Self-written (10-15 per domain) | Step 2 (Week 2) |
| Code similarity check | Self-written "known solutions" bank | Step 8 (Week 7-8) |
