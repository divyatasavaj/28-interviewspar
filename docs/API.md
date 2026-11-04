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
  "allow_ai": false,
  "response_mode": "voice"
}
```

Personas: `hr`, `technical` (`tech` alias accepted). Modes: `practice`, `assessment`.
React uses `response_mode: "voice"`; omitted response mode defaults to `text` for
legacy API compatibility. Voice questions request spoken algorithm explanations
instead of code. `POST /api/interview/{id}/voice` upgrades owned active older sessions
idempotently, preserving saved answers and converting pending coding prompts.
An actual upgrade increments the session revision; concurrent changes are checked.
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
  "delivery": {"consent": true, "transcript": "I am preparing for a backend role...", "transcript_complete": true, "language": "en-IN"},
  "latency_ms": 42000,
  "skipped": false
}
```

Voice answers require a nonempty consented `delivery.transcript` matching `answer`;
written replacements and code are rejected with 422. An explicit skip needs no speech.
Answers allow 12,000 characters. Legacy text-mode coding accepts JavaScript/Python
code (50,000 characters) with an explanation, or an explicit skip. The request ID is retained for retries: reuse it after a lost response.
A stale revision/question returns 409 and the client reloads session state.
Concurrent requests may both call an external evaluator, but only one can advance
the stored revision. There is no paid/billing guarantee tied to evaluation count.

Reports expose `overall_score`, `score_label`, `score_note`, `round_scores`,
`qa_pairs`, `strengths`, `weaknesses`, `suggested_improvements`, and answer/skip
counts. The legacy `communication_score` field now displays as an answer structure indicator
(keyword/length cues); it does not verify relevance or spoken fluency. Correctness is distinct.
Skipped answers have null scores and are excluded from coaching summaries.
Behavioral questions never receive technical correctness, and technical difficulty
requires evaluated correctness. No evaluated correctness
means **null**, not zero or a passing grade. Reports can be requested while active.

## Optional delivery observations

`POST /api/interview/answer` requires `delivery` for voice answers (omit or null
only for legacy text-mode answers or skipped questions). This object requires `consent: true`, an optional original recognized
`transcript` (≤12,000 characters), `transcript_complete` (boolean; false disables pace estimation), `language` (`en-IN`, `en-US`, `en-GB`), and optional:

- `audio`: `capture_ms`, `observed_ms`, `voiced_ms`, `speech_span_ms`, `pause_count`,
  `pause_ms`, `longest_pause_ms`, `sample_count`, `clipped_samples`.
- `camera`: `samples`, `face_samples`, `centered_samples`, `multiple_samples`.
- `focus`: `observed_ms`, `hidden_ms`, `hidden_count`.

Confidence self-ratings and client-calculated scores are not accepted. The server
computes `behavior` containing `fluency_score`, `confidence_cue`,
`attention_cue_percent`, evidence, eligibility and the heuristic version. See the
feature guide for exact thresholds/formulas and limits.

Durations are nonnegative integer milliseconds capped at one hour; counts are
bounded integers. Invalid duration/count relationships, unconsented data and
unknown observation fields return 422. Browser observations are not independently
verified. No audio/video upload endpoint is needed or enabled.

The server derives `evaluation.delivery` for non-skipped answers, including filler
counts, eligible words/minute, coverage, camera/tab percentages, automatic delivery cues,
coaching and measurement limits. Missing measurements remain null. The raw voice
transcript is used to derive delivery counts and is the stored voice answer. Legacy
text-mode submissions can still store an edited answer separately. `delivery_summary` aggregates eligible answer observations in
reports. Ownership, idempotent retries and deletion follow the existing session.
See [measurement definitions](VOICE_VIDEO_INTERVIEW.md).

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
means unavailable. Compilation/runtime errors and invalid, non-finite, or excessively nested JSON output are failed
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

Application rate limits are process-local per IP: 30 credential attempts (POST
signup, login, and change-password) and 120 other requests, including profile reads,
per minute. Production ingress must provide shared limits and trusted proxy
configuration. Responses are marked `no-store`. `/api/interview/v2`, `/api/video`,
old `/api/sessions`, `/api/answers`, marketplace/admin, and socket endpoints are
not mounted by FastAPI.
