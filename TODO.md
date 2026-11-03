# InterviewSpar repair plan — branch b3

This checklist tracks the source audit findings and the implementation/verification work.
The supported application will use React → Express `/api`; Python supplies optional ML
and document helpers. The separate FastAPI experiments remain explicitly documented.

## Tasks

- [ ] T01: Protect runtime data/secrets, establish branch baseline, and document architecture.
- [ ] T02: Repair authentication, profile/password operations, authorization, rate limits, and socket access.
- [ ] T03: Implement one interview contract and complete screening, calibration, HR/technical, coding, behavioral, and completion flows.
- [ ] T04: Add consent-based session/resume persistence, ownership checks, history, deletion, and measured reports.
- [ ] T05: Repair PDF/DOCX resume extraction; reject unreadable documents and remove fabricated facts.
- [ ] T06: Replace unsafe host code execution with an isolated execution-provider adapter and honest unavailable states.
- [ ] T07: Connect frontend account, interview, coding, report, and navigation flows; remove misleading placeholders.
- [ ] T08: Correct ML feature parity, units, zero handling, evaluation provenance, and dependency documentation.
- [ ] T09: Repair or safely retire conflicting FastAPI/v2 paths, fix validation/state bugs, and enforce safe code execution.
- [ ] T10: Correct marketplace/privacy boundaries, subscription claims, certificate authorization, and build configuration.
- [ ] T11: Add meaningful regression tests and run backend, Python, frontend build/lint, and integration checks.
- [ ] T12: Update setup/API/deployment documentation, review staged changes for sensitive data, commit by task, and push b3.

## Verification log

- Initial audit: two backends and incompatible frontend generations; default interview path blocked.
- Existing local changes are being preserved and incorporated; personal users, environments,
  logs, and generated model/build artifacts must not be committed.

## External validation

- Live LLM availability, an isolated code execution provider, browser acceptance, and testnet
  deployment require their corresponding configured services. Record actual results here;
  do not mark unavailable integrations as verified.
