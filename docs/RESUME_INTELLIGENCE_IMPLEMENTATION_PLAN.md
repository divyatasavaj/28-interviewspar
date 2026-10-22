# InterviewSpar Resume Intelligence & Job Readiness Analyzer

**Implementation plan and architecture decision record**

- Document version: 1.6
- Date: 2026-10-22
- Primary backend: FastAPI in `backend/app`
- Primary frontend: React/Vite in `frontend/src`
- Status: Phases 0-5 complete and validated; profile/dashboard and interview integration remain

This plan is based on repository inspection and public-source verification performed on 2026-10-21. It records observed repository behavior rather than assuming paths or features exist.

## A. Existing Architecture Audit

### A.1 Repository layout

| Area | Observed paths | Notes |
|---|---|---|
| FastAPI application | `backend/main.py`, `backend/app/` | Primary backend for the current account, resume, and interview pages |
| Legacy Express API | `backend/server.js`, `backend/routes/`, `backend/services/` | Port 4000 and Socket.IO; still present but not the primary API for the pages that use `frontend/src/api/auth.js` |
| React application | `frontend/src/main.jsx`, `frontend/src/App.jsx` | React 19, Vite 8, Tailwind 4 |
| Resume intelligence integration point | `frontend/src/pages/AccountManagement.jsx` | Profile and resume views already live here |
| ML workspace | `ml/` | scikit-learn training/evaluation scripts, separate from the FastAPI runtime |
| Blockchain | `blockchain/` | Separate Hardhat/Solidity project; not involved in resume scoring |
| Documentation | `docs/` and root `*.md` | Existing product documents are at repository root |

### A.2 Frontend routes and components

Routes are declared in `frontend/src/App.jsx`:

- `/account` -> `frontend/src/pages/AccountManagement.jsx` (protected)
- `/dashboard` -> `frontend/src/pages/Dashboard.jsx` (protected)
- `/interview-type` -> `frontend/src/pages/InterviewType.jsx` (protected)
- `/interview` -> `frontend/src/pages/Interview.jsx` (protected)
- `/interview-complete` -> `frontend/src/pages/InterviewComplete.jsx` (protected)

`frontend/src/pages/AccountManagement.jsx` already contains:

- `ProfileView` (profile details, target role text field, experience level, password change)
- `ResumeView` (PDF/DOCX upload and parsed-data display)
- `ReportsView`
- `PreferencesView`
- The account sidebar and responsive layout

The profile page currently treats the target role as free text and initializes it with `user.target_role || "Software Engineer"`. This is incompatible with the new requirement that the role be optional and clearable.

There are two frontend API clients:

- `frontend/src/api/auth.js`: hardcoded `http://localhost:8000`, token in `sessionStorage`, used by current account/dashboard/interview pages.
- `frontend/src/api.js`: base `/api`, token in `localStorage`, used by older/dormant components such as `AuthContext.jsx`, `ProfileCard.jsx`, and `SessionView.jsx`.

`frontend/src/main.jsx` does not mount `AuthProvider`. The current protected routes rely on `getToken()` from `frontend/src/api/auth.js`. The resume-intelligence UI should therefore use `frontend/src/api/auth.js` for consistency and must not silently switch token storage.

### A.3 Authentication and authorization

- JWT handling: `backend/app/auth.py`.
- Password hashing: bcrypt.
- Token payload: `sub` user id plus expiry; 24-hour lifetime.
- Current dependency duplication:
  - `require_user` in `backend/app/routes/auth.py`
  - `require_token` in `backend/app/routes/resume.py`
  - `require_user_id` in session/report/answer routers
- User ownership is enforced inconsistently by selecting on both `user_id` and resource id in some routers; the resume router filters list queries by `user_id`.
- `GET /auth/me` and `PUT /auth/profile` are the existing profile API.
- `PUT /auth/profile` ignores blank target roles, so the current API cannot clear a target role.

### A.4 Resume pipeline as observed before Phase 2

`backend/app/routes/resume.py`:

1. `POST /resume/upload` accepts PDF or DOCX up to 10 MB.
2. `extract_text()` reads the entire upload into memory and uses `pdfplumber` or `python-docx`.
3. `parse_with_groq()` asks Groq for JSON when a key is configured.
4. On missing key, exception, or unparseable response, `parse_heuristic_resume()` is used.
5. The pre-Phase-2 heuristic parser **fabricated fallback education, project, and experience records** when none were found. Those records were never authoritative and have been removed from the active path.
6. The raw text and summary are duplicated into `users.resume`; a separate document is inserted into `resumes`.
7. `GET /resume/latest` returns the newest `resumes` document and the summary stored on `users`.
8. `GET /resume/summary` reads only `users.resume`.

The legacy Express resume route (`backend/routes/resume.js`) uses `pdf-parse` and has a lenient fallback, but current account/interview pages call the FastAPI route through `frontend/src/api/auth.js`.

**Phase 2 update:** the authoritative FastAPI resume path no longer calls Groq or a heuristic fallback parser. `backend/app/resume_intelligence/parser.py` now validates and extracts PDF/DOCX content, detects section boundaries, groups canonical skill evidence, and extracts only sections explicitly present in the document. The compatibility `parsed_data` shape is derived from that evidence and can contain empty lists; it never adds placeholder education, project, or experience records.

### A.5 MongoDB usage

Database configuration is in `backend/app/database.py`:

- Database name: `interspars`
- `MONGODB_URL` is read at module import time with `os.environ[...]`, so importing the app without it raises immediately.
- `init_db()` creates indexes for `users`, `questions`, `sessions`, `answers`, `integrity_logs`, `reports`, `feedback`, `resumes`, and `video_sessions`.
- `resumes` now has a `(user_id, _id)` index. New resume documents include `analysis_schema_version`, `parser_version`, and `catalog_version`; legacy documents remain readable.
- User documents currently contain `name`, `email`, `hashed_password`, optional `resume`, and optional `target_role`/`experience_level`.

### A.6 FastAPI route conventions

Observed routers and prefixes:

| Router | Prefix |
|---|---|
| `backend/app/routes/auth.py` | `/auth` |
| `backend/app/routes/resume.py` | `/resume` |
| `backend/app/routes/interview.py` | `/interview` |
| `backend/app/routes/questions.py` | `/questions` |
| `backend/app/routes/sessions.py` | `/sessions` |
| `backend/app/routes/answers.py` | `/answers` |
| `backend/app/routes/reports.py` | `/reports` |
| `backend/app/routes/feedback.py` | `/feedback` |
| `backend/app/routes/integrity.py` | `/integrity` |
| `backend/app/routes/video.py` | `/video` |
| `backend/app/routes/tts.py` | `/tts` |

The app initializes MongoDB in the FastAPI lifespan and uses a hardcoded CORS list for `localhost:5173` and `127.0.0.1:5173`.

### A.7 LLM and ML integrations

- Interview LLM: Groq/Llama in `backend/app/routes/interview.py`, with Gemini fallback.
- Resume parsing and summary: Groq directly in `backend/app/routes/resume.py`.
- There is no shared Python provider abstraction; fallback logic is duplicated.
- `ml/` uses pandas, NumPy, scikit-learn, and joblib. Those training dependencies are not in `backend/requirements.txt` and should not be imported by the resume scoring runtime.
- The existing classifier is for interview-answer mistakes, not resume/role matching. Resume scoring must remain deterministic and independent of that model.

### A.8 Configuration and tests

- Root `.env.example` documents LLM, backend, blockchain, and language-tool variables.
- It does **not** document `MONGODB_URL`, even though `backend/app/database.py` requires it.
- No test files, `pytest.ini`, `conftest.py`, Vitest config, or Jest config were found.
- Local environment check: Python 3.11.0 and pytest 7.4.4 are available.
- Frontend has `npm run build`, `npm run lint`, and `npm run dev`; there is no frontend test script.

### A.9 Reusable integration points

- Authentication dependency patterns in `backend/app/routes/auth.py`.
- MongoDB dependency in `backend/app/database.py`.
- Existing user and resume documents.
- Existing `ResumeView` and `ProfileView` UI patterns in `frontend/src/pages/AccountManagement.jsx`.
- Existing FastAPI router registration in `backend/main.py`.
- Existing interview track route and report storage, which can later receive resume-gap practice recommendations without merging score domains.

### A.10 Conflicts, risks, and required decisions

1. **Optional-role conflict:** the current user schema returns a default `"Software Engineer"` and cannot clear it. Migration must not assume existing users intentionally selected that role.
2. **Fabricated resume evidence:** the heuristic parser invents education/project/experience records. The new evidence extractor must not consume those placeholders as factual evidence.
3. **Duplicate frontend clients:** use `frontend/src/api/auth.js` for new pages; do not migrate authentication storage as part of this feature.
4. **No schema migration framework:** Mongo collections are schemaless. New documents need explicit `schema_version` fields and idempotent upsert scripts.
5. **No test harness:** Phase 1 adds tests using the standard library so it does not introduce a new runtime dependency.
6. **Licensing uncertainty:** NCO and NSDC source files cannot be assumed redistributable. See Section C.
7. **No production MongoDB credentials are assumed locally.** Database writes must be optional; validation and import dry-runs must work without a database connection.

## B. Functional Requirements

The feature is optional. A user with no target role keeps the current interview and resume workflow unchanged.

1. **Optional target job role**
   - A canonical `target_role_id` is stored separately from the legacy free-text `target_role`.
   - The user can search/select a role and can clear it.
   - Existing users are treated as not having configured a canonical role until they explicitly select one.
   - No page, interview flow, or dashboard requires a target role to function.
2. **Resume parsing and structured extraction**
   - Extract contact section, summary, skills, education, experience, projects, certifications, tools, and measurable outcomes.
   - Preserve source spans/section provenance for every extracted skill so it can be audited.
   - Deterministic extraction is authoritative; LLM extraction is optional enrichment with confidence and validation.
3. **Role and job-description matching**
   - Role-based mode compares the resume against an approved, versioned role rubric.
   - Job-specific mode extracts requirements from a user-supplied job description and compares them against the same resume evidence model.
   - The two modes are visibly distinct.
4. **Evidence-based requirement rubrics**
   - Every requirement has an importance tier and provenance.
   - Rubrics carry a version, status (`provisional`, `approved`, or `retired`), sample size, confidence, and source references.
5. **Explainable scoring**
   - Scores are deterministic functions of stored inputs.
   - Every score component returns its formula version, rubric version, matched requirements, evidence factors, and missing inputs.
   - The UI shows explanations, not only a number.
6. **Missing skills and weak evidence**
   - Distinguish `absent`, `declared_only`, `applied_without_outcome`, `demonstrated_with_outcome`, and `low_confidence`.
   - A skill listed in a skills section is not equivalent to a skill used in a project or internship.
7. **Personalized recommendations**
   - Recommendations identify the gap, the evidence, the importance, the action, and a confidence level.
   - Recommendations never invent experience, certifications, metrics, employers, or achievements.
8. **ATS and formatting checks**
   - Check parseable text, section headings, use of tables/columns that break extraction, contact/basic structure, keyword use, and bullet readability.
   - ATS checks are separate from the role match score and never use face/video signals.
9. **Resume version history and comparisons**
   - Each upload creates a version record or references an existing version.
   - Analyses are linked to a resume version and rubric version.
   - Before/after comparisons explain which requirement evidence changed.
10. **Interview preparation integration**
    - Map gaps to existing technical/HR practice tracks.
    - Keep resume readiness and interview readiness as separate measurements.

## C. Indian Job-Market Dataset Strategy

### C.1 Verified source status (2026-10-21)

| Source | Official URL | Observed format and acquisition | Licensing/usage finding | Status and intended use |
|---|---|---|---|---|
| ESCO | https://esco.ec.europa.eu/en/use-esco/download | Dataset v1.2.1; RDF, TTL, ODS, CSV, XML, JSON-LD; download requires privacy-statement acceptance and email delivery | Download page states the dataset is free of charge; dataset-specific license text must be captured from the downloaded package/legal notice before ingestion. Do not assume unrestricted commercial reuse. | Use occupation/skill mappings and multilingual aliases after manual license review. |
| O*NET | https://www.onetcenter.org/database.html and https://www.onetcenter.org/license_db.html | Version 31.0; downloadable CSV/JSON/Excel; occupation, software-skills, tasks, essential-skills files verified | Content is CC BY 4.0 with attribution to O*NET 31.0 and U.S. DOL/ETA; modifications must be identified. | Primary machine-readable occupational crosswalk and supplementary skill/task evidence. |
| NCO 2015 / National Career Service | https://ncs.gov.in/ | NCS portal is client-rendered; direct guessed NCO document URLs returned the app shell, not a verified PDF. No NCO download was ingested. | NCS terms are governed by the Ministry of Labour & Employment; reuse must be confirmed from the actual publication. | Keep as a mapping target only until an authorized, versioned NCO file is archived. |
| NSDC Qualification Packs | https://www.nsdcindia.org/ and https://www.nsdcindia.org/qualification-packs | Dynamic portal; QPs are documents, not an unrestricted machine-readable bulk API | NSDC Terms of Use prohibit downloading/copying/reproducing content without written permission; the portal grants only a personal, revocable, non-transferable access license. | Link/reference only. Do not ingest QP text into a redistributed rubric without written permission. |
| Adzuna India API | https://developer.adzuna.com/ | Authenticated JSON API; app id/key required | Terms allow personal job search, ad publishing, Jobsworth estimates, and personal/academic research. Commercial analysis and product use require a license; resale/aggregation is restricted. | Optional adapter only after a license/agreement and retention review. Not a Phase 1 data source. |
| Kaggle | https://www.kaggle.com/datasets | Dataset-by-dataset; API/account authentication | Each dataset has its own license and provenance. | Candidate source only after per-dataset license and quality review. |
| Hugging Face datasets | https://huggingface.co/docs/hub/datasets-usage | Hub API/CLI; dataset card metadata | Each dataset has its own license; gated datasets require acceptance. | Candidate source only after per-dataset card/license review. |
| GitHub repositories | https://github.com/ | Repository files/APIs | Each repository has its own license; absence of a license means no reuse permission. | Candidate source only after repository/license/provenance review. |

No Indian job postings were downloaded in Phase 1. No source counts, frequencies, or market coverage are claimed in this document.

### C.2 Acquisition policy

- Prefer official downloadable data and authorized APIs.
- Never scrape LinkedIn, Naukri, or any site whose terms or access controls prohibit collection.
- Store a source manifest before parsing anything: source id, URL, retrieval timestamp, version, license text/hash, permitted-use note, retention rule, and redistribution flag.
- Store raw posting text only when the license and retention policy permit it. Otherwise store only normalized requirement evidence and aggregate statistics.
- Treat posted skill mentions as market signals, not hiring probabilities or causal requirements.
- Use one registered source adapter per source. A source without a passed compliance check stays disabled.

### C.3 Initial evidence policy

- A role rubric can be published as `provisional` with an evidence base of zero postings if it is explicitly labeled and has taxonomy/expert provenance.
- Phase 3 replaces the preliminary confidence labels with the versioned project policy in `backend/data/resume_intelligence/rubric_thresholds.v1.json`.
- Ingestion confidence is `low` below 50 eligible postings, `medium` from 50 postings, and `high` at 100 or more postings only when every configured evidence check passes.
- Meeting every evidence check changes the evidence tier to `threshold_met_pending_review`; it does not approve or validate the rubric. The rubric remains `provisional` and `validation.status` remains `not_reviewed`.
- These thresholds are project decisions for deciding when manual review has enough data. They are not universal labour-market truths or claims that 100 postings prove hiring requirements.
- A minimum sample size must be evaluated for feasibility, not treated as a launch blocker.
- Frequency is calculated only within the relevant role-specific posting sample after deduplication and experience filtering.

## D. Initial Job-Role Coverage

The Phase 1 taxonomy contains 35 canonical role families. Five have seed rubrics; the rest are catalogued so frontend/data expansion does not require React changes.

| Family | Canonical role id | Entry-level focus | O*NET crosswalk |
|---|---|---|---|
| Software engineering | `software-engineer-sde` | 0-3 years | 15-1252.00 |
| Software engineering | `frontend-developer` | 0-3 years | 15-1254.00 |
| Software engineering | `backend-developer` | 0-3 years | 15-1252.00 |
| Software engineering | `full-stack-developer` | 0-3 years | 15-1252.00 |
| Software engineering | `web-developer` | 0-3 years | 15-1254.00 |
| Software engineering | `mobile-app-developer` | 0-3 years | 15-1252.00 |
| Software engineering | `java-developer` | 0-3 years | 15-1252.00 |
| Software engineering | `python-developer` | 0-3 years | 15-1252.00 |
| Data and analytics | `data-analyst` | 0-3 years | 15-2051.00 (closest) |
| Data and analytics | `business-intelligence-analyst` | 0-3 years | 15-2051.01 |
| Data and analytics | `data-scientist` | 0-3 years | 15-2051.00 |
| Data and analytics | `data-engineer` | 0-3 years | 15-1243.00 (closest) |
| Data and analytics | `product-analyst` | 0-3 years | 15-2051.01 (closest) |
| AI and ML | `ai-engineer` | 0-3 years | 15-1221.00 (closest) |
| AI and ML | `machine-learning-engineer` | 0-3 years | 15-1221.00 |
| AI and ML | `nlp-engineer` | 0-3 years | 15-1221.00 (closest) |
| AI and ML | `computer-vision-engineer` | 0-3 years | 15-1221.00 (closest) |
| AI and ML | `generative-ai-engineer` | 0-3 years | 15-1221.00 (closest) |
| Cloud and infrastructure | `cloud-engineer` | 0-3 years | 15-1299.08 |
| Cloud and infrastructure | `devops-engineer` | 0-3 years | 15-1244.00 (closest) |
| Cloud and infrastructure | `site-reliability-engineer` | 0-3 years | 15-1244.00 (closest) |
| Cloud and infrastructure | `system-administrator` | 0-3 years | 15-1244.00 |
| Cybersecurity | `cybersecurity-analyst` | 0-3 years | 15-1212.00 |
| Cybersecurity | `soc-analyst` | 0-3 years | 15-1212.00 (closest) |
| Cybersecurity | `security-engineer` | 0-3 years | 15-1299.05 |
| Cybersecurity | `penetration-tester` | 0-3 years | 15-1212.00 (closest) |
| Testing and quality | `qa-engineer` | 0-3 years | 15-1253.00 |
| Testing and quality | `automation-test-engineer` | 0-3 years | 15-1253.00 |
| Testing and quality | `software-test-engineer` | 0-3 years | 15-1253.00 |
| Database | `database-administrator` | 0-3 years | 15-1242.00 |
| Database | `database-developer` | 0-3 years | 15-1243.00 |
| Business and solutions | `business-analyst` | 0-3 years | 15-1211.00 (closest) |
| Support and solutions | `technical-support-engineer` | 0-3 years | No verified direct crosswalk |
| Support and solutions | `solutions-engineer` | 0-3 years | 15-1299.08 (closest) |
| Product | `technical-product-analyst` | 0-3 years | 15-2051.01 (closest) |

Role normalization rules:

- Exact synonyms are aliases of one canonical id: e.g., SDE, Software Development Engineer, Software Engineer.
- Overlapping specializations share a `role_family_id` but retain separate ids only where requirements differ materially.
- Frontend/Backend/Full Stack/Web are distinct; Web Developer is marked as overlapping and may be retired after rubric validation.
- QA Engineer, Automation Test Engineer, and Software Test Engineer share a quality-engineering family; separate rubrics must not claim independent market evidence until each has its own sample.
- `closest` crosswalks are explicitly not presented as exact occupational equivalence.

## E. Canonical Skill Dictionary

Phase 1 adds `backend/data/resume_intelligence/skills.v1.json`, validated by the runtime catalog loader.

Each skill record contains:

- `skill_id` (stable slug)
- `canonical_name`
- `aliases`
- `category`
- `related_skill_ids`
- `taxonomy_refs` (source id, source record id, mapping quality)
- `match_policy` (currently `standard`; ambiguous terms additionally use `context_required_aliases`)
- `verification_status` (currently `curated_alias_reviewed`)
- `provenance_ids` (references the versioned provenance objects in the same file)

The Phase 1 dictionary contains 132 canonical skills. Role membership is not copied into skill records because requirement tiers belong to versioned rubrics.

Normalization rules:

- Unicode NFKC and case-folding are used for matching keys.
- Aliases are matched longest-first and spans are consumed so `React Native` is not also counted as `React`.
- Word-boundary checks prevent `Java` from matching `JavaScript` and `C` from matching `C++`.
- Short or ambiguous aliases (for example `C`, `R`, `Go`, `OS`) use `context_required_aliases` or explicit phrases such as `C programming`.
- Context-aware matching currently uses nearby words and rejects ambiguous aliases when that evidence is absent; section-aware filtering is deferred to Phase 2.
- Normalization output includes the matched alias, original-text span, method, confidence, and whether context was validated. Section attribution is added by the parser in Phase 2.

Initial coverage includes programming languages, frontend/backend frameworks, databases, cloud/DevOps tools, data/ML libraries, CS fundamentals, testing, security, methodologies, and collaboration skills. The catalog is data, not React logic.

## F. Job Rubric Generation Pipeline

1. **Acquire permitted source data.** Only sources with a passed `source_registry` compliance record.
2. **Store source metadata.** URL, version, retrieval time, license, checksum, retention/redistribution flags.
3. **Parse postings and occupational documents.** Preserve original section/task references where permitted.
4. **Normalize job titles.** Map to canonical role ids and record unmatched titles for review.
5. **Deduplicate postings.** Hash normalized title + company + location + description; discard near-duplicates.
6. **Filter by role and experience.** Keep entry-level/intern/0-3-year roles; retain exclusion reasons.
7. **Extract skills and responsibilities.** Deterministic aliases/taxonomy first; LLM enrichment only with validation.
8. **Normalize skills.** Use the canonical dictionary; retain unresolved terms for dictionary expansion.
9. **Calculate role-specific frequencies.** Denominator is the distinct relevant posting sample for that role only.
10. **Assign importance tiers.** `core`, `important`, `preferred`, `optional` using configurable thresholds plus authoritative taxonomy evidence.
11. **Add occupational competency mappings.** O*NET/ESCO-derived tasks and skills, clearly marked as crosswalks.
12. **Generate a versioned rubric.** Include requirements, provenance, sample size, confidence, and generation parameters.
13. **Manual review sample.** A reviewer checks a stratified sample and signs off or returns the rubric.
14. **Publish approved rubrics.** Only approved/provisional published rubrics are available to the scoring service.
15. **Refresh and track drift.** New source snapshots produce a new rubric version; old analyses retain their original version.

Guardrails:

- Never infer that a skill is required because it appeared once.
- Never convert frequency into a "probability of being hired."
- Never invent source counts or rubric weights.
- If evidence is insufficient, mark the rubric `provisional` and show the reason in the API/UI.

## G. Explainable Scoring Methodology

The first scoring engine is deterministic. It does not use the interview mistake classifier.

### G.1 Scores that remain separate

- **Resume Match Score**: evidence-adjusted alignment with one role rubric or one job description.
- **Role Fit Score**: fit to the user's stated interests, education, projects, and preferred role family. It is not a hiring probability.
- **ATS Readiness Score**: formatting, parseability, and structural checks.
- **Job Keyword Alignment**: only for job-specific mode.
- **Interview Readiness Score**: produced from interview sessions and reports; never folded into resume match.

No combination of these scores is presented as a probability of shortlisting.

### G.2 Requirement-level evidence

For each rubric requirement and resume evidence item:

| Evidence state | Meaning | Default factor |
|---|---|---|
| `absent` | No support in resume | 0.00 |
| `declared_only` | Appears only in a skills list | 0.35 |
| `applied_no_outcome` | Used in a project/internship but no outcome or scope | 0.65 |
| `demonstrated_with_outcome` | Used with a specific action and measurable/verifiable outcome | 1.00 |
| `low_confidence` | Ambiguous alias or OCR/parse uncertainty | capped by parser confidence |

The factors are versioned scoring-policy constants, not market probabilities. They are configurable and must be calibrated against human-reviewed samples in Phase 7.

### G.3 Match calculation

Role rubrics own role-specific requirement weights. The engine does not apply a universal category percentage:

```text
requirement_score = weight(requirement) * evidence_factor(evidence_state)
resume_match = 100 * sum(requirement_score) / sum(weight)
```

Rules:

- Weights are assigned per requirement from rubric evidence, occupational mapping, and manual review. Missing weights make a rubric unpublishable for scoring.
- Category sub-scores are displayed separately and derive from the same requirement records.
- Absence of evidence lowers the score but is labeled "not evidenced in this resume," not "the candidate lacks the skill."
- Low-confidence rubrics are visibly labeled and cannot claim precision.
- Every response includes `score_policy_version`, `rubric_id`, `rubric_version`, component values, and limits.

## H. Gap Analysis and Recommendation Engine

For each selected role, the engine reports:

- Missing core skills
- Missing important/preferred skills
- Skills mentioned without supporting evidence
- Projects that could be deepened
- Vague bullets and missing measurable outcomes
- Relevant certification or learning suggestions (as options, not requirements)
- Keyword gaps
- Formatting/readability issues

Recommendation record fields:

- `gap_type`
- `skill_id` or `format_issue_id`
- `evidence_ids` and resume spans
- `importance`
- `why_it_matters`
- `action`
- `suggested_learning_activity` (where appropriate)
- `reference` (source id/URL)
- `confidence`
- `user_status` (`open`, `completed`, `dismissed`)

Generation policy:

- Deterministic templates provide the base recommendation.
- LLM use is limited to wording and project-specific elaboration from verified resume facts.
- Generated bullets use placeholders such as `[add verified metric]` and ask the user to confirm.
- No recommendation may add a skill the user has not evidenced, invent an internship, invent a certification, or invent an achievement.
- Recommendations are ranked by importance x evidence deficit x actionability, with ties broken by core-skill coverage.

## I. Job Description Matching

### Mode 1: Role-based analysis

- Trigger: user selects a canonical target role.
- Input: latest resume version plus current approved/provisional role rubric.
- Output: "Based on aggregated market and occupational evidence for [role], rubric version [x]."
- Clearly identify provisional/low-evidence rubrics.

### Mode 2: Job-specific analysis

- Trigger: user pastes or uploads a job description.
- Input: resume version plus job-description text.
- Output: "Based on this job description," never "based on Indian market data."
- Extract explicit required/preferred skills, experience level, responsibilities, and education requirements from the JD.
- Job-description requirements take precedence for job-specific recommendations.
- Store only structured requirements and a hash by default; retain raw JD text only with explicit consent/retention policy.
- Treat JD and resume text as untrusted data, not instructions. Prompt-injection strings are neutralized and never allowed to change scoring rules or tool behavior.

## J. Data Model and MongoDB Schema

All new documents carry `schema_version`. Reuse `users` and `resumes`; do not duplicate resume files or sensitive profile data.

### J.1 `users` extensions

| Field | Type | Notes |
|---|---|---|
| `target_role_id` | string/null | Canonical role id; null means not configured |
| `target_role_label` | string/null | Display copy only |
| `target_role_configured` | boolean | Explicit opt-in marker; default false |
| `target_role_updated_at` | datetime | Audit |
| `experience_level` | string | Existing field; validate against allowed values |

Migration:

- Add `target_role_id: null` and `target_role_configured: false` to existing users.
- Keep the legacy `target_role` text for backward compatibility/display.
- Do not automatically convert the old default `"Software Engineer"` into an explicit canonical selection.

### J.2 `skill_taxonomy`

Fields: `skill_id`, `catalog_version`, `canonical_name`, `aliases`, `category`, `related_skill_ids`, `taxonomy_refs`, `match_policy`, `verification_status`, `provenance`, `schema_version`.

Indexes: unique `(skill_id, catalog_version)`, `category`, `aliases`.

### J.3 `role_taxonomy`

Fields: `role_id`, `catalog_version`, `canonical_title`, `family_id`, `aliases`, `description`, `entry_level_min_years`, `entry_level_max_years`, `taxonomy_refs`, `rubric_status`, `status`, `schema_version`.

Indexes: unique `(role_id, catalog_version)`, `family_id`, `aliases`, `rubric_status`.

### J.4 `source_registry`

Fields: source id, official URL, title, format, retrieval method, version, retrieved_at, license name/text hash, permitted use, retention, redistribution, status, review notes.

Index: unique `source_id`.

### J.5 `job_postings`

Phase 3 fields: `record_id`, `content_fingerprint`, `source_id`, `source_posting_id`, permitted `source_reference_url`, published title, `normalized_role_id`, employer name, normalized city/state/country, required/preferred/mentioned canonical skill IDs, per-skill extraction evidence, skill-extraction confidence, experience min/max, education, employment type, posted/collected dates, source license status/name, content kind, dataset version, `duplicate_of`, and duplicate kind.

Indexes: unique `record_id`, `content_fingerprint`, `(normalized_role_id, posted_at)`.

Only normalized, permitted fields are stored. Raw descriptions are used in memory for skill extraction and are not persisted. A unique `run_id` records each ingestion run in `job_market_ingestion_runs`; review terms are stored in `unknown_job_skills`.

### J.6 `role_rubrics`

Fields: `rubric_id`, `role_id`, `version`, `status`, `created_at`, `approved_at`, `source_snapshot_ids`, `sample_size`, `confidence`, `confidence_reasons`, `provenance_mode`, `requirements[]`, `dimensions[]`, `score_policy_version`, `validation`, `schema_version`.

Requirement fields: `requirement_id`, `skill_id`, `importance`, `weight`, `weight_status`, `rationale`, `source_refs`, `evidence_expectations`.

Indexes: unique `(rubric_id, version)`, `(role_id, status, created_at)`.

### J.7 `resume_analyses`

Fields: `analysis_id`, `user_id`, `resume_id`, `resume_version`, `mode` (`role`/`job_description`), `role_id`, `rubric_id`, `rubric_version`, job-description metadata, `scores`, `score_components`, `matched_requirements`, `missing_requirements`, `weak_evidence`, `ats_findings`, `confidence`, `limitations`, `created_at`, `schema_version`.

Indexes: `(user_id, created_at)`, `(user_id, role_id, created_at)`, `analysis_id` unique.

### J.8 `resume_skill_evidence`

Fields: `analysis_id`, `user_id`, `skill_id`, `source_section`, `source_span`, `evidence_state`, `evidence_text`, `extraction_method`, `extraction_confidence`, `project_or_experience_id`.

Indexes: `(analysis_id, skill_id)`, `(user_id, skill_id)`.

### J.9 `recommendations`

Fields: `recommendation_id`, `analysis_id`, `user_id`, `gap_type`, `skill_id`, `importance`, `priority`, `evidence_ids`, `action`, `learning_activity`, `reference`, `confidence`, `user_status`, `created_at`, `completed_at`.

Indexes: `(user_id, user_status, priority)`, `analysis_id`.

### J.10 Resume versions

Use the existing `resumes` collection as the version store where possible. Add:

- `user_id` index
- `content_hash`
- `version`
- `source_filename`
- `mime_type`
- `parser_version`
- `uploaded_at`
- `is_active`

Do not duplicate the raw resume into both `users.resume` and a new collection. Keep `users.resume` as a backward-compatible pointer/summary during migration; new code reads `resumes`.

### J.11 Ownership and deletion

- Every user-specific collection is queried with both resource id and `user_id`.
- Foreign key relationships are logical ObjectId/string references; Mongo does not enforce them, so service-layer checks are mandatory.
- Deletion removes analyses, evidence, recommendations, and derived excerpts; resume deletion follows the retention policy.

## K. FastAPI API Design

Existing routes were reviewed to avoid collisions. Final proposed routes:

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/job-roles` | yes | List canonical roles, optional search/family filter |
| GET | `/job-roles/{role_id}` | yes | Role detail plus rubric availability/confidence |
| PUT | `/auth/profile` | yes | Extend existing profile update with `target_role_id`, `clear_target_role` |
| POST | `/resume/analyze` | yes | Role-based analysis using latest or specified resume |
| POST | `/resume/job-fit` | yes | Job-specific analysis (renamed from `/resume/job-description-analysis` for clarity) |
| GET | `/resume/analysis-history` | yes | Paginated user analyses |
| GET | `/resume/analysis/latest` | yes | Latest structured extraction and evidence for the authenticated user |
| GET | `/resume/analysis/{analysis_id}` | yes | Full analysis, ownership checked |
| GET | `/resume/analysis/{analysis_id}/compare/{other_analysis_id}` | yes | Before/after comparison |
| POST | `/resume/analysis/{analysis_id}/recommendations/{recommendation_id}` | yes | Mark recommendation complete/dismissed |
| GET | `/job-roles/{role_id}/rubric` | yes | Published rubric with provenance, if available |

### K.1 Request examples

`PUT /auth/profile`

```json
{
  "name": "Asha Rao",
  "target_role_id": "backend-developer",
  "target_role_label": "Backend Developer",
  "experience_level": "intern",
  "clear_target_role": false
}
```

Clearing:

```json
{"clear_target_role": true}
```

`POST /resume/analyze`

```json
{"role_id": "backend-developer", "resume_id": null}
```

`POST /resume/job-fit`

```json
{
  "job_description_text": "...",
  "resume_id": null,
  "retain_job_description": false
}
```

### K.2 Response shape

```json
{
  "analysis_id": "...",
  "mode": "role",
  "role": {"id": "backend-developer", "title": "Backend Developer"},
  "rubric": {"id": "backend-developer@2026.10.1", "version": "2026.10.1", "status": "provisional", "confidence": "low"},
  "scores": {
    "resume_match": 61,
    "score_policy_version": "score-v1",
    "components": [
      {"dimension": "core_technical", "score": 58, "weight": 0.55, "explanation": "..."}
    ]
  },
  "matched": [],
  "missing": [],
  "weak_evidence": [],
  "recommendations": [],
  "limitations": ["Rubric is provisional: no Indian posting sample ingested."]
}
```

### K.3 Validation and errors

- 413: upload exceeds 10 MB or extracted text exceeds the parser limit.
- 415: unsupported extension, MIME/extension mismatch, invalid file signature, invalid DOCX, or macro-enabled DOCX.
- 422: empty document, unreadable/corrupt PDF or DOCX, too many PDF pages, or a scanned PDF with no extractable text.
- 401: missing/invalid/expired JWT.
- 403: resource owned by another user (or 404 to avoid existence disclosure; choose one consistently).
- 404: resume, role, rubric, or analysis not found.
- 409: duplicate/conflicting role selection or stale rubric version.
- 422 may also cover a structured-analysis schema validation failure.
- 503: rubric unavailable, parser dependency unavailable, or scoring policy missing.

Backward compatibility:

- Existing `/resume/upload`, `/resume/latest`, and `/resume/summary` remain callable. Their current response fields are preserved, while `analysis` is added and `parsed_data` is now evidence-derived with empty lists instead of fabricated records.
- `/resume/analysis/latest` returns structured extraction without raw resume text; all analysis queries filter by authenticated `user_id`.
- `/auth/profile` keeps existing fields; `target_role` remains accepted for old clients but is not used as canonical selection.
- Static subpaths must be declared before dynamic analysis-id paths.

## L. Frontend Design

Use the existing `AccountManagement.jsx` layout and Tailwind style. Do not import rubric/skills logic into React.

### Profile

- Replace the free-text target-role input with a searchable select backed by `GET /job-roles`.
- Show family, title, rubric availability, and confidence.
- Add a visible "Clear target role" action.
- If no role is selected, show "Optional: choose a role only if you want job-readiness analysis."
- Preserve the existing experience-level selector and password/security section.

### Resume Analysis Dashboard

- New account tab, tentatively `Job Readiness`, or a section within Resume.
- Header clearly states the mode and rubric provenance.
- Resume Match Score with component breakdown.
- Matched skills, missing skills, weak evidence, priority recommendations.
- Source/confidence badges; provisional rubric warning.
- Job-description tab with paste/upload, explicit "this JD takes precedence" label.
- Re-analyze action; loading/error/empty states.
- No hardcoded role lists, weights, or requirement labels.

### Resume Improvement Journey

- Version list with upload date, file name, analysis count, score history.
- Compare two versions and explain changed evidence.
- Recommendation checklists with complete/dismiss actions.
- "Not enough evidence" states rather than fabricated progress.

Responsive behavior follows the existing account page: sidebar on desktop, mobile drawer, white rounded cards, `primary` purple accents, and Tailwind utility classes.

## M. InterviewSpar Integration

Map resume gaps to existing practice tracks:

| Resume gap category | Suggested practice |
|---|---|
| DSA / algorithms / problem solving | Technical track with DSA focus |
| Backend/API/database fundamentals | Backend technical track |
| ML/AI project depth | AI/ML technical track |
| STAR/behavioral evidence | HR track |
| Communication/hedging | Existing communication/fluency practice |

Implementation rules:

- Send a recommendation id/context, not a fabricated score.
- Add optional `focus` metadata to the existing interview flow only if needed; do not create a parallel interview engine.
- Store resume and interview scores in separate fields and never average them into a single "hire probability."
- Link session reports to the recommendation that prompted them where possible.

## N. Security, Privacy, and Fairness

- All analysis routes require JWT authentication and user ownership checks.
- Validate upload extension, MIME/magic bytes, size, and archive structure. Reject encrypted/zip-bomb DOCX and suspicious PDFs.
- Use bounded parsing time/memory; never execute macros or embedded scripts.
- Treat resume and JD text as untrusted content. Delimit it as data and strip instruction-like prompt injection from LLM context.
- Do not log raw resumes, JDs, JWTs, Mongo URIs, API keys, or personal contact details.
- Do not use face-presence, video, webcam, or integrity signals in resume scoring.
- Do not score protected characteristics, college prestige, or graduation year as penalties. Use education only where the rubric explicitly requires it; missing graduation year is unknown, not negative.
- Make LLM participation optional and disclose when used. Deterministic scoring must work with no LLM.
- Obtain consent for any secondary use. Do not train shared models on identifiable student resumes without explicit consent and safeguards.
- Provide deletion and retention configuration; store only what analysis needs.
- Display uncertainty and source limitations, especially for provisional rubrics.

## O. Testing and Evaluation

Existing test infrastructure is absent. Phase 1 adds standard-library unit tests under `backend/tests/`; later phases add integration tests.

### Unit tests

- Skill alias normalization: React variants, Node variants, ML, PostgreSQL/Postgres.
- Non-merging: Java vs JavaScript, React vs React Native, C vs C++, SQL vs NoSQL.
- Longest-alias span selection.
- Role id/alias uniqueness and family normalization.
- Catalog schema validation, source status validation.
- Rubric requirement references and version/confidence consistency.
- Evidence-state scoring and missing-skill detection.
- Recommendation payload validation against evidence.
- User ownership and authorization (integration).
- Invalid upload, empty resume, unsupported role, low-confidence rubric.
- Job description matching precedence and prompt-injection neutralization.

### Evaluation samples

Create manually reviewed samples for representative CSE, CE, IT, and AIML resumes across at least five roles. Keep them synthetic/anonymized and label them as evaluation fixtures, not market data.

Track:

- Skill extraction precision/recall.
- Normalization accuracy.
- Human-rubric agreement (percentage and Cohen's kappa where feasible).
- Score consistency across repeated analyses.
- Recommendation relevance and unsupported-claim rate.
- Latency and failure rates.
- Dataset coverage/freshness and rubric confidence distribution.

Never claim that a high match score guarantees shortlisting or predicts hiring probability.

## P. Phased Implementation Plan

### Phase 0 - Repository audit and design (complete)

- Inspect repository architecture.
- Document actual paths, conflicts, and migration decisions.
- Verify public data sources and licensing status.
- Create this plan.

### Phase 1 - Data foundation (complete)

- Add source registry with licensing/status records.
- Add canonical skill dictionary with aliases and validation.
- Add 35-role taxonomy with entry-level focus and O*NET crosswalks.
- Add five provisional role rubrics with explicit zero-posting evidence.
- Add catalog loader, validator, normalizer, and idempotent MongoDB import CLI.
- Add tests for normalization, taxonomy, rubrics, and source policy.
- Do not add public APIs or React UI yet.

#### Phase 1 validation record (2026-10-21)

- Catalog load: 9 sources, 132 skills, 35 roles, and 5 provisional rubrics validated.
- Test command: `python -m unittest discover -s backend\tests -v`.
- Result: 33 tests passed; no failures or errors.
- Compile check: `python -m compileall -q app\resume_intelligence tests` passed from `backend/`.
- Import dry run: `python -m app.resume_intelligence.import_catalog --data-dir data\resume_intelligence` validated and reported 9 source, 132 skill, 35 role, and 5 rubric records without opening MongoDB.
- MongoDB write verification remains pending because no test database/configuration was provided.

### Phase 2 - Resume parsing and evidence extraction (complete)

- Reuse text extraction from `backend/app/routes/resume.py` by factoring it into a service.
- Remove fabricated fallback records from the authoritative path.
- Extract sections, skills, project/experience evidence, education, certifications, and outcomes.
- Record source spans and confidence.
- Add parser validation and tests.

#### Phase 2 validation record (2026-10-21)

- Added `backend/app/resume_intelligence/schemas.py` with the versioned `resume-intelligence-v1` output contract.
- Added `backend/app/resume_intelligence/parser.py` for safe file validation, PDF/DOCX extraction, section detection, grouped skill evidence, and deterministic structured extraction.
- Replaced the Groq/heuristic parsing path in `backend/app/routes/resume.py`; existing `parsed_data`, `summary`, and `/resume/latest` compatibility are retained without fabricated fallback records.
- Added authenticated `GET /resume/analysis/latest`; all resume queries filter by the JWT subject's `user_id`.
- Raw resume text is retained only in the existing `resumes` collection. `users.resume` stores only a summary and resume pointer; the analysis payload excludes contact values.
- Evidence strength rules are deterministic: `listed` in a skills section, `contextual_mention` elsewhere without an action verb, `demonstrated_use` in a project/experience line with an action verb, and `demonstrated_outcome` when a quantitative outcome is also present.
- PDFs with no extractable text return an explicit OCR-required message. Corrupt, encrypted, empty, oversized, macro-enabled, and signature-mismatched files return user-safe errors.
- Test command: `python -m unittest discover -s backend\tests -v`.
- Result: 53 tests passed, including real generated PDF/DOCX fixtures, contact-section handling, separate scanned-PDF behavior, PII omission, span accuracy, alias grouping, ownership checks, and JWT reuse.
- Limitation: OCR is not implemented; scanned resumes are rejected with instructions rather than silently analyzed.

### Phase 3 - Indian job-market dataset and evidence-backed role rubrics (complete)

- Add an explicit source content/import gate so taxonomy sources cannot be imported as job postings.
- Add validated CSV/JSON/API-record ingestion with license checks, role mapping, skill normalization, unknown-skill review, deduplication, and dry-run behavior.
- Add deterministic evidence assessment and provisional rubric generation for the five target roles.
- Store normalized postings, ingestion runs, unknown skills, and versioned generated rubrics in MongoDB without storing raw descriptions.
- Keep all five production rubrics taxonomy-only until licensed Indian posting evidence is available.

#### Phase 3 validation record (2026-10-21)

- Official O*NET, ESCO, NSDC, NCS, and Adzuna pages returned HTTP 200 during verification. Licensing findings are recorded in section T.
- No licensed, reusable Indian job-posting dataset was available. Actual eligible posting count remains **0** for all five target roles; no market validation is claimed.
- Added `backend/app/resume_intelligence/job_market_schemas.py`, `job_market.py`, `rubric_builder.py`, and `ingest_job_market.py`.
- Added `backend/data/resume_intelligence/rubric_thresholds.v1.json` and evidence metadata to the five existing rubrics.
- Added MongoDB indexes for `job_postings`, `job_market_ingestion_runs`, `unknown_job_skills`, and versioned `role_rubrics`.
- Test command: `python -m unittest discover -s backend\tests -v`.
- Result: 74 tests passed, including schema validation, license rejection, deduplication, unknown-skill review, idempotent upserts, threshold gating, and rubric reproducibility.
- Synthetic test records are explicitly labeled and exist only in temporary test directories; they are not production market evidence.

### Phase 4 - Scoring, gap analysis, and recommendations (complete)

- Implement deterministic scoring and evidence states.
- Add missing/weak-evidence detection.
- Add score explanations and low-confidence handling.
- Add tests for score formula and determinism.

The implemented behavior, actual file list, formulas, API contracts, indexes, worked synthetic examples, and 107-test validation result are recorded in section U.

### Phase 5 - Optional explanation refinement and calibration

- The deterministic, priority-ranked recommendation foundation is complete in Phase 4.
- Future work may add optional LLM wording improvements, but the LLM must never change scores or add unsupported findings.
- Add recommendation completion tracking and human evaluation calibration if required by the product.

### Phase 6 - Profile and dashboard

- Add optional target-role selection/clear behavior.
- Build the analysis dashboard and JD workflow.
- Preserve all existing profile/resume/interview behavior.

### Phase 7 - Interview integration

- Map resume gaps to existing practice tracks.
- Keep score domains separate.
- Link recommendations to sessions/reports.

### Phase 8 - History and evaluation

- Resume version history and comparisons.
- Recommendation completion tracking.
- Quality, fairness, security, and performance evaluation.
- Expand roles only through verified data updates.

## Q. Acceptance Criteria

The feature is complete only when:

1. A user can leave the target role blank without breaking existing workflows.
2. A user can select a target role and analyze an existing uploaded resume.
3. A user can analyze a specific job description.
4. Every score component has a documented, versioned calculation.
5. Role rubrics expose traceable sources, sample size, confidence, and version.
6. Missing skills and weak evidence are distinct.
7. Recommendations are actionable and cannot invent qualifications.
8. Low-evidence roles are labeled transparently.
9. Analyses are authenticated, ownership-checked, and securely persisted.
10. Existing authentication, resume upload, and interview workflows continue to work.
11. Tests cover core functionality, ownership, invalid input, and low-confidence behavior.
12. New roles are added through data/catalog updates, not React hardcoding.

## R. Phase 1 Implementation Contract

Phase 1 deliberately stops before API/UI integration. It will deliver:

- `backend/data/resume_intelligence/sources.v1.json`
- `backend/data/resume_intelligence/skills.v1.json`
- `backend/data/resume_intelligence/roles.v1.json`
- `backend/data/resume_intelligence/rubrics/*.v1.json`
- `backend/app/resume_intelligence/` catalog, normalization, validation, and import modules
- `backend/tests/` standard-library tests

Phase 1 does not modify the existing resume upload endpoint, authentication, or profile UI. That separation keeps the data foundation verifiable and avoids shipping a partial scoring experience.

Implemented modules:

- `backend/app/resume_intelligence/catalog.py` loads, validates, indexes, and resolves catalog records.
- `backend/app/resume_intelligence/normalization.py` performs NFKC/case-fold normalization, longest-match extraction, span reporting, and context-sensitive handling.
- `backend/app/resume_intelligence/import_catalog.py` validates first and performs idempotent MongoDB upserts only with `--apply`.
- `backend/tests/` contains standard-library catalog, normalization, and import-contract tests.

## S. Open Limitations and Next Decisions

- An authorized NCO 2015 file and NSDC QP reuse permission are still needed before those sources can be ingested.
- O*NET/ESCO crosswalks are supplementary and do not represent Indian hiring outcomes.
- No licensed Indian job-posting sample is present; all five seed rubrics remain taxonomy-only and provisional, with zero eligible postings.
- Adzuna remains disabled for product ingestion until a written license or approved plan covers the intended use, aggregation, and retention.
- The Phase 3 evidence thresholds are project decisions and require manual review; they do not validate a rubric automatically.
- Unknown skills require human taxonomy review before they can become canonical skills.
- The ingestion and rubric tests use synthetic fixtures only; they demonstrate behavior, not Indian market demand.
- Rubric weights remain unpublished until manual validation.
- Scanned PDFs are rejected with an OCR-required message; OCR is not implemented in Phase 2.
- Project and experience segmentation is deterministic but heuristic; uncommon resume layouts may require manual review and future layout fixtures.
- MongoDB write testing still requires a configured test database. Phase 2 and Phase 3 tests use in-memory fake collections and do not validate Atlas behavior.
- The duplicate frontend API client situation should be resolved separately, after the feature is working.

## T. Phase 3 Job-Market Ingestion and Rubric Evidence

### T.1 Verified sources and permitted use (2026-10-21)

| Source | Content class | Verified terms and constraints | Phase 3 status |
|---|---|---|---|
| O*NET Database 31.0, U.S. DOL/ETA | Occupational taxonomy | CC BY 4.0 with attribution and change disclosure; U.S. labour context | Allowed reference data only; `job_posting_import_allowed=false` |
| ESCO 1.2.1, European Commission | Occupational taxonomy | Dataset download is free after privacy-statement acceptance; the license shipped with the selected package must be archived and reviewed | Manual review; not imported |
| NCO 2015, Ministry of Labour & Employment / NCS | Occupational taxonomy | NCS terms and the actual publication must be verified; no machine-readable NCO file was obtained | Access pending; no NCO identifiers claimed |
| NSDC Qualification Packs | Occupational documents | NSDC Terms of Use prohibit copying, downloading, reproducing, or redistributing content without written permission; the portal grants a limited personal, revocable license | Reference/link only; not imported |
| Adzuna India API | Authorized job-posting API | Terms allow personal job search and personal/academic research; commercial analysis, product use, resale, and ongoing aggregate work require written agreement | License required; no key, call, or posting data used; import disabled |
| Kaggle, Hugging Face, GitHub | Dataset catalogs/repositories | Each dataset or repository has its own license; missing or unclear licenses do not grant reuse | No dataset selected or imported |

The official O*NET license page, ESCO download page, NSDC terms page, NCS portal, and Adzuna terms page all returned HTTP 200 during the Phase 3 verification. These checks establish page availability only; they do not convert occupational descriptions into evidence of Indian employer demand.

LinkedIn, Naukri, and other job boards were not scraped. No access controls were bypassed. No API keys, credentials, applicant records, recruiter contact details, or personal posting data were collected.

### T.2 Actual market evidence status

- Actual eligible Indian job-posting count: **0** for Software Engineer, Frontend Developer, Backend Developer, Data Analyst, and Machine Learning Engineer.
- Actual source distribution: **empty**.
- Actual geographic and temporal coverage: **none**.
- Actual market frequency or market validation: **none claimed**.
- The five existing rubrics retain taxonomy/expert provenance and explicitly expose `evidence_tier=taxonomy_only`.

### T.3 Reproducible ingestion commands

The pipeline never downloads data. A permitted source must be obtained separately and supplied as CSV, JSON, or an authorized API response passed to `ingest_records`.

```powershell
cd backend

# Dry run: validates and reports without opening MongoDB.
python -m app.resume_intelligence.ingest_job_market `
  --input "C:\licensed-data\india-entry-level-postings.csv" `
  --dataset-version "2026.10.21.1" `
  --generate-rubrics

# Apply normalized evidence and generated provisional rubric versions.
python -m app.resume_intelligence.ingest_job_market `
  --input "C:\licensed-data\india-entry-level-postings.csv" `
  --dataset-version "2026.10.21.1" `
  --generate-rubrics `
  --apply
```

`MONGODB_URL` must be configured for `--apply`. The dry run does not require MongoDB. `--rubric-output <directory>` writes generated JSON rubric documents for review. The command is idempotent because posting, review-term, run, and rubric records use deterministic keys and upserts.

### T.4 Input and normalized posting schema

Accepted input fields are defined in `backend/app/resume_intelligence/job_market_schemas.py`:

- `source_id`, `source_posting_id`, and a permitted `source_reference_url`; at least one posting identifier or reference URL is required.
- Published `title`, optional `employer_name`, and `location`.
- `required_skills` and `preferred_skills`; SQL extraction uses `description` only as transient text and never stores it.
- Optional experience minimum/maximum, education, employment type, posted date, and required collection date.
- Extra fields are rejected. Recruiter names, emails, phone numbers, applicant data, and other personal fields therefore cannot enter the normalized store.

Normalized records contain canonical skill IDs, matched evidence terms, importance (`required`, `preferred`, or `mentioned`), extraction method, extraction confidence, parsed Indian city/state where available, source license status/name, dataset version, content fingerprint, duplicate metadata, and provenance status. Unknown skills are queued separately with their normalized term, observed display terms, source IDs, role IDs, and posting record IDs.

### T.5 Deduplication rules

- Sorting is deterministic by source, source posting ID, and record ID, so input order does not change the result.
- `record_id = SHA-256(source_id + source_posting_id)` when a source posting ID exists; otherwise the content fingerprint supplies stable identity.
- A normalized near-duplicate fingerprint covers role, normalized title, employer, city/state, required/preferred canonical skills, experience range, education, and employment type.
- Repeated source posting IDs are marked `duplicate_kind=source_record`.
- Records with the same normalized fingerprint across titles or sources are marked `duplicate_kind=content` and excluded from role evidence.
- The first deterministic record is retained as the canonical evidence record. Duplicate records remain audit-visible with `duplicate_of` set.
- This rule can conservatively collapse genuinely separate but identical postings. The duplicate rate and source concentration remain visible in the evidence record and thresholds.

### T.6 Rubric methodology and evidence thresholds

Generation is limited to the existing role IDs:

`software-engineer-sde`, `frontend-developer`, `backend-developer`, `data-analyst`, and `machine-learning-engineer`.

- Skills explicitly classified as required become `core` requirements; skills explicitly classified as preferred become `preferred` requirements.
- Posting frequency is recorded in rationale and source references but does not change importance by itself.
- No requirement or dimension weight is generated. Every weight remains `null` with `pending_manual_validation`.
- A generated rubric always has `status=provisional`, `validation.status=not_reviewed`, and `approved_at=null`.
- The rubric stores eligible unique posting count, unique employers, source distribution, geographic distribution, temporal range and recency ratio, duplicate rate, required-skill coverage, mean extraction confidence, threshold checks, blockers, and limitations.
- Occupational taxonomy evidence remains in the seeded rubrics and is not mixed into generated `provenance_mode=indian_job_postings` rubrics.

The configurable policy in `backend/data/resume_intelligence/rubric_thresholds.v1.json` requires:

| Threshold | Project value |
|---|---:|
| Eligible unique postings | 100 |
| Unique employers | 25 |
| Distinct licensed sources | 2 |
| Postings inside the 18-month recency window | 70% |
| Maximum duplicate rate | 25% |
| Postings with an explicit required-skill field | 80% |
| Mean skill-extraction confidence | 0.90 |
| India location evidence | 80% |
| Temporal span | 90 days |
| Maximum share from one source | 80% |

Meeting every check produces `evidence_tier=threshold_met_pending_review`, not `validated`. A documented human review is still required before any rubric can be approved or used as an authoritative scoring basis.

### T.7 MongoDB storage and indexes

- `source_registry`: existing source metadata, now including `content_kind` and `job_posting_import_allowed`.
- `job_postings`: normalized permitted posting evidence, unique `record_id`, `content_fingerprint`, and role/date indexes.
- `job_market_ingestion_runs`: deterministic `run_id`, summary counts, quarantine reasons, and safe quarantine metadata without raw failed records.
- `unknown_job_skills`: unique `normalized_term` with idempotent source, role, and posting membership sets.
- `role_rubrics`: existing collection; generated versions use `rubric_id=role_id@dataset_version` and remain unpublished until review.

`backend/app/database.py` creates the indexes. No existing resume documents are modified by Phase 3.

### T.8 Test results and evaluation status

- Full command: `python -m unittest discover -s backend\tests -v`.
- Result: **74 tests passed**.
- New Phase 3 tests: 21, covering input validation, alias normalization, unknown-skill review, duplicates, missing provenance, license restrictions, dry-run behavior, idempotent imports, role mapping, required/preferred distinctions, insufficient evidence, threshold satisfaction without approval, versioning, and reproducibility.
- Compile check: `python -m compileall -q backend\app backend\tests` passed.
- The threshold test uses 100 clearly labeled synthetic records to exercise the rule engine. It is not evidence of real Indian demand.
- No MongoDB Atlas write test was run; persistence is verified with in-memory collection doubles.

### T.9 Sources awaiting approval and next steps

- Obtain a written Adzuna agreement or another licensed Indian posting dataset with clear retention, aggregation, and product-use rights.
- Obtain an authorized NCO file and NSDC reuse permission if those sources are needed for role-title or qualification crosswalks.
- Capture and review the license shipped with any ESCO package before import.
- Review unknown-skill terms before adding aliases or canonical skills.
- Complete manual rubric review before promoting any evidence-backed version.
- Proceed to Phase 4: deterministic rubric-based resume scoring, while keeping market evidence, resume evidence, and interview readiness as separate measurements.

## U. Phase 4 Scoring, Gap Analysis, and Recommendations (complete)

Phase 4 adds a deterministic assessment service over the Phase 2 resume analysis and the Phase 3 catalog/rubrics. It does not use an LLM, does not download data, and does not convert a match score into a hiring or shortlisting probability.

### U.1 Implemented files

Added:

- `backend/app/resume_intelligence/assessment_schemas.py` - `resume-assessment-v1` requests, response, enums, findings, score components, unknown requirements, evidence summary, and recommendations.
- `backend/app/resume_intelligence/assessment_errors.py` - user-safe assessment error type.
- `backend/app/resume_intelligence/job_description.py` - deterministic job-description requirement extraction, conservative unknown-term review, source spans, and hash-only retention reference.
- `backend/app/resume_intelligence/assessment_engine.py` - pure role and job-description scoring, evidence interpretation, status partitioning, and versioned assessment identity.
- `backend/app/resume_intelligence/recommendation_engine.py` - deterministic recommendation templates and priority ranking.
- `backend/app/resume_intelligence/assessment_service.py` - latest-resume lookup, role resolution, idempotent persistence, history retrieval, and ownership checks.
- `backend/app/routes/resume_assessment.py` - authenticated assessment endpoints.
- `backend/tests/assessment_helpers.py` - clearly synthetic resume, rubric, and fake-database fixtures.
- `backend/tests/test_resume_intelligence_assessment.py` - 18 scoring, evidence, job-description, identity, and recommendation tests.
- `backend/tests/test_resume_intelligence_assessment_api.py` - 15 API, authorization, persistence, history, and retention tests.

Modified:

- `backend/app/routes/resume.py` - the shared JWT dependency now returns `401` for a missing authorization header.
- `backend/app/database.py` - added `resume_assessments` indexes.
- `backend/main.py` - registered the assessment router.
- `docs/RESUME_INTELLIGENCE_IMPLEMENTATION_PLAN.md` - this implementation record.

No frontend, interview engine, parser, Phase 1 catalog, Phase 2 upload flow, or Phase 3 rubric data was replaced.

### U.2 Assessment modes

**Role mode**

- Resolves an existing canonical role ID through the catalog; it does not create role aliases or duplicate rubrics.
- Uses the role's current provisional or approved rubric.
- Returns findings, evidence, gaps, unknown/unevaluated items, and rubric limitations even when a score cannot be calculated.
- Calculates a numerical score only when all of the following are true:
  - rubric status is `approved`;
  - every requirement has a positive weight;
  - every requirement weight status is `validated`;
  - no requirement is `not_evaluated`.
- All five current rubrics remain `taxonomy_only`, provisional, unreviewed, and unweighted. Therefore their role assessments return `score=null`, `score_status=unavailable`, `assessment_status=preliminary`, and no invented weights.

Rubric importance maps to assessment requirement type as follows: `core` and `important` -> `required`; `preferred` -> `preferred`; `optional` -> `unspecified`. The original importance value and rubric rationale remain in the response.

**Job-description mode**

- Accepts plain text from 40 to 20,000 characters.
- Extracts canonical skills only through the Phase 1 normalizer.
- Uses the versioned product-defined textual-coverage weights: required `3.0`, preferred `1.0`, unspecified `0.5`. These are explicitly not empirical market weights.
- Requires at least two known, reliably evaluable requirements before returning a numerical score.
- Treats the description as untrusted data. Instruction-like clauses such as `ignore previous instructions`, `system prompt`, or `set the score` are excluded from requirement extraction and cannot alter scoring.
- Retains a SHA-256 reference and character count, not the raw description.

### U.3 Evidence interpretation

The engine uses one best evidence item per canonical skill from the Phase 2 parser. Duplicate aliases and repeated mentions are already grouped by `skill_id`; neither increases coverage or evidence strength.

| Parser evidence | Match status | Category factor |
|---|---|---:|
| `listed` | `mentioned_only` | 0.35 |
| `contextual_mention` | `weak_evidence` | 0.20 |
| `demonstrated_use` | `demonstrated` | 0.65 |
| `demonstrated_outcome` | `demonstrated` | 1.00 |
| absent from resume | `not_evidenced` | 0.00 |
| parser confidence below 0.50 | `not_evaluated` | excluded; score unavailable |

The effective evidence factor is:

```text
effective_factor = category_factor x parser_confidence
```

For a grouped `any` requirement, the strongest evidenced alternative is used. For `all`, the mean factor across every required skill is used; a partially evidenced group is reported as `weak_evidence`. If any requirement cannot be evaluated reliably, the entire numerical assessment is unavailable rather than silently treating it as zero.

Wording consistently says a skill is "not evidenced in this resume", not that the candidate lacks the ability.

### U.4 Scoring formulas

For an approved, fully weighted role rubric:

```text
role_score = round(
  100 x sum(requirement_weight x effective_evidence_factor)
      / sum(requirement_weight),
  1
)
```

For a job description:

```text
job_description_score = round(
  100 x sum(heuristic_weight x effective_evidence_factor)
      / sum(heuristic_weight),
  1
)
```

Every returned score includes one `ScoreComponent` per evaluated requirement with the requirement type, weight, evaluated skill IDs, evidence classification, parser confidence, evidence factor, weighted value, and an explanation. The score explanation repeats the formula and evaluated requirement count. Scores are not probabilities and are never combined with interview readiness.

`score_method` is `weighted_role_rubric_v1` for an approved weighted role assessment, `job_description_evidence_coverage_v1` for a job-description score, and `not_available` when the inputs do not support a number. `assessment_status` is `evidence_backed` only for the first case; job-description scoring is `heuristic`, and all unavailable-score assessments are `preliminary`.

### U.5 Job-description extraction and unknown terms

- Requirement type is inferred from headings and phrases such as `required`, `must have`, `minimum qualifications`, `preferred`, `nice to have`, and `good to have`. Heading state carries across comma/semicolon-separated items on the same line.
- Known skills are aggregated by canonical ID. The highest explicit type wins when a skill appears more than once (`required` > `preferred` > `unspecified`).
- Source spans refer to offsets in the submitted description. The response exposes offsets and the matched canonical term, not the complete description.
- Conservative unknown-term candidates are reported only in requirement-like clauses when they are not catalog skills. They are kept separate as `unknown_requirements` and never classified as missing resume skills.
- If no known or unknown requirement is detectable, the API returns a validation error instead of manufacturing a score.
- If only unknown terms or fewer than two known terms are found, findings are returned with `score=null` and an explicit reason.

The extractor is English and cue-driven. It deliberately favors fewer unknown-term false positives over aggressive extraction; unusual job-description layouts may require reviewed fixtures and future tuning.

### U.6 Recommendations

Recommendations are deterministic templates generated from assessment findings:

- `skill_development` for requirements not evidenced in the resume.
- `evidence_improvement` for listed-only or weakly evidenced skills, and for demonstrated use without a recorded outcome.
- `resume_improvement` for missing project/experience evidence or project descriptions without measurable outcomes.

Each recommendation includes a supported gap, priority band and rank, why the role/JD classification matters, a concrete action, related canonical skills and requirement IDs, optional evidence, and a safety note. Required skills rank above preferred and unspecified skills. Recommendations never invent projects, certifications, internships, metrics, or achievements; conditional wording asks the user to add a result only if it is verifiable. No LLM is called in Phase 4.

### U.7 API contract

All endpoints reuse the existing JWT dependency and derive the user from the token. The request body cannot supply a user ID.

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/resume/analysis/match` | Create/return an idempotent role assessment for the authenticated user's latest resume. |
| `POST` | `/resume/analysis/job-description` | Create/return an idempotent job-description assessment. |
| `GET` | `/resume/analysis/match/latest` | Return the latest owned assessment; optional `mode` and `target_role_id` filters. |
| `GET` | `/resume/analysis/match/{assessment_id}` | Return one owned assessment; another user's ID returns `404`. |

Role request:

```json
{
  "target_role_id": "frontend-developer"
}
```

Job-description request:

```json
{
  "job_description": "Required: JavaScript, React. Preferred: TypeScript, Docker."
}
```

Response outline (values abbreviated):

```json
{
  "schema_version": "resume-assessment-v1",
  "assessment_id": "ra_0123456789abcdef01234567",
  "assessment_mode": "role",
  "target_role_id": "frontend-developer",
  "target_role_title": "Frontend Developer",
  "resume_id": "66f...",
  "resume_sha256": "64-character-sha256",
  "job_description_reference": null,
  "assessment_status": "preliminary",
  "score": null,
  "score_status": "unavailable",
  "score_method": "not_available",
  "score_explanation": "A numerical role score is unavailable because ...",
  "matched_requirements": [],
  "skill_gaps": [],
  "unknown_requirements": [],
  "not_evaluated_requirements": [],
  "score_components": [],
  "evidence_summary": {},
  "recommendations": [],
  "rubric_id": "frontend-developer@2026.10.1",
  "rubric_version": "2026.10.1",
  "catalog_version": "2026-10-21.1",
  "scoring_policy_version": "resume-match-v1",
  "limitations": ["..."],
  "created_at": "2026-10-21T12:00:00+00:00"
}
```

Error handling:

- Missing/invalid JWT: `401`.
- Unknown role or role without a published rubric: `404`.
- No resume: `404`.
- Missing, invalid, or old stored resume analysis: `409` with an upload-again message.
- Empty, too short, too long, or skill-free job description: `422`.
- Request validation: FastAPI `422`.
- MongoDB/storage failure: `503` with no internal exception text.

### U.8 MongoDB persistence and indexes

Collection: `resume_assessments`. Each document stores:

- `user_id` (server-derived ownership; not returned in the response).
- Complete `resume-assessment-v1` result, including assessment ID, resume ID/hash, mode, role or hash-only JD reference, findings, score components, recommendations, versions, limitations, and `created_at`.
- No raw resume text and no raw job-description text. Evidence snippets are limited to parser-redacted text already required to explain a finding.

Indexes created in `backend/app/database.py`:

- unique `assessment_id`;
- `(user_id, created_at descending)`;
- `(user_id, assessment_mode, created_at descending)`;
- `(user_id, target_role_id, created_at descending)`.

`assessment_id` is derived from the authenticated user, resume ID/hash, mode, target role/rubric version or JD hash, catalog version, assessment schema version, and scoring policy version. Persistence uses `$setOnInsert` with upsert, so an identical request returns the original assessment and changed resume/JD/rubric inputs create a new history record. Every retrieval query includes `user_id`.

### U.9 Security and privacy

- No new authentication or resume-storage system; the existing JWT and latest-resume document are reused.
- Cross-user reads return `404` rather than disclosing record existence.
- Job descriptions are bounded at 20,000 characters, parsed as data, and stripped of instruction-like clauses before requirement extraction.
- No LLM, external network call, or executable file handling is involved in assessment.
- No raw resume or JD text is stored in assessments or written to logs.
- Contact details remain excluded because assessment uses the Phase 2 structured analysis, not `raw_text`.
- Scoring ignores college, graduation year, gender, face/video signals, and other protected or integrity signals.
- Deterministic recommendation templates cannot invent credentials, experience, metrics, certifications, or outcomes.

### U.10 Tests and actual results

Commands run from `D:\interviewspar\backend`:

```powershell
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Actual results on 2026-10-22:

- Full suite: **115 tests passed** (74 pre-existing + 41 Phase 4 tests).
- Compile check: passed (`python -m compileall -q app tests`).
- Phase 4 tests cover deterministic output, all four evidence classes, low-confidence/not-evaluated evidence, missing weights, approved weighted arithmetic, required/preferred weights, duplicate aliases, repeated mentions, ambiguous normalization and malformed spans, unknown terms and spans, empty/short/long/skill-free descriptions, irrelevant/ambiguous JD terms, pure and LLM-independent scoring, all five seed target roles (`software-engineer-sde`, `frontend-developer`, `backend-developer`, `data-analyst`, `machine-learning-engineer`), prompt-injection-like text, recommendation grounding, assessment identity, role validation, JWT failures, cross-user isolation, missing/malformed resume analysis, backward compatibility with existing resume endpoints, history filters, storage failure, and hash-only JD retention.
- Tests use synthetic resume/rubric fixtures and in-memory collection doubles. They are not real user resumes or Indian market evidence. No live MongoDB Atlas test was run.
- `TestClient` emits non-failing AnyIO resource warnings in this environment, and the pre-existing global Mongo client emits an unclosed-client warning at interpreter shutdown. Neither changes the successful test result.

### U.11 Worked synthetic examples

These examples exist only to verify arithmetic. They are not real postings, rubrics, or market statistics.

**Role, current taxonomy-only rubric**

- Synthetic resume: Python evidenced with an outcome; SQL listed only.
- Role: Software Engineer using `software-engineer-sde@2026.10.1`.
- Result: Python is `demonstrated`; SQL is `mentioned_only`; other requirements are listed as findings/gaps.
- Score: `null` because all requirement weights are unset and the rubric is provisional/taxonomy-only.

**Role, synthetic approved weighted fixture**

- Requirement A: Python, weight `1.0`; resume evidence factor `1.00`.
- Requirement B: SQL, weight `2.0`; resume evidence factor `0.00`.
- Calculation: `100 x (1.0 x 1.00 + 2.0 x 0.00) / (1.0 + 2.0) = 33.3`.
- Result: `33.3/100`, `score_status=available`, `assessment_status=evidence_backed` for the test-only validated fixture.

**Job description, synthetic**

- Required Python: heuristic weight `3.0`, evidence factor `1.00`.
- Preferred Docker: heuristic weight `1.0`, evidence factor `0.00`.
- Calculation: `100 x (3.0 x 1.00 + 1.0 x 0.00) / (3.0 + 1.0) = 75.0`.
- Result: `75.0/100` textual requirement coverage with required and preferred coverage visible; this is not an ATS or hiring score.

### U.12 Remaining limitations and rubric promotion requirements

- Current role assessments cannot produce a numerical score. This is intentional and will remain until approved rubrics contain validated weights.
- Unknown-term extraction is heuristic and English-oriented; reviewed job-description fixtures are needed before broadening it.
- Evidence factors are product policy, not empirically calibrated probabilities, and require human-reviewed evaluation before claiming precision.
- Job-description scoring measures textual coverage only; it cannot establish proficiency, ATS behavior, shortlist probability, or hiring outcomes.
- Project/experience segmentation inherits Phase 2 heuristic limitations.
- No live Atlas persistence test or frontend dashboard was added in Phase 4.

Before promoting a role rubric to evidence-backed status:

1. Ingest a permitted Indian job-posting sample that satisfies the Phase 3 thresholds.
2. Review role-title normalization, duplicates, skill extraction, and required/preferred fields against a stratified human-labeled sample.
3. Assign and document requirement weights from reviewed evidence and expert judgment; do not substitute frequency directly for importance.
4. Complete manual rubric review and record reviewer count, rationale, approval date, and confidence.
5. Validate score behavior on representative synthetic and consented evaluation resumes.
6. Re-run authorization, privacy, performance, and reproducibility tests before enabling numerical role scores.


---

## V. Phase 5 Implementation Record: Resume Intelligence Dashboard & Frontend Integration

- Date: 2026-10-22
- Primary frontend: React 19, Vite 8, Tailwind CSS v4 in `frontend/src`
- API client: `frontend/src/api/auth.js` (FastAPI backend at `http://localhost:8000`, JWT in `sessionStorage`)
- Route: `/resume-intelligence` protected by `<ProtectedRoute>`
- Validation: 7 passing frontend tests (`frontend/tests/resume_intelligence.test.mjs`), 115 passing backend tests (`backend/tests/`), 0 Oxlint errors, successful production Vite build.

### V.1 Implemented Artifacts and File Organization

| File | Type | Purpose |
|---|---|---|
| `frontend/src/pages/ResumeIntelligence.jsx` | React Component | Main interactive dashboard page containing header, resume status, Mode A/B selectors, match metrics, skill gaps, recommendations, and assessment history. |
| `frontend/src/utils/resumeIntelligence.js` | JS Module | Canonical role metadata, 6-status finding definitions, recommendation groups, character validation, and null-safe score display helpers. |
| `frontend/src/api/auth.js` | API Client | Added typed API client methods (`createRoleMatch`, `createJobDescriptionMatch`, `getLatestMatch`, `getMatchById`, `getLatestResumeAnalysis`). |
| `frontend/src/components/DashboardNavbar.jsx` | Navigation | Integrated Resume Intelligence into desktop navigation, mobile hamburger drawer, and candidate profile menu. |
| `frontend/src/App.jsx` | App Routing | Declared `/resume-intelligence` under `<ProtectedRoute>`. |
| `frontend/tests/resume_intelligence.test.mjs` | Test Suite | Zero-dependency Node.js tests verifying canonical roles, character validation, null score handling, finding statuses, and error parsing. |
| `frontend/package.json` | Project Config | Registered `"test": "node --test tests/**/*.test.mjs"`. |

### V.2 Assessment Modes and Client Validation

1. **Mode A — Target Role Assessment**:
   - Offers the 5 canonical roles: `software-engineer-sde`, `frontend-developer`, `backend-developer`, `data-analyst`, `machine-learning-engineer`.
   - Sends canonical role IDs directly to `POST /resume/assessment/role`.
   - Clear disclosure that role rubrics are unweighted baseline taxonomies.
2. **Mode B — Specific Job Description Assessment**:
   - Accepts pasted job descriptions with client-side character counter and validation.
   - Requires between 40 and 20,000 characters before submission is permitted.
   - Sanitizes and safely renders text without raw HTML injection risks.
   - Submits to `POST /resume/assessment/job-description`.

### V.3 Score Semantics and Ethical Presentation

- **Provisional Role Scores**: Role match requests return `score: null` and `score_status: "unavailable"`. The UI explicitly checks for this and **never** renders `0%`, `100%`, or empty radial charts. It renders a dedicated informational alert explaining that numerical scores are withheld because target rubrics remain unweighted taxonomy baselines, while presenting all valid skill gap findings and actionable recommendations.
- **Job Description Match Scores**: Returned numerical scores are labeled specifically as **"Textual Requirement Coverage"**. The UI clearly explains this represents keyword and requirement overlap against the provided job description text, explicitly warning users that it does not represent an ATS pass rate or hiring probability.

### V.4 Skill Gap Analysis and Filterable Findings

- Findings are partitioned into 6 semantic statuses:
  - `demonstrated`: Skill evidenced through practical project context or measurable outcome.
  - `mentioned_only`: Skill listed in a summary or skills section without project context.
  - `weak_evidence`: Skill mentioned with low context or minimal evidence depth.
  - `not_evidenced`: Target requirement missing from the uploaded resume.
  - `unknown_requirement`: JD term queued for administrative catalog review.
  - `not_evaluated`: Requirement excluded from automated evaluation.
- Interactive filter bar allows users to filter by finding status or view all requirements.
- Expandable evidence cards reveal specific resume text excerpts, requirement type (`required` vs `preferred`), and concrete next steps.

### V.5 Personalized Recommendations and Ethical Safeguards

- Recommendations are grouped strictly by backend-returned categories: `skill_development`, `evidence_improvement`, `resume_improvement`.
- Clear priority badges (`high`, `medium`, `low`) reflect backend ordering without fabricated rankings.
- Ethical notice reinforces that recommendations do not rewrite resumes automatically or claim skills on the candidate's behalf; candidates are advised to verify that all resume claims reflect their actual experience.

### V.6 UI States and Resilience

- **Loading States**: Skeletons and spinners for resume analysis loading, assessment generation, and historical record retrieval.
- **Empty States**: Helpful zero-data states for candidates without an uploaded resume, unassessed profiles, empty recommendation lists, or missing history.
- **Error States**: Explicit user feedback for 401 session expiration, 404 missing resume, 409 analysis processing, 422 validation errors, and OCR-required warnings for scanned PDFs.
- **Assessment History**: Displays previous assessments with mode, date, target role / JD hash, score status, and a one-click reload button to inspect prior results.

### V.7 Verification Results

- **Frontend Tests**: 7/7 tests passed in 93ms (`npm --prefix frontend test`).
- **Backend Tests**: 115/115 tests passed in 10.32s (`python -m pytest`).
- **Frontend Linter**: Oxlint reported 0 errors across 51 files (`npm --prefix frontend run lint`).
- **Production Build**: Vite compiled 53 modules in 671ms (`npm --prefix frontend run build`).
