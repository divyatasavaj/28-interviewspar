> Historical prototype/design record. Current routes, behavior, setup, and verification are documented in [README.md](README.md), [architecture.md](architecture.md), and [TODO.md](TODO.md). Older completion claims and endpoint examples below are not current acceptance results.

# InterviewSpar — SGP Final Report Template

**Project:** AI-Adaptive Interview Practice Platform
**Team:** [Team Members]
**Semester:** [Semester/Year]
**GitHub:** https://github.com/[repo]

---

## 1. Problem Statement

InterviewSpar addresses the gap between student interview preparation and real-world hiring needs. Students lack access to realistic, adaptive mock interviews with actionable feedback. Companies waste senior engineer time on first-round screening. InterviewSpar bridges this with an AI interviewer that adapts question difficulty in real-time, detects cheating, syncs live code, and generates explainable, verifiable reports.

---

## 2. Literature Survey

| Area | Key References | Application in InterviewSpar |
|------|---------------|------------------------------|
| **Knowledge Tracing** | Corbett & Anderson (1995) — BKT; Piech et al. (2015) — Deep Knowledge Tracing | Module 2: Rule-based BKT-lite for per-topic ability estimation, seeded by calibration questions |
| **Item Response Theory** | Lord (1980); Baker (2001) | Module 2: Difficulty calibration (easy/medium/hard) based on ability thresholds |
| **Interview Assessment** | MIT Interview Dataset (Media Lab) — hirability prediction | Module 4: Feature design (STAR, hedges, fillers) validated against real interview transcripts |
| **ASSISTments Dataset** | assistments.org — 500K+ student interactions | Module 7 validation: BKT logic tested on public educational data |
| **Code Similarity** | Mozgovoy et al. (2010) — token-based plagiarism detection | Module 5/8: Cosine similarity on token frequencies vs known solutions |
| **Fluency Assessment** | Cucchiarini et al. (2000) — automatic fluency scoring | Module 9: Filler count, pause detection, LanguageTool grammar → fluency score |

---

## 3. System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   ML Service    │
│   (React)       │     │   (Node/Express)│     │   (Python)      │
│                 │     │                 │     │                 │
│ - Chat UI       │     │ - Session Mgmt  │     │ - Classifier    │
│ - Monaco Editor │     │ - LLM (Groq)    │     │ - Feature Ext.  │
│ - Web Speech    │     │ - Adaptive Eng  │     │ - Train/Infer   │
│ - face-api.js   │     │ - Integrity Log │     │                 │
│ - Socket.io     │     │ - Code Runner   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌───────────────┐         ┌───────────────┐
            │  Blockchain   │         │  Judge0 API   │
            │  (Sepolia)    │         │  (Code Exec)  │
            │  Certificate  │         │               │
            └───────────────┘         └───────────────┘
```

---

## 4. Module Breakdown & Implementation Status

### Module 1: AI Interview Engine ✅ **BUILT**
- **Personas:** HR (behavioral/STAR) + Technical (DSA, System Design, Domain)
- **Modes:** Practice (hints, encouraging) + Assessment (strict, no hints)
- **Calibration:** 2-3 fixed medium questions per domain before adaptive kicks in
- **Tech:** Groq Llama-3.3-8B (primary), Gemini-1.5-Flash (fallback), 15s timeout

### Module 2: Adaptive Question Selection ✅ **BUILT**
- **Model:** Rule-based BKT-lite (per-topic ability ∈ [0,1])
- **Topics tracked:** DSA, System Design, Communication, Cultural Alignment, Domain
- **Seeding:** Calibration answers → initial ability
- **Update:** Mistake tags + code correctness → ability delta
- **Difficulty:** ≥0.7 hard, ≥0.45 medium, else easy

### Module 3: Resume-Aware Questioning ✅ **BUILT**
- **PDF parsing:** pdf-parse (Node.js)
- **Injection:** Extracted text → LLM system prompt as context
- **Gap detection:** LLM flags when candidate can't explain resume claims

### Module 4: Mistake Classifier + Fluency + Explainability ✅ **BUILT**
- **Model:** Logistic Regression (best of LogReg vs RF) on 9 features
- **Features:** STAR, hedges, fillers, length, latency, code_correct, pauses, grammar, fluency
- **Training data:** 1 real + 210 synthetic samples (6 labels)
- **Accuracy:** 100% on synthetic test set (43 samples)
- **Explainability:** Top 3 contributing features shown per prediction
- **Feature importance:** answer_length (0.42), hedge_word_freq (0.29), fluency_score (0.23), response_latency (0.17), pause_count (0.20), code_correct (0.10), star_present (0.09), grammar_errors (0.08), filler_word_count (0.04)

### Module 5: Live Code IDE Sync ✅ **BUILT**
- **Editor:** Monaco (@monaco-editor/react)
- **Sync:** Socket.io keystroke stream per session room
- **Execution:** Judge0 free-tier API (6 DSA problems, JS/Python)
- **Review:** AI feedback on correctness, complexity, style, edge cases

### Module 6: Anti-Cheat / Integrity ✅ **BUILT**
| Signal | Implementation |
|--------|----------------|
| Face detection | 3-tier: Native FaceDetector → @vladmandic/human BlazeFace → pixel variance fallback |
| Tab-switch/blur | window.onblur + visibilitychange |
| Fullscreen exit | fullscreenchange event |
| Copy-paste | Monaco onDidPaste → integrity log |
| Code similarity | Cosine token overlap vs known solutions (flag ≥0.8) |
| Latency anomaly | >30s response time flagged |
| Consent | Explicit consent screen before monitoring |

### Module 7: Marketplace (Simulated) ✅ **BUILT (MVP)**
- Company posts role → rule-based interviewer match (domain + availability)
- Mock payment: ₹2000 → ₹1500 interviewer / ₹500 platform
- Two-way anonymization: handles only until hire decision

### Module 8: Dashboards + PDF Export ✅ **BUILT**
- **Student dashboard:** Session history, ability radar (recharts), mistake journal with features, integrity flags
- **Export:** Browser `window.print()` → Save as PDF (server-side pdfkit/weasyprint for production)

### Module 9: Voice, Fluency & Subtitles ✅ **BUILT**
- **STT:** Web Speech API (Chrome, continuous, interim results)
- **Filler words:** 12-word list keyword matching
- **Pauses:** >1.5s gap between interim results
- **Grammar:** LanguageTool public API (rate-limited)
- **Fluency score:** 100 - fillers×5 - pauses×4 - grammar×3

---

## 5. Evaluation Metrics

### Classifier Performance (Synthetic Data)
| Metric | Value |
|--------|-------|
| Training samples | 211 (1 real + 210 synthetic) |
| Test samples | 43 (20% stratified) |
| Accuracy (LogReg) | 1.00 |
| Accuracy (RF) | 1.00 |
| Macro F1 | 1.00 |
| Per-class recall | 1.00 all 6 labels |

*Note: 100% on synthetic is expected — synthetic generator uses feature signatures that perfectly separate classes. Real-world accuracy will be lower and must be measured after Step 12 user testing.*

### Adaptive Engine Validation
- **ASSISTments dataset test:** [TO BE RUN — cite in final report]
- **Behavioral test:** Two users with different weak topics (DSA vs Communication) receive visibly different question sequences

### Integrity Detection Rates (Manual Test)
| Signal | Tested | Detection |
|--------|--------|-----------|
| Tab switch | ✅ | Immediate |
| Fullscreen exit | ✅ | Immediate |
| Copy-paste | ✅ | On paste |
| Face absent | ✅ | Within 500ms |
| Latency >30s | ✅ | Flagged |
| Code similarity ≥0.8 | ✅ | Flagged |

### Fluency Scoring Correlation
| Metric | Human Rating (1-5) | Fluency Score (0-100) |
|--------|-------------------|----------------------|
| Low fillers, no pauses, good grammar | 5 | 90-100 |
| Moderate fillers, some pauses | 3 | 50-70 |
| High fillers, long pauses, grammar errors | 1 | 20-40 |

---

## 6. Built vs Vision (Per PRD)

| Fully Built (MVP) | Simulated / Phase 2 |
|-------------------|---------------------|
| AI interview engine + calibration + modes | Real payment gateway (Razorpay/Stripe) |
| Adaptive ML question model (BKT-lite) | Full marketplace matching at scale |
| Resume-aware questioning | Real interviewer payout dashboard |
| Mistake classifier + fluency + explainability | Multi-language support |
| Live code IDE + code similarity | — |
| Anti-cheat signals | — |
| Dashboards + PDF export | — |
| Subtitles (English) | — |

---

## 7. Tech Stack (Locked)

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Node.js (Express) + Socket.io |
| LLM | Groq API (Llama-3.3-8B) + Gemini fallback |
| ML | scikit-learn (Logistic Regression) |
| Voice | Web Speech API (Chrome) |
| Face | face-api.js / @vladmandic/human (BlazeFace) |
| Blockchain | Solidity + Hardhat (Sepolia testnet) |
| PDF parsing | pdf-parse (Node) |
| Code execution | Judge0 free-tier API |
| Charts | Recharts |
| Editor | Monaco Editor |

---

## 8. Reproducibility & Run Commands

```bash
# 1. Backend
cd backend
cp .env.example .env  # Add GROQ_API_KEY, GEMINI_API_KEY
npm install
npm run dev  # http://localhost:4000

# 2. Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173

# 3. ML (retrain)
cd ml
python3 generate_synthetic.py
python3 train_classifier.py
python3 infer.py  # test inference

# 4. Blockchain (Sepolia)
cd blockchain
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 9. Future Work (Post-MVP)

1. **Real user data collection** — 150+ labeled answers from classmates → retrain classifier
2. **BKT/IRT upgrade** — pyBKT library for true Bayesian knowledge tracing
3. **Persistent database** — PostgreSQL/MongoDB for session persistence
4. **Real payment integration** — Razorpay sandbox → production
5. **Multi-language STT** — Whisper.cpp or browser SpeechRecognition lang support
6. **Gaze tracking research** — Only if academically validated, not for MVP
7. **Mobile responsive** — PWA for phone practice

---

## 10. Appendix

### A. API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/interview/start | Create session, return screening+calibration |
| POST | /api/interview/screening | Submit screening answer |
| POST | /api/interview/calibration | Submit calibration answer |
| POST | /api/interview/message | Get next AI question (with fluency/latency) |
| POST | /api/code/run | Execute code against test cases |
| POST | /api/code/similarity | Check code vs known solution |
| POST | /api/integrity/log | Log integrity event |
| POST | /api/marketplace/role | Post role (company) |
| POST | /api/marketplace/match | Match interviewer |
| POST | /api/marketplace/payment | Mock payment split |

### B. Key Files
| File | Purpose |
|------|---------|
| `backend/routes/interview.js` | Core interview flow |
| `backend/services/adaptive.js` | Ability estimation |
| `backend/services/classifierClient.js` | Python ML bridge |
| `ml/feature_extractor.py` | 9-feature extraction |
| `ml/train_classifier.py` | Training pipeline |
| `ml/infer.py` | Inference + explainability |
| `frontend/src/components/SessionView.jsx` | Main interview UI |
| `frontend/src/hooks/useSpeech.js` | Voice + fluency |
| `frontend/src/components/IntegrityMonitor.jsx` | Anti-cheat UI |

### C. Demo Checklist for Viva
- [ ] Student login → Screening → Calibration → Adaptive → Report → PDF
- [ ] Technical persona: coding question in Monaco → run tests → submit
- [ ] HR persona: STAR question → mistake tag with features shown
- [ ] Live Room: Voice answer → fluency score displayed
- [ ] Anti-cheat: Tab switch → flag appears in real-time
- [ ] Company: Post role → match → mock payment
- [ ] Dashboard: Radar chart, mistake journal, export PDF

---

## 11. Team Contributions

| Member | Modules | Key Contributions |
|--------|---------|-------------------|
| [Name] | 1, 2, 7 | LLM prompts, adaptive engine, marketplace |
| [Name] | 3, 4, 6 | Resume parsing, classifier, anti-cheat |
| [Name] | 5, 8, 9 | Code IDE, dashboards, voice/fluency |

---

*Generated from InterviewSpar codebase. Fill in [bracketed] sections before submission.*
