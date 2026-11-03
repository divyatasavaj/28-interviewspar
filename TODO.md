# InterviewSpar repair checklist — branch b3

The supported application is React → FastAPI `/api` → MongoDB. Existing local
work and upstream b3 resume-intelligence changes were preserved. Checked tasks
below describe source repairs and local verification; they do not claim production
acceptance or completion of every aspirational feature in the historical PRD.

## Completed repair tasks

- [x] T01: Protect runtime data/secrets, preserve the local baseline, integrate upstream b3, and document the current architecture.
- [x] T02: Repair auth/profile/password contracts, token revocation, ownership checks, request limits, and disable unowned socket access.
- [x] T03: Connect one persistent interview contract across screening, calibration, HR, technical/coding, behavioral, and reflection rounds.
- [x] T04: Add consent, owned session/resume storage, compact history, deletion, and reports from recorded evidence.
- [x] T05: Preserve/test PDF/DOCX evidence extraction, reject malformed/scanned documents, and remove fabricated fallback facts.
- [x] T06: Replace host execution with an isolated Judge0 adapter; distinguish failed code from unavailable execution and test output comparison.
- [x] T07: Connect frontend account/interview/code/report navigation; show service errors, normalize auth/assessment responses, and remove false-success placeholders.
- [x] T08: Repair ML feature parity, latency/score units, zero handling, train/validation/test separation, and provenance; document synthetic-data limitations.
- [x] T09: Retire conflicting FastAPI/v2 routes from the supported app; fix reviewed legacy validation/state bugs and unsafe execution paths.
- [x] T10: Tighten legacy marketplace/privacy boundaries, correct product claims, and restrict certificate minting to the issuer on test networks.
- [x] T11: Run meaningful backend, ML, frontend, syntax, configuration, and diff checks; add regressions for observed integration failures.
- [x] T12a: Update setup/API/deployment/source-map documentation and add CI/deployment examples.
- [x] T12b: Complete staged sensitive-data review, commit remaining task groups, push b3 without force, and verify the remote commit.

## Verification record — 2026-11-03

| Check | Actual result |
| --- | --- |
| Backend unittest suite | 136 passed; includes resume parser/assessment and synthetic HTTP ownership, complete rounds, retry/stale state, consent/deletion, auth revocation, compact history, code-provider, and chunked-upload cases |
| ML unittest suite | 3 passed; JS/Python feature parity, synthetic consistency, zero handling and unsupported label fallback |
| Frontend tests | 11 passed; resume score/validation semantics and actual API-client contracts |
| Frontend production build | Passed |
| Frontend Oxlint | Exit 0; 24 warnings remain in retained legacy components/context and one existing test parameter |
| Python source syntax | 90 files passed |
| Node source syntax | 29 files passed, including Hardhat configuration/deploy script |
| Ruff selected repaired Python modules | Passed (`F` correctness rules); not a whole-repository formatting claim |
| CI YAML / selected JSON configuration | Parsed successfully |
| Diff whitespace / merge markers | Passed; no conflict markers |

User-approved missing PDF dependencies were installed only into the ignored
project `.venv`; global dependencies were not changed. Backend HTTP tests use
synthetic in-memory collections and provider mocks, not personal/live databases.
A dependency deprecation warning remains for the inherited Starlette/httpx test
integration; tests pass. The virtual environment inherits existing system packages,
so a clean CI install remains useful independent validation.

ML metadata records 211 examples (210 synthetic, 1 labeled seed), ~97.6% validation
accuracy, and 100% on a 43-example synthetic-heavy test partition. This is not
candidate-performance evidence; `production_validated` remains false. Generated
classifier pickles, personal JSON data, secrets, logs, dependencies, and build
outputs are excluded from commits.

## Outstanding acceptance and feature work

- [x] Run real MongoDB integration/concurrency tests in a disposable database: indexes, restart persistence, ownership, answer races, and deletion. See the site test report.
- [ ] Validate MongoDB backup/retention and disaster recovery independently.
- [x] Run Chrome desktop/mobile acceptance: registration, account/profile, PDF resume and matching, complete HR/technical rounds, saved reports/PDF generation, skip/early finish, deletion and credential changes. All 96 recorded checks passed.
- [ ] Verify physical-device speech, native print dialogs, screen readers, Safari and Firefox. Chrome emulation does not establish these behaviors.
- [ ] Restore successful Groq/Edge TTS integration and configure/validate Judge0. Synthetic diagnostics returned Groq HTTP 404 and Edge TTS HTTP 403; coding remains explicitly unavailable without Judge0.
- [ ] Run the new GitHub CI workflow and build/deploy the Docker/nginx examples in a test environment. Examples were not deployed locally.
- [ ] Compile/test the Solidity contract and validate issuer authorization on a local chain before any Sepolia deployment. Only JS syntax was checked; no wallet transaction occurred.
- [ ] Gather consented independent candidate data, review annotations, and validate/calibrate ML signals. Current bootstrap data cannot support hiring decisions.
- [ ] Acquire permitted market evidence and manually review role rubric weights before claiming validated role scores. Current seed aggregate scores remain unavailable.
- [ ] Extend question variety, experience-aware selection, coding challenges, and validated correctness rubrics; current default coding flow uses Two Sum.
- [ ] Implement account erasure, password reset/email verification/MFA as product requirements; define retention of old interview facts and backups.
- [ ] Decide whether to remove or rebuild the retained legacy UI/API modules. Live rooms, production billing, marketplace booking, automated anti-cheat, and certificate issuance remain outside the supported app.
- [ ] Add OCR only with an explicit implementation/validation plan; scanned resumes are currently rejected with guidance.

## Task commits

- `97e39a5`: preserve local work and initial repair checklist.
- `46b4675`: merge upstream b3 resume-intelligence/page updates.
- `b5e98a9`: ML features, validation split, and provenance repairs.
- `24bba38`: canonical authentication, resume, interview, safe execution, UI integration, and regression tests.
- `c392854`: legacy isolation, privacy/authorization fixes, issuer restriction, and corrected product claims.
- `055b26e`: current architecture/API/setup documentation, CI, deployment examples, and verification checklist.
- `10c25a6`: normalize whitespace preserved from the original local work and CSV line endings.

The repair commits were pushed to `origin/b3` without force and fetched back at
`10c25a6` to confirm publication. The final checklist confirmation follows that
commit. No personal/runtime data or private environment values were found in
the outgoing changes. GitHub Actions execution is not yet verified; the workflow
is committed for subsequent remote validation.

## Follow-up quality review

- [x] T13: Reject non-finite/deep code output and malformed provider responses.
- [x] T14: Prevent password-change writes after concurrent credential revocation.
- [x] T15: Separate behavioral/technical evaluation and stop technical adaptation from unverified text cues.
- [x] T16: Omit skipped answers from evaluation and report weaknesses.
- [x] T17: Repair the HR start link, voice preferences, duplicate fallback, and late dictation callbacks.
- [x] T18: Reject malformed API/auth responses and protect fresh tokens from stale 401 responses.
- [x] T19: Correct unsupported product claims, track counts, sampled-score labels, and JD unavailability wording.
- [x] T20: Run the full follow-up checks: 142 backend, 3 ML, and 17 frontend tests passed; build passed; lint retains 24 legacy warnings.

See [quality review](docs/QUALITY_REVIEW.md) for confirmed findings, fixes,
regression evidence, and remaining limitations. The earlier verification table
is retained as the initial repair record.

## Site testing follow-up

- [x] T21: Add opt-in live HTTP/MongoDB journeys with synthetic data and verified cleanup.
- [x] T22: Add component rendering coverage for every routed page and repair authentication field labels.
- [x] T23: Repair clipped tablet navigation and remove unsupported home-page ratings/live metrics and the misdirected demo CTA.
- [x] T24: Keep routine profile reads out of the credential-attempt limit; verify the stricter credential limit remains enforced.
- [x] T25: Correct password-length instructions and associate account/resume labels with their controls.
- [x] T26: Finish Chrome acceptance and record the 96 passing checks, provider failures, and remaining manual verification.

Commands, coverage, evidence and service limitations are recorded in
[the site test report](docs/SITE_TEST_REPORT.md).
