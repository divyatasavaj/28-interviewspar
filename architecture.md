# architecture.md — InterviewSpar

## 1. High-Level Flow
```
Student → Upload Resume → Choose Round (HR/Tech) 
   → AI Interviewer asks question (LLM)
   → Student answers (text/voice)
   → Feature Extractor pulls signals (STAR presence, filler words, pace, hedge words)
   → Mistake Classifier (ML) tags the mistake type
   → Adaptive Engine picks next question difficulty
   → Repeat for N questions
   → Session Report generated (mistake journal + score)
   → If threshold met → Blockchain Certificate minted (Sepolia testnet)
```

## 2. System Layers

**Client Layer (Frontend)**
- React app: chat interface, resume upload, live dashboard, session history
- Web Speech API: voice input + filler-word/pace detection
- face-api.js / MediaPipe: basic face-presence check (in-browser, no server upload of video)

**Application Layer (Backend)**
- Node.js/Python API server
- Session state management (current round, question count, running score)
- Resume parser (PDF → text → structured summary for LLM context)
- Adaptive difficulty logic (rule-based scoring on weak-category history)

**Intelligence Layer**
- LLM (Groq/Llama): generates interviewer questions, follow-ups, persona behavior
- Feature Extractor: LLM-assisted + rule-based (STAR keywords, hedge-word count, answer length, filler count, pace)
- ML Classifier: Logistic Regression / Random Forest on extracted features → mistake category

**Trust Layer (Blockchain)**
- Solidity smart contract on Sepolia testnet
- Mints a certificate (hash/NFT-like record) when score threshold is crossed
- Publicly verifiable, tamper-proof

## 3. Suggested File/Folder Structure
```
interviewspar/
├── frontend/
│   ├── src/
│   │   ├── components/       (ChatUI, ResumeUpload, Dashboard, SessionReport)
│   │   ├── hooks/             (useSpeech, useFaceDetect, useSession)
│   │   ├── pages/
│   │   └── App.jsx
├── backend/
│   ├── routes/                (interview.js, resume.js, certificate.js)
│   ├── services/
│   │   ├── llm_service.py     (Groq API calls, prompt templates)
│   │   ├── feature_extractor.py
│   │   ├── classifier.py      (trained model inference)
│   │   └── adaptive_engine.py
│   ├── models/                (trained classifier .pkl file)
│   └── server.py
├── blockchain/
│   ├── contracts/
│   │   └── Certificate.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── ml/
│   ├── data/                  (labeled sample answers)
│   ├── train_classifier.ipynb
│   └── evaluate.py
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── rules.md
│   ├── phases.md
│   └── design.md
└── README.md
```

## 4. Tech Stack
| Layer | Tech |
|---|---|
| Frontend | React, Tailwind CSS |
| Backend | Node.js (Express) or Python (FastAPI) |
| LLM | Groq API (Llama) |
| ML | scikit-learn (Logistic Regression / Random Forest) |
| Voice | Web Speech API |
| Face heuristic | face-api.js or MediaPipe (browser-side) |
| Blockchain | Solidity + Hardhat, deployed on Sepolia testnet |
| PDF parsing | pdf-parse (Node) or PyPDF2 (Python) |
| Storage | JSON/SQLite for MVP (no need for heavy DB) |

## 5. Data Flow Notes
- Video/audio never leaves the browser for face-presence check — processed client-side only (privacy + simpler scope)
- Resume text is parsed once per session, cached in session state
- Classifier runs server-side on extracted features only (not raw text) — keeps it fast and defensible in viva
