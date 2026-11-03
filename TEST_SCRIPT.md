# InterviewSpar - End-to-End Test Script for Test Users

## Prerequisites
- Chrome browser (Web Speech API required for voice)
- Backend running: `cd backend && npm run dev` (port 4000)
- Frontend running: `cd frontend && npm run dev` (port 5173)

## Test Accounts (pre-seeded)
| Role | Email | Password |
|------|-------|----------|
| Student | student@demo.dev | password |
| Developer | developer@demo.dev | password |
| Company | company@demo.dev | password |
| Admin | admin@interviewspar.dev | password |

---

## Test Flow 1: Student - Complete Practice Interview (15 min)

### 1. Login & Start Session
1. Go to http://localhost:5173/login
2. Login as `student@demo.dev` / `password`
3. Click "Start Interview" → Choose domain (e.g., "Software Engineering")
4. Select persona: **HR** or **Technical**
5. Select mode: **Practice** (default)
6. Click "Start Session"

### 2. Screening Phase (3 questions)
- Answer basic qualification questions (education, experience, authorization, notice period, salary)
- Observe: qualification score per answer, initial fit score at end
- Auto-advances to Calibration

### 3. Calibration Phase (3 questions)
- Answer 3 medium-difficulty domain questions
- Text or Voice (enable "Live Room" for voice)
- Auto-advances to Adaptive Interview

### 4. Adaptive Interview Phase (5-8 questions)
- AI interviewer asks questions adapting to your performance
- **Voice**: Use "Live Room" → "Answer by Voice" → speak → "Stop & Send"
- **Text**: Type in chat box → Send
- For Technical persona: when coding question appears, use Monaco editor
- Observe: mistake tags with explainability (top features shown)

### 5. End Session & Report
- Click "End & Report" button
- View: Ability radar chart, Mistake journal with features, Integrity flags
- Click "Export PDF" (uses browser print → Save as PDF)

### 6. Dashboard
- Go to Dashboard → See session in history
- Click "Report" on any past session

---

## Test Flow 2: Company - Marketplace Simulation (5 min)

### 1. Login as Company
- Login as `company@demo.dev` / `password`

### 2. Post a Role
- Go to Marketplace page
- Fill: Company name, Domain, Level, Candidate name
- Click "Post Role" → note roleId

### 3. Match Interviewer
- Click "Match Interviewer" → see anonymized handle (e.g., "I-A")

### 4. Mock Payment
- Click "Run mock payment (₹2000)"
- Verify split: Interviewer ₹1500 / Platform ₹500

### 5. Verify Anonymization
- Interviewer identity hidden from company
- Candidate identity hidden from interviewer (until hire decision)

---

## Test Flow 3: Anti-Cheat / Integrity (3 min)

### In any Live Room session:
1. **Tab switch**: Alt+Tab away → check IntegrityMonitor shows flag
2. **Fullscreen exit**: Press Esc → check flag
3. **Copy-paste in code editor**: Paste code → check flag in console/network
4. **Face detection**: Camera shows green dot when face detected, red when not
5. **Response latency**: Wait >30s to answer → check latency-anomaly flag

---

## Test Flow 4: Voice & Fluency (5 min)

### In Live Room:
1. Click "Answer by Voice" → speak naturally
2. Watch live captions appear
3. Stop speaking → auto-sends after pause
4. Check fluency score: fillers, pauses, grammar errors, score
5. Click "Replay" to hear AI question again

---

## Test Flow 5: Resume-Aware Questions (3 min)

### In any session:
1. Click "Upload Resume" → select a PDF
2. Click "Parse"
3. Continue interview → AI should ask about resume projects

---

## Expected Behaviors to Verify

| Feature | Expected |
|---------|----------|
| Screening scores | 0-100 per answer, initial fit % at end |
| Calibration → Adaptive | Auto-transition after 3 Qs |
| Mistake tags | Show label + top 3 features (e.g., "rambling — filler_count=5, answer_length=200") |
| Ability radar | 4+ axes: DSA, System Design, Communication, Cultural Alignment |
| Cultural alignment | Separate from Communication, tracked in adaptive engine |
| System design rubric | 6 dimensions scored when system design question asked |
| PDF export | Contains: transcript, tags, ability, integrity, fluency |
| Monaco editor | Keystrokes stream live (open in 2 tabs to verify) |
| Code similarity | Shows % vs known solution after run |

---

## Known Limitations (MVP)
- No real payment gateway (mock only)
- Voice: Chrome only, English only
- Face detection: fallback heuristic if native API unavailable
- No persistent DB (sessions lost on server restart)
- Single-threaded Python classifier subprocess (one at a time)

---

## Reporting Issues
For each test run, note:
1. **User role** (student/developer/company)
2. **Persona** (HR/Technical)
3. **Mode** (Practice/Assessment)
4. **Steps completed** (which flows)
5. **Bugs/UX issues** (what broke, what was confusing)
6. **Performance** (latency, accuracy of tags, fluency relevance)

---

## Quick Backend Health Check
```bash
curl http://localhost:4000/api/health
# Should return {"status":"ok"}
```

```bash
curl -X POST http://localhost:4000/api/interview/start \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","domain":"Software Engineering","experience":"2 years","persona":"tech","mode":"practice"}'
# Should return sessionId + screening + calibration questions
```