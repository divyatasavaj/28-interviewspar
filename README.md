# InterviewSpar

Interview practice with saved rounds, resume evidence analysis, optional AI feedback,
and an experimental coaching classifier. The supported application is **React +
Vite → FastAPI `/api` → MongoDB**. Older Express and interview-v2 implementations
are retained for reference but are not part of the default application.

## Run locally

Prerequisites: Python 3.13, Node.js 22.12+ (or 24), and an accessible MongoDB database.
The current test run used Python 3.13. Do not point tests at a personal or production database.

From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` locally: set `MONGODB_URL`, `MONGODB_DATABASE`, and a random
`JWT_SECRET` (at least 32 random bytes). Never commit this file. MongoDB must be
running; startup checks connectivity and creates indexes.

```sh
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` unchanged to port 8000.
Health: `http://127.0.0.1:8000/api/health`. Interactive API reference:
`http://127.0.0.1:8000/docs`. Backend `npm run dev` is also an alias for Uvicorn
when the virtual environment is activated; Node dependencies are not required for FastAPI.

## Current journey

1. Sign up, sign in, and edit your profile. Password changes and logout revoke old tokens.
2. Optionally upload a text PDF or DOCX with storage consent. Resume Intelligence
   shows extracted evidence, role findings, job-description coverage, and recommendations.
3. Choose a domain, HR/technical track, and practice/assessment mode. Consent to
   storing the interview is required; external AI feedback is separately optional.
4. Complete screening, calibration, HR, technical/coding where applicable,
   behavioral questions, and reflection in one full-screen call with no round list.
   Join with speech consent, hear each question, and answer aloud. Captions are read-only;
   re-record if needed, then send the spoken answer. Progress and observations persist.
5. Review a report, print/save it as PDF, resume active interviews, or delete a session.
   Resume deletion also removes saved resume assessments.

Without Groq, the interview still runs using curated prompts and an explicitly
labeled keyword/length structure indicator. The call asks for spoken technical reasoning,
including algorithm explanations, without a code editor. Legacy API code execution is
separately bounded by Judge0; code never executes on the application host.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MONGODB_URL` | Required connection URI; keep credentials private |
| `MONGODB_DATABASE` | Database name, default `interspars` |
| `JWT_SECRET` | Required random signing secret |
| `CLIENT_ORIGIN` | Comma-separated allowed browser origins |
| `GROQ_API_KEY`, `GROQ_MODEL` | Optional evaluation, only for opted-in sessions |
| `JUDGE0_API_URL`, `JUDGE0_API_KEY` | Optional isolated execution service and `X-Auth-Token` |
| `API_PROXY_TARGET` | Optional Vite development proxy override |

Voice mode defaults to browser text-to-speech; online Edge TTS is optional and
falls back to the browser when unavailable. Browser dictation may use the browser
vendor's speech service. Use Chrome or Edge with microphone permission on localhost
or HTTPS. Voice mode must be joined again after a reload; capture never resumes
without a new user action.

Delivery reports show transcript fillers, microphone-based speech/pauses and pace,
local face presence/framing, tab visibility, and automatic speech-flow, confidence,
and attention cues. There is no confidence self-rating or written-answer option.
Confidence describes vocal steadiness; attention combines camera presence and tab
visibility. These are documented practice heuristics, not validated psychological
measurements. Unavailable observations stay null.
Camera frames and raw microphone audio are never stored or uploaded by InterviewSpar.
The face model loads locally only when the camera is enabled. See
[the delivery feature guide](docs/VOICE_VIDEO_INTERVIEW.md) for definitions and limits.

## Checks

```sh
source .venv/bin/activate
cd backend
python -m unittest discover -s tests -q
cd ..
python -m unittest discover -s ml -p 'test_*.py' -q
cd frontend
npm test
npm run build
npm run lint
```

Backend HTTP tests use synthetic in-memory collections and mocked providers.
They do not establish live MongoDB, Groq, Judge0, or browser acceptance.
See [TODO.md](TODO.md) for the exact verification record and outstanding tasks.
The separate [site verification report](docs/SITE_TEST_REPORT.md) documents live
database and Chrome checks, their opt-in commands, confirmed fixes and remaining limits.

## Project reference

- [Architecture and source map](architecture.md): folders, important files, database, execution flows, and risks.
- [Follow-up quality review](docs/QUALITY_REVIEW.md): confirmed bugs, accuracy corrections, and test results.
- [API contract](docs/API.md): supported endpoints, payloads, errors, and lifecycle.
- [Deployment](docs/DEPLOYMENT.md): container build, reverse proxy, storage, and service requirements.
- [ML guide](ml/README.md): features, training, evaluation, and limitations.
- [Resume intelligence design and implementation record](docs/RESUME_INTELLIGENCE_IMPLEMENTATION_PLAN.md).

The classifier was trained mostly on synthetic examples and is not validated for
hiring decisions. Seed role rubrics are provisional; unavailable scores stay null.
Payments, human-interviewer matching, live socket rooms, automated anti-cheat,
and certificate issuance are not enabled in the supported app.
