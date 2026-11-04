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
buttons use blue with white text, rounded corners, and a small pressed effect.

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
- **Dashboard and account:** light cards, a sky/beige welcome panel, readable
  saved-session history, resume upload, and existing profile/voice controls.
- **Resume intelligence:** evidence, role/JD controls, findings, recommendations,
  and assessment limitations remain accessible. Provisional numerical scores
  remain unavailable; missing evidence is not a zero score.
- **Interview setup:** retain domain, experience, track, mode, and consent controls.
  Show the selected track's rounds and explain saved progress and optional speech.
- **Interview room:** a round list on desktop wraps above the question on phones.
  Display answered progress, one current prompt, coding where applicable, typed
  answers, optional speech, skip/finish controls, and practice-mode feedback.
- **Reports:** display the score with its qualification, round details, saved
  answers, and feedback. Print layouts keep the score as text, omit action
  buttons, and preserve the question review and evidence limitations.

## Motion and accessibility

Page entrances finish in about half a second; the homepage card floats once and
settles. Hover and pressed feedback are brief. `prefers-reduced-motion: reduce`
disables animations and transitions. Controls retain visible keyboard focus;
icons supplement text, and the current interview round uses `aria-current`.

Keep decorative overflow inside the hero without hiding page-wide content.
Public/workspace navigation switches to a compact menu below 1280px; interview
and authentication layouts adapt below 768px. Tables may scroll within their own
container. UI numbers must come from saved application evidence, with unavailable
scores and unverified technical correctness visibly distinguished.

## Verification

See `docs/SITE_TEST_REPORT.md` for the current checks, browser evidence, and
remaining device/provider limitations. The redesign does not enable the retained
legacy marketplace, payments, live rooms, anti-cheat, or certificate flows.
