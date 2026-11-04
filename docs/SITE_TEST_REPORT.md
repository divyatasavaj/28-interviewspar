# Site verification — 3 November 2026

Scope: the supported React/Vite → FastAPI → MongoDB application on branch `b3`.
Tests use synthetic accounts and resumes in a unique disposable database. Existing
application records and browser profiles are not used. No dependencies were installed
for this pass.

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
