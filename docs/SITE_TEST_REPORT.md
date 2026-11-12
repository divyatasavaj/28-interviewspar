# Site verification — 3 November 2026

Scope: the supported React/Vite → FastAPI → MongoDB application on branch `b3`.
Tests use synthetic accounts and resumes in a unique disposable database. Existing
application records and browser profiles are not used. No dependencies were installed
for this pass.

## Theme and practice refinements — 12 November 2026

The targeted Chrome journey passed 31 checks, including theme persistence,
expected and returned sample values, retained coding skills, direct navigation
to required resume gaps, and both cancellation and confirmation of deletion.
The browser grading check used a local Judge0 response fixture. The full
regression also passed 144 Chrome and 37 live API checks.

All 172 backend, 48 frontend, and 3 ML tests passed. The frontend build and lint
passed with existing warnings. The execution tests verify that compiler
diagnostics are bounded and returned for public samples only.

## Targeted interview and resume practice — 12 November 2026

The workspace now offers coding-only, technical, and HR entry points. Coding
uses desktop panels and mobile tabs. The current draft and language survive a
reload in the same tab. The interview lobby supports an optional camera preview
and a microphone access check for spoken sessions.

Role fit compares required evidence across the five published rubrics. Browser
verification covers a resume upload, opening a role, launching focused practice
from a gap, and using the report to retry that topic. Backend regressions cover
fresh prompts, graded coding adaptation, one optional AI follow-up, and
authenticated role comparison. A live Groq request returned a valid follow-up
for a synthetic technical answer.

All 169 backend, 48 frontend, and 3 ML tests passed. The build and lint passed
with existing warnings. The targeted Chrome journey passed 28 checks, including
the combined coding-to-speech handoff and mobile role comparison. The full
regression passed 144 Chrome and 37 live API checks. Disposable databases were
removed. Browser test grading used a local Judge0 response fixture. Live scoring
requires `JUDGE0_API_URL`.

## Hands-on coding rounds — 12 November 2026

The dashboard opens an opt-in coding round with two or three exercises drawn
from the selected domain. The editor supports JavaScript and Python, public
sample runs, and solution submission. Reports show aggregate sample and hidden
results, optional AI review, and the camera and tab observations for each
exercise. Camera frames stay on the device.

All 165 backend, 48 frontend, and 3 ML tests passed. The build and lint passed
with existing warnings. Independent reference implementations matched all 80
expected outputs in the 16-exercise bank. Backend tests also cover provider
unavailability, stale and duplicate requests, and hidden-result redaction.

The focused Chrome journey passed 15 checks with a local Judge0 response fixture
and synthetic media. The opted-in AI path was verified against live Groq in the
saved browser report using synthetic code and the new `openai/gpt-oss-20b` default.
The full regression passed 37 live API checks and 144 desktop/mobile Chrome
checks. Both disposable MongoDB databases were removed.
Live Judge0 execution still requires `JUDGE0_API_URL`. The default unconfigured
runner state was verified. Reproduce the focused journey with
`--browser-only --mock-code-runner`, adding `--check-providers` to exercise Groq.

## Interview practice improvements — 12 November 2026

The call now shows playback, recording, and review states next to the captions.
The browser journey checks that a denied microphone can be restarted in place,
the final words are present before sending, and stale recognition events cannot
reach the next question. New backend regression coverage checks experience-based
prompt depth, rotation across successive sessions, and persistence of a selected
algorithm exercise when reopening a session.

All 161 backend, 48 frontend, and 3 ML tests passed. The build and lint passed
with the existing face-model size warning and 19 lint warnings. Live MongoDB
checks passed for ownership, persistence across API restart, concurrent answer
updates, matching, and deletion. The initial headless Chrome run disconnected
after leaving fullscreen. Its disposable database was removed before the headful
rerun with the repository's browser test runner.

The final headful run passed 37 live API and 144 Chrome checks. Chrome verified
desktop and mobile layouts, resume upload and both matching modes reached from
the dashboard, the Senior experience selection in the spoken question, complete
HR and technical interviews, dashboard resume and report links, skip and early
finish, deletion, and account access. There were no uncaught browser exceptions
or unexpected HTTP 5xx responses. Disposable database cleanup was confirmed.

Text extraction confirmed a three-page compact HR report and a four-page compact
technical report, with the question review and score qualification present.
The full spoken report includes the final transcript and measurement definitions.
Speech input in these checks is synthetic. Physical microphone recognition,
external AI evaluation, and configured Judge0 remain outside this verification.

## Page organization verification — 4 November 2026

Public pages and signed-in pages now use consistent widths, headings, spacing,
cards, and actions. Workspace navigation groups account settings; account section
links retain their selection after refresh. Practice and recent interviews appear
before expandable dashboard resume tools. Interview setup separates interview
details from feedback/privacy. Reports group speech metrics and camera observations,
with expandable definitions that open for printing and restore afterward.

The full-screen speech-only call, every recording/question control, resume upload
and role/JD analysis, account forms, saved reports, deletion, and voice preferences
remain available. Scoring and media collection behavior were not changed.

| Check | Result |
| --- | --- |
| Frontend unit/component suite | 48 passed |
| Production build | Passed; retained lazy face-model bundle-size warning |
| Frontend lint | Exit 0; 19 retained legacy warnings |
| Complete Chrome journey | 126 checks passed; no uncaught exceptions or unexpected HTTP 5xx responses |
| Focused workspace/call/print journey | 44 checks passed; mobile account navigation/reload, both dashboard matching forms, media flow, evidence printing/restoration, permission denial |
| Final setup spacing review | Desktop/mobile screenshots reviewed; both mobile layout checks passed |
| PDF text extraction | HR: all 9 questions across 20 pages; technical: all 13 across 28 pages; score qualification and answer review retained |
| Spoken report PDF evidence | Four pages; final spoken words, confidence/attention cues, microphone coverage, filler examples, evidence, definitions, and pronunciation limitation retained |

Both successful integration runs confirmed disposable-database cleanup. They used
API port 8001 and frontend port 5174 so the user's existing app on 8000/5173 stayed
running. An initial browser attempt lost its Chrome connection after a study-note
download; its disposable database was cleaned and the complete retry passed.

Screenshots were reviewed for desktop/mobile homepage, dashboard, account, resume
analysis, setup, call, and report organization. Artifacts in the machine's temporary
directory: `interspars-browser-results-GJFcqQ` (full journey),
`interspars-browser-results-z2i4kI` (focused journey), and
`interspars-browser-results-BmTYnH` (final setup spacing, synthetic API responses).
Runtime artifacts are excluded from the commit. BrowserOS tools were unavailable;
the existing isolated Chrome acceptance runner was used.

Media inputs are synthetic; these checks establish integration and layout, not
speech-recognition or behavioral-score accuracy. Physical devices, native print
dialogs, other browsers, and external providers retain their documented limits.
The production backend and ML code were unchanged; their suites were not repeated
for this layout task.

To verify alongside a running local app, start a separate Vite instance with
`API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`,
then run `../.venv/bin/python tests/live_site_check.py --browser --browser-only --headful --api-port 8001 --base-url http://127.0.0.1:5174/api`
from `backend`. Prefix the latter command with `CALL_ONLY=1` for the focused
workspace, call, and print journey.

## Full-screen speech-only follow-up — 4 November 2026

The call now fills the viewport, hides the round sequence, and has no answer editor,
code editor, or confidence questionnaire. Captions are read-only. Re-recording clears
the discarded transcript and its metrics; final spoken words are saved before the
next question. Technical algorithm prompts are answered verbally. Microphone denial
blocks submission with a retry message instead of offering a typed answer.

New sessions use the enforced voice API contract. Older owned active sessions upgrade
idempotently, preserving submitted answers and converting pending coding prompts.
Voice submissions must contain a consented recognized transcript matching the answer.
The API cannot independently authenticate client-reported speech observations.

Automatic speech-flow and confidence cues use observed pause share, pace, and filler
rate, with minimum sample/coverage requirements. Attention cues combine face presence
and tab visibility from the same answer. These are documented coaching heuristics,
not validated measures of mental confidence, attention, or language proficiency.
Camera appearance does not influence confidence cues.

Initial focused Chrome run: **27 checks passed**, including no typing/round list,
viewport fill, automatic camera, re-recording, final-word saving, media continuity,
cancellation, persisted automatic reports, and blocked empty/typed submission when
microphone access is denied. Desktop and mobile screenshots were reviewed in
`interspars-browser-results-hfYcjw`. Test database removal was confirmed.

Frontend: **48 tests passed**. Build and lint passed; 19 retained legacy warnings
and the existing lazy face-model size warning remain. Backend checks additionally
cover all-voice technical completion without code execution, transcript matching,
owned/idempotent legacy upgrades, automatic cue thresholds, camera-independent
confidence cues, and unavailable/short/incomplete samples.

Final results: **160 backend tests**, **48 frontend tests**, **122 full-site Chrome
checks**, and **29 final focused call checks** passed. Full-site artifacts are
`interspars-browser-results-JherOv`; the final call artifacts are
`interspars-browser-results-Zetnw0`. The latter verifies entering/exiting browser
fullscreen as well as the viewport-filling layout. Both completed HR and technical
spoken journeys, saved reports, PDF generation, account/resume flows, and cleanup
passed. No uncaught browser exceptions or unexpected HTTP 5xx responses were seen.
The final disconnect safeguard marks an aborted capture incomplete; the existing
incomplete-capture rules suppress unsupported speech estimates.

Synthetic audio/video and controlled speech events establish integration only.
Real-device recognition, face detection accuracy, audible speech quality and the
coaching thresholds still need independent validation. Earlier entries below are
historical; their typed fallback and self-rating descriptions no longer describe
the supported call UI.

## Core voice/video verification — 4 November 2026

The canonical interview now connects question playback, browser recognition,
editable final transcripts, local camera/face detection, microphone observations,
and persisted delivery reports. Voice mode requires consent and an explicit join.
Confidence is self-rated; face presence/framing and page visibility are observations,
not measurements of psychological confidence, eye contact, or actual attention.

| Check | Result |
| --- | --- |
| Backend regression suite | 153 passed, including delivery validation, null semantics, weighted summaries, owned persistence, retries, and skipped answers |
| Frontend unit/component suite | 47 passed, including final-word flushing, shared stop finalization, late-callback rejection, late-permission cleanup, audio gaps, and visibility timing |
| Production frontend build | Passed; face detection is loaded only when camera use begins |
| Frontend lint | Exit 0; 19 retained legacy warnings |
| Complete Chrome application journey | 114 checks passed; no uncaught exceptions or unexpected HTTP 5xx responses; disposable database cleanup confirmed |
| Final focused call journey | 24 checks passed after the finalization repair; camera continuity, finalization/cancellation, saved pace eligibility, report reload, and denied-permission fallback; disposable database cleanup confirmed |

The full journey includes both complete interview tracks plus the new spoken-answer
flow, automatic next-question playback, local detector loading, final transcript
persistence, saved reports/reload, media cleanup, denied-microphone typed fallback,
and mobile layouts. Existing resume, account, coding, deletion, and report/PDF flows
also pass. Artifacts: `interspars-browser-results-DJdy17` in the machine's temporary
directory. Desktop and mobile call/report screenshots were reviewed.
The final focused artifacts are `interspars-browser-results-T39uNW`; this synthetic
sample had 94.6% microphone coverage and displayed 183 words/minute. Those values
describe the generated fixture, not an independently evaluated speaker.

Finalization review found a race between stopping recognition and starting another
recording or repeating a question. Controls now wait for final words, concurrent stop
requests share a result, and leaving cancels queued playback. Recognition errors or
incomplete finalization disable pace estimation for the affected answer.

Browser media checks use synthetic camera frames, a deterministic Web Audio stream,
and controlled recognition/playback events. They establish UI/media integration and
saved observations, not real-device transcription accuracy or audible voice quality.
The synthetic camera contains no human face; a zero face-presence result is expected.
Debugger/renderer stalls can lower microphone coverage; such samples correctly show
**Not measured** for pace. The focused test verifies that condition as well as eligible
pace values. No personal camera or microphone recordings were used.

The lazy face-api JavaScript chunk is approximately 1.315 MB (330 KB gzip), producing
a build-size warning. Main application JavaScript is approximately 453 KB (127 KB
gzip). Some early test attempts encountered intermittent MongoDB setup/startup
failures; successful runs confirmed disposable-database cleanup. Optional external
provider limitations below remain unresolved; browser speech is the default.

Definitions and reproduction: [voice/video feature guide](VOICE_VIDEO_INTERVIEW.md).

## UI refresh verification — 4 November 2026

The sky blue, warm beige, and navy refresh is applied to the supported React pages.
The existing auth, resume, saved-interview, and reporting contracts are preserved.
`design.md` now documents the implemented direction instead of the earlier dark/violet
reference plan.

| Check | Result |
| --- | --- |
| Frontend unit/component suite | 36 passed |
| Production frontend build | Passed after the final style changes |
| Frontend lint | Exit 0; the same 24 existing warnings remain |
| Browser driver syntax and diff whitespace | Passed |
| Complete Chrome application journey | 98 checks passed; no uncaught exceptions or unexpected HTTP 5xx responses; disposable database cleanup confirmed |
| Final targeted Chrome visual checks | 49 passed across 320, 390, 768, 1024, and 1440px widths; no overflow, one authentication wordmark, unobscured preview links, visible keyboard focus, and reduced-motion behavior |
| Report PDF extraction | HR: 6 pages, all 9 questions; technical: 8 pages, all 13 questions. Both retain the numeric score, its qualification, and the question review |

The full Chrome run covered registration, saved profile edits, consented PDF upload,
role assessment and JD matching, voice preferences, both full interview tracks,
coding/unavailable execution, reload persistence, reports, deletion, skip/early finish,
password change, and logout/login. The new preview track switch and reduced-motion
checks passed. Existing external-provider limitations were not retested or resolved
by this visual refresh.

The interrupted redesign run exposed two defects: a rotated homepage decoration
extended the page width, and the animated question heading shared a React key with
the code editor. The latter left a stale coding prompt above the next behavioral
question. The hero now contains its decorative overflow, and the heading/editor use
distinct keys. The browser journey asserts one current question heading throughout
both tracks. Printed reports retain the overall score as text when the graphical
ring is hidden.

Final visual review also corrected duplicate authentication branding caused by a
shared display style overriding a responsive utility, and reserved space for the
homepage note below the question-preview link. Screenshot capture now waits for
finite entrance animations to finish, so saved images show the settled design.

Full-journey artifacts: `interspars-browser-results-7EDgxw` in the machine's temporary
directory. The final 49-check public-page review used a temporary driver derived
from the same Chrome helpers, without account writes; its settled screenshots and
results are in `interspars-browser-results-r9fIxQ`. These artifacts contain synthetic
data only and are excluded from the commit.
The backend and ML suites were not rerun for this frontend-only follow-up; their
previous verification records below remain historical. Native speech/print dialogs,
physical devices, screen readers, Safari, Firefox, and deployment remain outside
this pass.

## Verification record — 3 November 2026

| Check | Result |
| --- | --- |
| Backend regression suite | 144 passed |
| ML regression suite | 3 passed; this does not validate model accuracy |
| Frontend unit/component suite | 36 passed |
| Production frontend build | Passed |
| Frontend lint | Passed with 24 retained legacy warnings |
| Live HTTP/MongoDB journeys | 37 checks passed on the final post-fix run; disposable database cleanup confirmed |
| Chrome acceptance | 96 checks passed in a visible temporary Chrome window; no uncaught exceptions or unexpected HTTP 5xx responses |

Frontend component tests render all 17 routed page modules and validate initial
internal links and authentication labels. Effects and interactions are covered
separately by the opt-in Chrome runner, not by server rendering.

## Chrome coverage

Public home/features/tracks/guide/pricing/resources/contact/auth pages loaded at
desktop and mobile sizes. FAQ expansion, resource filtering and actual Markdown
downloads passed. Screenshots were inspected for phone and tablet presentation.

The signed-in journey covered registration and validation, profile persistence,
consented PDF upload, provisional role assessment, job-description validation and
matching, saved voice preferences, both complete interview tracks, coding-language
selection and unavailable-runner messaging, reload persistence, account-history
report links, skip/early finish, session/resume deletion, password changes and
logout/invalid/valid login. Each completed report generated a PDF; extracted text
confirmed the report heading and question review (HR: four pages; technical: five).

The final Chrome run and its disposable database cleanup both passed. Runtime
artifacts are in `interspars-browser-results-P0OTIJ` under the machine's temporary
directory; they contain only synthetic test data and are not committed.

## Live API coverage

- Vite proxy, FastAPI health, private-response headers, direct API CORS, MongoDB indexes.
- Signup, duplicate signup, invalid/valid login, profile persistence, authentication boundaries.
- Consented DOCX and text-PDF upload, structured analysis, latest-resume replacement,
  corrupt/no-text PDF rejection without overwriting the previous resume.
- All five provisional role assessments, job-description coverage, idempotent assessment
  storage, latest-history sorting, ownership and deletion.
- Full 9-question HR and 13-question technical journeys, resume-derived question context,
  reports, reload persistence and persistence after stopping/restarting FastAPI.
- Duplicate/stale submissions and two genuinely concurrent MongoDB answer writes:
  one advances, the other receives 409.
- Owned session deletion, early completion, resume/assessment deletion, password-change
  and logout token revocation.

The runner drops only the unique database it created and verifies its removal.
Failed setup attempts were corrected for the host's database-name limit and Vite's
own OPTIONS response. Database creation was rejected for the overlong name; subsequent
created test databases were removed.

## Confirmed repairs

| Problem | Repair and evidence |
| --- | --- |
| Repeated profile reads consumed the 30/minute credential-attempt budget | Separate credential POST endpoints from general requests. A failing HTTP regression reproduced 429 on routine reads; regression now passes and credential throttling remains tested. |
| Tablet navigation clipped account actions or wrapped controls outside the header | Show the compact navigation below 1280px. Chrome screenshots confirmed the defect; tests now check control bounds as well as document overflow. |
| Login/signup labels were not associated with fields | Add explicit labels, autocomplete hints and error announcements; component regressions pass. Extend label associations to account/profile/password and resume-upload controls. |
| Password-change instructions said six characters while validation requires eight | Correct the account form's instruction. |
| Home page displayed an unsupported 4.9 rating, live fabricated metrics and vocal-cadence claims | Remove the rating and metrics, explain actual feedback, label the question preview, and point the practice-tracks CTA to its real destination. |

Some early browser-run failures were test-driver errors: DOM serialization, text
matching and an incorrect JD result label. These were corrected rather than counted
as application defects. Fast automated navigation also reached the general 120/minute
API limit; the driver now paces independent scenarios without disabling that protection.

## External services and limits

- **Groq:** unavailable through the application; a direct synthetic diagnostic returned
  HTTP 404. Service configuration/access still needs investigation. No key was printed.
- **Edge TTS:** unavailable; direct WebSocket handshake returned HTTP 403. The API
  returns its controlled unavailable response.
- **Judge0:** not configured. Code is saved; execution reports unavailable and never
  runs on this host. Successful isolated execution is not established by this pass.
- Chrome uses a fresh profile. The final full run used a visible window after this
  machine's headless debugger repeatedly stalled following pacing pauses. This is
  a test-environment limitation, not a demonstrated application failure.
  Viewports cover 390px mobile, 768px
  dashboard/tablet, 1024px public/tablet and 1440px desktop; these are emulated sizes.
- Audible speech, actual microphone transcription, native print-dialog interaction,
  screen-reader behavior, physical devices, Safari and Firefox still need manual or
  dedicated acceptance. Browser PDF generation is a separate check from the print dialog.
- Deployment, clean remote CI, load testing, MongoDB backup/retention behavior and
  independent ML validation remain outside this local verification pass.

## Reproduce

Start Vite on `127.0.0.1:5173` with its normal proxy to port 8000. Leave port 8000 free.
Use the project's Python environment and configured MongoDB connection. The database
account must be able to create/drop disposable databases.

```sh
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

In a second terminal:

```sh
cd backend
../.venv/bin/python tests/live_site_check.py
../.venv/bin/python tests/live_site_check.py --check-providers
../.venv/bin/python tests/live_site_check.py --browser --browser-only --headful
```

`--check-providers` sends short synthetic content to configured providers. `--browser`
includes both API and browser journeys; `--browser-only` skips repeating the API suite.
`--headful` shows the temporary test window and is recommended on this Mac; omit it
for headless testing in an environment where that mode is reliable.
Chrome defaults to the standard macOS application path; set `CHROME_BIN` for another
installed Chrome/Chromium executable. No browser/dependency download is performed.
The CDP driver uses the `ws` client already present through `socket.io-client`.

Screenshots, synthetic downloaded notes/PDFs and browser results are written to a
temporary results directory whose path the runner prints. The temporary Chrome profile
and PDF upload fixture are removed. These artifacts and all environment files are
excluded from commits.
