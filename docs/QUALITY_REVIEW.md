# Follow-up quality review — b3

This review checked the supported React/FastAPI flow after commit `6e4359c`.
It found additional functional and accuracy issues. The repairs below are covered
by source review and local checks; they are not a production-acceptance claim.

## Confirmed findings and repairs

| Priority | Finding | Result |
| --- | --- | --- |
| High | Judge0 output containing NaN/infinity was accepted and could crash JSON API serialization | Enforce finite, serializable JSON with bounded nesting; malformed program output is a failed test, malformed provider responses are unavailable |
| High | Password change could overwrite credentials after a concurrent token revocation | Update only if both the previously read password hash and token version still match; otherwise return 409 |
| Medium | HR calibration could receive a technical correctness score from an LLM | Classify question evaluation kind server-side; behavioral questions cannot receive technical correctness |
| Medium | High keyword/length scores increased technical difficulty without evaluating technical understanding | Technical ability updates now require evaluated correctness; missing evaluation does not produce an ability estimate |
| Medium | Skipped answers were evaluated and surfaced as report weaknesses | Skip evaluation entirely; return null scores and omit skipped entries from strengths/weaknesses/coaching summaries |
| Medium | Dashboard's Start HR link opened the default technical track | Pass the HR persona explicitly; display the actual question counts |
| Medium | Interview read-aloud ignored the user's saved voice/rate/pitch settings | Read saved preferences unless explicit preview options override them |
| Medium | Audio failure events could start multiple browser utterances; late recognition results could enter a later question | Make fallback idempotent, settle cancellation, release audio resources, and invalidate recognition callbacks at question/submission boundaries |
| Medium | HTML returned with HTTP 200 or missing auth-token JSON could be treated as success | Reject invalid API/auth responses; do not clear a newly issued token on an obsolete request's 401 |
| Medium | UI claimed a 25% improvement, verified resume skills/repos, deeper project audits, and broader scoring than implemented | Remove unsupported claims, identify examples, correct track descriptions and report labels, and disclose that structure indicators use keyword/length cues |
| Low | Dashboard average implied all sessions and treated zero as missing | Label the latest-five sample and retain zero as a valid value |
| Low | JD score-unavailable UI always blamed a role rubric | Show the assessment's own explanation and mode-appropriate fallback |
| Low | Interview-type loading errors cleared valid authentication | Display non-authentication service errors without clearing the token |

Key modules: `backend/app/safe_execution.py`, `app/interview_flow.py`,
`app/routes/interview_flow.py`, `app/routes/auth.py`, `frontend/src/api/auth.js`,
`utils/naturalSpeech.js`, `utils/dictation.js`, and the current interview/account/
dashboard/public pages.

## Verification

Before the fixes, targeted regressions reproduced non-finite serialization errors,
HR correctness scoring, unsupported technical difficulty increases, and the
password-change race. After the fixes:

- Backend: **142 tests passed**.
- ML: **3 tests passed**.
- Frontend: **17 tests passed**, including mocked speech cancellation/preferences,
  duplicate fallback, late dictation events, invalid responses, and token replacement.
- Frontend production build passed.
- Oxlint exits successfully with the same **24 retained legacy warnings**.
- Selected repaired Python modules pass Ruff correctness checks; `git diff --check` passes.

Speech tests use browser API mocks. They do not establish actual microphone,
autoplay, device, accessibility, or vendor-service behavior in a real browser.
No new dependency installation was required for this review.

## Remaining limitations

The text indicator is still a simple keyword/length heuristic and can miss valid
answers or reward irrelevant wording. It is now labeled accordingly; replacing it
with a validated semantic rubric requires independent evaluation data. Optional
LLM judgments can also be wrong. ML training remains mostly synthetic, role
rubrics remain provisional, and the question bank remains finite. No new model
accuracy or hiring-validity claim was established by these fixes.

Historical stored answer evaluations are not retroactively regraded. Real database
concurrency/provider/browser acceptance, clean remote CI, deployment, and the
legacy modules listed in `TODO.md` remain separate work. The HR route and copy
changes were source-reviewed and build-checked, not browser-acceptance-tested.
