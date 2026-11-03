> Historical prototype/design record. Current routes, behavior, setup, and verification are documented in [README.md](README.md), [architecture.md](architecture.md), and [TODO.md](TODO.md). Older completion claims and endpoint examples below are not current acceptance results.

# InterviewSpar — Demo Video Recording Guide

## Recording Setup
- **Tool:** OBS Studio (free) or macOS built-in Screen Recording (Cmd+Shift+5)
- **Resolution:** 1920x1080
- **Audio:** System audio + microphone (for narration)
- **Duration:** 5-8 minutes max

---

## Demo Script (5-8 minutes)

### 0:00-0:30 — Landing & Login
1. Show http://localhost:5173 landing page
2. Login as student@demo.dev / password
3. Narrate: "InterviewSpar — AI-adaptive mock interviews with real-time feedback"

### 0:30-1:30 — Screening Phase
1. Click "Start Interview" → Domain: Software Engineering → Technical → Practice
2. Show 3 screening questions (education, experience, authorization)
3. Answer each → show qualification score per answer
4. Show "Initial Fit Score" at end → auto-advance to calibration

### 1:30-2:30 — Calibration Phase
1. Show 3 calibration questions (medium difficulty, fixed bank)
2. Answer via text (or voice in Live Room)
3. Explain: "These seed the adaptive engine — no adaptation yet"

### 2:30-4:00 — Adaptive Interview (Core Demo)
1. First adaptive question appears → AI generates live
2. **Show mistake tag:** Answer poorly (ramble) → tag appears: "rambling — filler_count=5, answer_length=180"
3. **Show adaptation:** Next question easier / more guided
4. **Show good answer:** Answer well with STAR → tag: "good-answer — star_present=1, hedge_word_freq=0"
5. **Show ability radar update:** Dashboard updates in real-time

### 4:00-5:00 — Technical Round + Live Code
1. Switch to Technical persona (or continue if already technical)
2. Coding challenge appears → open Monaco editor
3. Write solution → Run Tests → shows pass/fail per test case
4. Show AI code review (correctness, complexity, style, edge cases)
5. Show code similarity check vs known solution

### 5:00-5:30 — Voice & Fluency (Live Room)
1. Click "Live Room" → allow camera/mic
2. Click "Answer by Voice" → speak answer
3. Show live captions → auto-send on pause
4. Show fluency score: fillers, pauses, grammar errors, score

### 5:30-6:00 — Anti-Cheat Demo
1. In Live Room: Alt+Tab → show IntegrityMonitor flag
2. Press Esc (exit fullscreen) → flag appears
3. In code editor: Paste code → "code-paste" flag in console

### 6:00-6:30 — Resume-Aware Questions
1. Upload resume PDF → Parse
2. Continue interview → AI asks about specific project from resume

### 6:30-7:00 — End Session & Report
1. Click "End & Report"
2. Show: Ability radar (4 axes), Mistake journal (with features), Integrity flags
3. Click "Export PDF" → browser print → Save as PDF

### 7:00-7:30 — Company Marketplace (30 sec)
1. Login as company@demo.dev
2. Post role → Match interviewer → Mock payment
2. Show anonymization note

### 7:30-8:00 — Dashboard & Close
1. Student dashboard → Session history → Open past report
2. Show radar chart progression across sessions
3. Close with: "All modules built this semester per PRD. Phase 2 items simulated."

---

## Backup: Static Screenshots (if live demo fails)

Capture these screenshots as slides:
1. Landing page
2. Screening with scores
3. Calibration question
4. Adaptive interview with mistake tag + features
5. Monaco editor with test results + AI review
6. Live Room with captions + fluency score
7. IntegrityMonitor with flags
8. Report page: radar + mistake journal + integrity
9. PDF export preview
10. Marketplace flow
11. Dashboard with history

---

## Key Talking Points for Viva

| Question | Answer |
|----------|--------|
| "How does adaptation work?" | Calibration seeds ability → BKT-lite updates per-topic ability → difficulty hint injected into LLM prompt for next question |
| "Why not fine-tune a transformer?" | Rules.md: scikit-learn only. Logistic Regression on 9 interpretable features is defensible, fast, explainable. 150-300 samples insufficient for deep learning. |
| "How do you prevent cheating?" | 7 browser-side signals (face, tab, fullscreen, paste, similarity, latency, consent). Video never leaves browser. |
| "What's the classifier accuracy on real data?" | 100% on synthetic (by design). Real accuracy TBD after Step 12 user testing — we'll retrain and report. |
| "How is cultural alignment different from communication?" | Separate ability dimension. Communication = structure/fluency (STAR, fillers). Cultural = values/ownership/team keywords. Tracked independently in adaptive engine. |
| "Why Groq + Gemini fallback?" | Free tiers, low latency. Groq primary (Llama-3.3-8B), Gemini backup. 15s timeout + safe fallback message. |
| "How does code similarity work?" | Cosine similarity on token frequencies vs known solutions bank. Flag ≥0.8. Combined with copy-paste detection for stronger signal. |
| "What's the fluency score formula?" | 100 - fillers×5 - pauses×4 - grammar_errors×3. LanguageTool for grammar (free API). |

---

## Quick Verification Before Recording

```bash
# 1. Backend health
curl http://localhost:4000/api/health

# 2. Start session
curl -X POST http://localhost:4000/api/interview/start \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","domain":"Software Engineering","experience":"2 years","persona":"tech","mode":"practice"}'

# 3. ML inference test
cd ml
echo '{"answer_text": "um i think we should use a hashmap for this problem", "response_latency": 5, "code_correct": 0, "pause_count": 2, "grammar_errors": 1, "fluency_score": 60}' | python3 infer.py

# 4. Frontend loads
open http://localhost:5173
```

---

## Post-Recording
1. Export as MP4 (H.264, <100MB)
2. Upload to Google Drive / YouTube (unlisted)
3. Add link to report appendix
4. Keep local copy as backup