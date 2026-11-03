# Supported API contract

Base path `/api`; FastAPI OpenAPI is available at `/openapi.json` and `/docs`.
JSON requests use `Content-Type: application/json`. Protected routes require
`Authorization: Bearer <access_token>`. All IDs are server-owned identifiers.
Missing/invalid/revoked authentication returns 401; another user's object returns 404.

## Authentication

| Method / path | Request | Response / behavior |
| --- | --- | --- |
| `GET /api/health` | Public | API version/status; startup separately checks MongoDB |
| `POST /api/auth/signup` | `{name,email,password}` | 201 `{access_token,token_type}`; duplicate email 409 |
| `POST /api/auth/login` | `{email,password}` | Token; invalid credentials 401 |
| `GET /api/auth/me` | Bearer | `{id,name,email,resume_status,target_role,experience_level,created_at}` |
| `PUT /api/auth/profile` | Optional `name,target_role,experience_level` | Updated user |
| `POST /api/auth/change-password` | `{old_password,new_password}` | Message and fresh `access_token`; wrong current password 400 |
| `POST /api/auth/logout` | No body | Revokes all outstanding tokens for this user |

Names must contain non-whitespace text. Passwords require 8+ characters and at most
72 UTF-8 bytes. JWTs expire after 24 hours and contain the stored token version.
There are no password-reset, account-erasure, MFA, or role-administration endpoints.

## Resume evidence and matching

| Method / path | Request | Response / flow |
| --- | --- | --- |
| `POST /api/resume/upload` | Multipart `file`; `X-Data-Consent: true` | 201 `{id,parsed_data,summary,analysis}`; extraction → normalization → evidence → MongoDB |
| `GET /api/resume/latest` | No body | Latest owned raw text, summary, analysis, uploaded_at |
| `GET /api/resume/summary` | No body | Latest summary/parsed data/analysis |
| `GET /api/resume/analysis/latest` | No body | `{resume_id,uploaded_at,analysis}` |
| `DELETE /api/resume/` | No body | Deletes all owned resumes/assessments and clears profile pointer |
| `POST /api/resume/analysis/match` | `{target_role_id}` | 201 saved role assessment |
| `POST /api/resume/analysis/job-description` | `{job_description}` | 201 saved textual coverage assessment |
| `GET /api/resume/analysis/match/latest` | Optional `mode,target_role_id` query | Latest matching owned assessment |
| `GET /api/resume/analysis/match/{assessment_id}` | ID of form `ra_` + 24 hex digits | Owned assessment |

Upload allows text PDFs and DOCX up to 10 MB, with an 11 MB total request cap
including multipart overhead. Corrupt/unreadable/scanned-only documents return
an actionable client error and are not replaced with invented candidate facts.

Role IDs: `software-engineer-sde`, `frontend-developer`, `backend-developer`,
`data-analyst`, `machine-learning-engineer`. Modes: `role`, `job_description`.
JD text must contain 40–20,000 characters. A stored assessment records its
resume/catalog/rubric identity, evidence findings, score availability, limitations,
and recommendations. Current provisional role rubrics yield null aggregate scores;
JD coverage is a textual metric. It does not establish competence or employability.

Full JD text is not retained; its hash and extracted requirements are persisted.
Resume raw text is retained with consent. Deleting resumes does not rewrite facts
already saved as questions/answers in an interview; delete those sessions separately.
The detailed assessment schema is in OpenAPI and
`backend/app/resume_intelligence/assessment_schemas.py`.

## Interview lifecycle

| Method / path | Request | Response / flow |
| --- | --- | --- |
| `GET /api/interview/domains` | Public | `{domains:[...]}` |
| `POST /api/interview/start` | Settings below | 201 saved session and current question |
| `GET /api/interview/sessions` | Bearer | Up to 100 owned session summaries with overall_score, newest first; transcripts omitted |
| `GET /api/interview/{session_id}` | Bearer | Current session state, for reload/resume |
| `POST /api/interview/answer` | Answer below | Evaluate → atomic revision update → next question/completion |
| `POST /api/interview/{session_id}/complete` | No body | Idempotently finishes early; retains saved answers |
| `GET /api/interview/{session_id}/feedback` | Bearer | Measured partial or completed report |
| `DELETE /api/interview/{session_id}` | Bearer | Deletes owned session/answers and owned integrity rows |

Start request example (optional fields shown):

```json
{
  "name": "Practice Candidate",
  "domain": "Software Engineering",
  "experience": "student",
  "persona": "technical",
  "mode": "practice",
  "save_consent": true,
  "allow_ai": false
}
```

Personas: `hr`, `technical` (`tech` alias accepted). Modes: `practice`, `assessment`.
Unsupported domains or missing storage consent return 400. The session includes
`id`, `version`, `status`, `current_question`, `current_round`, `rounds`, `progress`,
saved `answers`, and creation/completion times. Question objects have `id`, `round`,
`type`, `prompt`, `difficulty`, and coding metadata where applicable.

Submit the IDs/revision from that response:

```json
{
  "session_id": "<session id>",
  "question_id": "screening-1",
  "version": 0,
  "request_id": "<unique UUID for this submission>",
  "answer": "I am preparing for a backend role...",
  "code": "",
  "language": "javascript",
  "latency_ms": 42000,
  "skipped": false
}
```

Answers allow 12,000 characters; code 50,000. Supported languages are JavaScript
and Python. A coding submission needs both code and an explanation, or an explicit
skip. The request ID is retained for retries: reuse it after a lost response.
A stale revision/question returns 409 and the client reloads session state.
Concurrent requests may both call an external evaluator, but only one can advance
the stored revision. There is no paid/billing guarantee tied to evaluation count.

Reports expose `overall_score`, `score_label`, `score_note`, `round_scores`,
`qa_pairs`, `strengths`, `weaknesses`, `suggested_improvements`, and answer/skip
counts. Communication and correctness are distinct. No evaluated correctness
means **null**, not zero or a passing grade. Reports can be requested while active.

## Code and speech

| Method / path | Request | Response / flow |
| --- | --- | --- |
| `GET /api/code/problems` | Bearer | Problem descriptions/starters; test cases omitted |
| `POST /api/code/run` | `{session_id,problem_id,language,code}` | Requires owned active matching question, calls isolated Judge0 |
| `GET /api/tts/voices` | Bearer | Supported voices and defaults |
| `POST /api/tts/synthesize` | `{text,voice?,rate?,pitch?}` | MP3 bytes, bounded to 6,000 text characters and 15s provider timeout |
| `GET /api/tts/speak` | Same fields as query parameters, Bearer | Compatibility MP3 response; prefer POST to keep text out of URLs |

Code results use `status: evaluated|unavailable|invalid`, `passed`, `total`,
`results`, and an optional message. Unconfigured/pending/unreachable provider
means unavailable. Compilation/runtime errors and non-JSON output are failed
tests. Two Sum accepts indices in either order. No expected outputs are sent
to submitted programs; the API compares the returned values itself.

Judge0 receives code with CPU/wall-time/memory/process/file limits and networking
disabled. It must be an independently secured service. The app never falls back
to Python `exec`, Node VM execution, or a local subprocess for submitted code.

## Errors and limits

Errors normally have `detail` as a string, validation array, or domain error
`{code,message}`. Client helpers normalize all three and retain HTTP status.
Common statuses: 400 invalid consent/settings, 401 authentication, 404 absent/foreign
resource, 409 state conflict, 413 request/file size, 415 unsupported document,
422 validation, 429 rate limit (`Retry-After`), 503 service unavailable.

Application rate limits are process-local per IP: 30 auth and 120 other requests
per minute. Production ingress must provide shared limits and trusted proxy
configuration. Responses are marked `no-store`. `/api/interview/v2`, `/api/video`,
old `/api/sessions`, `/api/answers`, marketplace/admin, and socket endpoints are
not mounted by FastAPI.
