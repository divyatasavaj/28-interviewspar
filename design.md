# design.md — InterviewSpar

## 1. Design Direction
Three references map cleanly onto InterviewSpar's three main surfaces — use each one for the surface it fits, don't force one style across the whole app:

| Reference | Maps to | Why |
|---|---|---|
| **Image 1 (Vision Pro style)** | Landing/marketing page | Soft, light, glassy cards — good for a first-impression "what is this product" page |
| **Image 2 (InterviewAI call UI)** | Live interview session screen | Dark, focused, sidebar nav, radar chart + score bars + chat — exactly the interview experience InterviewSpar needs |
| **Image 3 (Fitness dashboard)** | Student/Company dashboard | Dark glassmorphic stat cards, activity graph, calendar — perfect for session history, progress tracking, scheduling |

This gives a coherent product: a light, inviting landing page → a focused dark interview room → a dark glass dashboard for tracking progress. Same design language (rounded corners, soft shadows, glass blur), different density per screen.

---

## 2. Color Palette

### Core brand colors (used everywhere)
| Role | Color | Hex |
|---|---|---|
| Primary accent (interview UI, buttons, active states) | Violet/Indigo | `#7C3AED` |
| Secondary accent (landing page warmth, highlights) | Warm Amber | `#F5A623` |
| Tertiary accent (success/positive metrics) | Deep Green | `#0F7A5C` |

### Landing page (light mode — Image 1 style)
| Role | Hex |
|---|---|
| Background | `#F5F1EA` (warm off-white) |
| Card surface | `#FFFFFF` / soft cream `#FDF8F0` |
| Card accent 1 (amber gradient card) | `#F5A623` → `#E8871A` |
| Card accent 2 (green gradient card) | `#0F7A5C` → `#0B5E47` |
| Text primary | `#1C1C1E` |
| Text secondary | `#6B6B6B` |

### Interview session + Dashboard (dark mode — Image 2 & 3 style)
| Role | Hex |
|---|---|
| Background | `#0F0F13` |
| Sidebar background | `#17171C` |
| Card/panel surface (glass) | `rgba(255,255,255,0.05)` with `backdrop-blur` |
| Card border | `rgba(255,255,255,0.08)` |
| Primary accent (active nav, buttons) | `#7C3AED` |
| Score good | `#22C55E` |
| Score warning | `#F5A623` |
| Score poor | `#EF4444` |
| Text primary | `#F4F4F5` |
| Text secondary | `#9CA3AF` |

Keep the palette locked to this — don't introduce new colors per screen. Status colors (good/warning/poor) only ever apply to scores/metrics, never decorative use.

---

## 3. Typography
- **Headings:** Inter (Semibold/Bold)
- **Body:** Inter (Regular/Medium)
- **Scores/numbers (dashboard stat cards):** Inter (Bold), slightly larger size to match Image 3's big number treatment (e.g. "9,886 Steps")
- **Code/technical:** JetBrains Mono
- Base size: 16px body, headings scale 1.25x per level
- Landing page can use slightly larger, looser line-height headings (Image 1's relaxed hero text feel) — dashboard/session screens stay tighter and denser (Image 2/3 feel)

---

## 4. Layout Patterns Per Screen

### Landing Page (Image 1 reference)
- Light background, floating rounded cards arranged in a loose grid (not a strict table) — mix of text-only cards and gradient-image cards
- Top nav: logo left, links center, primary CTA button (pill-shaped) right
- Large hero heading top-left, supporting cards fan out around it
- Generous white space, soft drop shadows (never harsh), 16-24px card radius

### Interview Session Screen (Image 2 reference)
- Left: fixed icon+label sidebar (Dashboard, Interview, Insight, candidates/Talent, Settings) — matches InterviewSpar's own nav needs (Practice, History, Reports, Settings)
- Center: main video/chat panel — student's camera feed (or avatar if camera off), AI interviewer represented as a calm waveform/avatar element, live transcript caption bar under the video (ties to Module 9 subtitles)
- Right panel, top: two circular progress rings side by side — repurpose as **"Ability Estimate"** and **"Fluency Score"** (directly maps to Module 2 + Module 4 output)
- Right panel, middle: live chat/notes panel (repurpose as **live mistake-tag feed** — each flagged mistake appears here in real time, like a chat message)
- Bottom: **radar chart** — perfect existing component for showing per-topic ability breakdown (e.g. axes: DSA, System Design, Communication, Problem Solving, Resume Depth) — directly visualizes Module 2's per-topic ability estimates
- Bottom-right: **horizontal score bars** — repurpose for Module 4's mistake categories (e.g. "Structure 90%, Fluency 60%, Resume Defense 85%") with color coding (green/amber/red per the palette)

### Dashboard Screen (Image 3 reference)
- Left: thin icon-only rail (matches Image 3's minimal icon sidebar) for quick section switching
- Top-left greeting card: "Good [morning/afternoon], [Name]" + one-line encouragement, matches Image 3's warm personal tone
- Top stat row: 4 small glass cards (repurpose Image 3's Calories/Heart Rate/Steps/Sleep pattern into **Sessions Completed / Avg Fluency Score / Ability Level / Integrity Flags**)
- Main activity graph (large card): repurpose the line-chart into **Ability Progress Over Time** (per topic, selectable)
- Secondary card next to it: repurpose the "Running with resistance band" image-card into a **"Next Recommended Practice"** card — topic + difficulty suggestion, prominent CTA
- Right column: profile summary card (top) + calendar (repurpose for **scheduled mock interviews / marketplace sessions**) + "Scheduled" list below (repurpose as **Upcoming Sessions** list with thumbnails swapped for interviewer/company initials)
- Bottom section (below fold): repurpose "Diet Plan" 3-card row into **"Practice Focus Areas"** — 3 cards for weak topics with a one-line tip each

---

## 5. Component Style Guide

**Cards**
- Radius: 16-20px, consistent across all screens
- Light mode (landing): soft shadow, `0 8px 24px rgba(0,0,0,0.06)`
- Dark mode (session/dashboard): glass effect — semi-transparent white overlay + `backdrop-filter: blur(16px)`, thin light border instead of shadow

**Buttons**
- Pill-shaped (fully rounded), matches all 3 references
- Primary: solid violet `#7C3AED`, white text
- Secondary: outline or translucent white on dark backgrounds
- Landing page CTA: solid green `#0F7A5C` (matches Image 1's green button) for the main "Get Started"

**Radar Chart** (interview session — ability breakdown)
- Muted violet fill at ~20% opacity, solid violet stroke
- Axis labels in text-secondary color, small and unobtrusive
- Use `recharts`' `RadarChart` component — free, matches this exactly

**Progress Rings** (ability estimate / fluency score)
- Circular, thin stroke (~6-8px), violet or green depending on score band
- Big bold number in center (matches Image 2's "80% / 75%" treatment)

**Score/Progress Bars** (mistake category breakdown)
- Horizontal, rounded ends, color reflects score band (green ≥75%, amber 50-74%, red <50%)
- Label + percentage on the same row, bar directly below (matches Image 2's Workmap Score list)

**Chat/Feed Panel** (live mistake-tag feed during session)
- Right-aligned bubbles for AI-side flags, left-aligned for context/student info
- Timestamp small and muted above each entry
- Auto-scrolls to latest flag during a live session

**Calendar Widget** (dashboard — scheduled sessions)
- Compact month grid, current day highlighted in violet, scheduled-session days marked with a small dot/badge
- Matches Image 3's calendar exactly — reuse a free library like `react-calendar` and restyle with the palette above

---

## 6. Tone of Microcopy
- Supportive, direct, never harsh — "This answer lacked structure — try leading with the situation first" not "Wrong answer"
- Dashboard greeting stays warm and personal (Image 3's "Good Morning, Lionel 👋" pattern) — e.g. "Good morning, Vipul — ready for today's practice?"
- Celebrate progress explicitly wherever a stat improves session over session

## 7. Dark/Light Mode Scope
- Landing page: light mode only (Image 1 style is inherently light/warm, don't force a dark variant)
- Interview session + Dashboard: dark mode primary (Image 2/3 style) — this is where students will spend actual practice time, and dark reduces eye strain in longer sessions
- If time allows post-MVP: light mode toggle for dashboard only, using the same token structure with backgrounds/text inverted

## 8. What NOT to copy from references
- Image 1's literal "Apple hero design" marketing copy — placeholder lorem-ipsum-style text in the reference, don't reuse wording
- Image 3's fitness-specific content (calories, heart rate) — only the *layout pattern* transfers, not the content domain
- Any literal branding/logos visible in the reference screenshots — build InterviewSpar's own logo/wordmark, don't reuse "Vision Pro" or "InterviewAI" naming or marks
