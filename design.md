# InterviewSpar design system

Updated 4 November 2026 for the approved sky blue, warm beige, and navy refresh.
This direction supersedes the earlier violet/dark-screen reference plan. It applies
to the supported React application and its existing forms and interview flow.

## Palette and type

| Role | Value |
| --- | --- |
| Primary action | `#126fa4` |
| Hover action | `#075985` / `#0c6090` |
| Sky surfaces | `#eaf5fd`, `#dcedf9` |
| Page background | `#f8f5ef`; homepage `#fcfaf6` |
| Warm surfaces | `#f5eddf`, `#f3ebdc` |
| Primary text | `#193449` |
| Secondary text | `#526477` |
| Keyboard focus | `#278bc2`, 3px outline with 4px offset |

Use Inter with system sans-serif fallbacks; code keeps a monospace font. Preserve
red, amber, and green for meaningful error, caution, and evidence states. Main
buttons use blue with white text, rounded corners, and a subtle pressed effect. Avoid deep button shadows or competing accent cards.

Shared tokens live in `frontend/src/index.css`, with component and responsive
styles in `frontend/src/styles/ui.css`. `Brand`, `UiIcon`, and `AuthLayout` supply
reusable identity, decorative line icons, and authentication layout. The Tailwind
configuration remains a legacy compatibility file; Vite uses Tailwind 4 tokens.

## Screens

- **Homepage:** spacious hero, a clearly labeled interactive question preview,
  bounded decorative sky shapes, warm feature cards, and direct practice links.
  Examples carry no fabricated evaluation, user count, or hiring-success claim.
- **Authentication:** split story/form layout on desktop and a compact form on
  phones. Keep explicit field labels, validation, autocomplete, pending states,
  and error announcements connected to the existing API.
- **Dashboard:** surface start, resume, and latest report actions above recent
  history. The resume summary links to the dedicated page for role and
  job-description matching.
- **Account:** use the shared workspace navigation and persistent section links for
  profile, resume, reports, and voice preferences. Keep identity compact.
- **Resume intelligence:** evidence, role/JD controls, findings, recommendations,
  and assessment limitations remain accessible. Provisional numerical scores
  remain unavailable; missing evidence is not a zero score.
- **Interview setup:** retain domain, experience, track, mode, and consent controls.
  Group interview details separately from feedback/privacy. Explain the spoken call.
- **Interview room:** use spoken prompts and read-only captions for the interview.
  For hands-on coding, place the prompt, editor, and sample controls alongside the
  live camera tile. Show playback,
  microphone, and transcript review status by the captions and controls. Require
  transcript review before sending. Separate participant
  tiles, the current question, read-only captions, and grouped controls. Keep microphone,
  re-record, repeat, skip, send, camera, disconnect, fullscreen, and finish available.
  Live observations and previous feedback use distinct, mutually exclusive disclosures.
- **Reports:** surface feedback from a specific answer, show the score with its
  qualification, and let users expand individual transcripts. Compact printing
  includes questions, feedback, and summary observations. Full printing adds
  transcripts and delivery details. Printing restores the previous disclosure state.

## Motion and accessibility

Page entrances finish in about half a second; the homepage card floats once and
settles. Hover and pressed feedback are brief. `prefers-reduced-motion: reduce`
disables animations and transitions. Controls retain visible keyboard focus;
icons supplement text, and active page/section links use `aria-current`.

Keep decorative overflow inside the hero without hiding page-wide content.
Public navigation switches to a compact menu below 1280px and workspace navigation
below 900px; interview
and authentication layouts adapt below 768px. Tables may scroll within their own
container. UI numbers must come from saved application evidence, with unavailable
scores and unverified technical correctness visibly distinguished.

## Verification

See `docs/SITE_TEST_REPORT.md` for the current checks, browser evidence, and
remaining device/provider limitations. The redesign does not enable the retained
legacy marketplace, payments, live rooms, anti-cheat, or certificate flows.

## Layout organization

Workspace pages share a 1160px content width, 28px desktop/20px mobile gutters,
32px desktop headings, 18px card corners, and a restrained border/shadow treatment.
Use one prominent next action per area. Related actions stay together; destructive
or exit actions stay apart. Page-section links help navigate long resume/report pages.
Mobile account sections form a two-column grid so all settings remain discoverable.
All original routes, forms, saved evidence, report actions, and media capabilities
remain available; reorganization does not change scoring or interview behavior.
