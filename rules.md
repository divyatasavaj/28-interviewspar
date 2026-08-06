# rules.md — InterviewSpar

## 1. Locked Tech Choices (don't swap mid-project)
- LLM: Groq API (Llama) only — don't mix multiple LLM providers
- ML: scikit-learn only for the classifier — no deep learning, no fine-tuning a transformer (out of scope/time)
- Blockchain: Solidity + Hardhat + Sepolia testnet only — never mainnet, never real funds
- Frontend: React + Tailwind — no extra UI framework mixing
- Face detection: face-api.js or MediaPipe only — never build custom CV from scratch

## 2. Things To Avoid (common mistakes)
- ❌ Don't attempt real gaze/eye-tracking — it's a research problem, not a student-project feature
- ❌ Don't let the classifier just be "LLM says the tag" — always run it on extracted numeric/structured features
- ❌ Don't over-engineer the adaptive engine with complex RL — a simple rule-based scoring system is enough and easier to defend
- ❌ Don't store raw video — process face-presence check in-browser, discard the frame immediately
- ❌ Don't hardcode API keys in code — always use `.env` files, never commit them
- ❌ Don't build a custom login/auth system from scratch — use a simple existing solution (Firebase Auth / Clerk) if login is even needed for MVP
- ❌ Don't try to "gamify" scope by adding features not in PRD.md mid-sprint — check phases.md first

## 3. Error Handling Requirements
- Every LLM call must have a timeout + fallback message ("Let's try that question again") — never let the UI hang
- Resume parsing must handle malformed/scanned PDFs gracefully — show "couldn't read resume, please retype key points" instead of crashing
- Classifier must handle missing/incomplete features (e.g., no voice input) — fall back to text-only feature set
- Blockchain transaction failures (testnet congestion, gas issues) must not block the session — show "certificate pending, will retry" instead of failing silently
- All API routes must return proper error codes + human-readable messages, not raw stack traces

## 4. AI Boundaries (LLM interviewer behavior)
- The AI interviewer must stay in character (interviewer persona) — never break role to explain its own reasoning mid-session
- The AI must not give the answer away when a student is stuck — it should ask a clarifying/follow-up question instead, like a real interviewer
- The AI must not fabricate specific facts about the student not present in their resume/answers
- All feedback shown to the student must reference something they actually said — no generic canned feedback
- The LLM prompt must include a system instruction limiting it to interview-related conversation only (no off-topic chat abuse)

## 5. Data & Privacy Rules
- Resumes and session transcripts are stored only for the logged-in session — no permanent storage without explicit consent flag in MVP
- No third-party sharing of resume data
- Face-detection frames are never uploaded or stored — client-side only, discarded per frame

## 6. Code Quality Rules
- One feature = one branch = one PR (even for a 3-person team)
- Every new module needs at least a basic docstring/comment explaining purpose
- No committing directly to `main` — always through review, even informal (teammate glance is enough for SGP scale)
- Keep `.env.example` updated whenever a new API key/config is added
