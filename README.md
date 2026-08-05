# InterviewSpar

AI-adaptive interview practice platform. Students practice HR/technical interviews against an
AI interviewer that adapts question difficulty, checks for cheating, and syncs live code typing.

## Stack (locked — see docs/rules.md)

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js (Express) + socket.io |
| LLM | Groq API (Llama) — Gemini as fallback |
| ML | scikit-learn (Python) |
| Voice | Web Speech API |
| Face heuristic | face-api.js / MediaPipe (browser-side) |
| Blockchain | Solidity + Hardhat, Sepolia testnet |
| PDF parsing | pdf-parse (Node) |
| IDE | Monaco editor |

## Getting started

```bash
# 1. copy env template and fill real keys locally (never commit .env)
cp .env.example .env

# 2. install + run backend
cd backend && npm install && npm run dev

# 3. in another terminal, install + run frontend
cd frontend && npm install && npm run dev
```

Frontend default: http://localhost:5173
Backend default:  http://localhost:4000  (health check: /api/health)

## Repo layout

```
interviewspar/
├── frontend/    React + Tailwind app (chat, resume upload, dashboard)
├── backend/     Express + socket.io API server
├── blockchain/  Solidity contract + Hardhat config (Sepolia)
├── ml/          labeled data + classifier training/eval scripts
├── docs/        PRD, design, rules, steps, architecture, task log
└── .env.example placeholders for all secrets
```

See `docs/` for full product, design, and build-sequence docs.
