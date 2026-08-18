# PRD — InterviewSpar Proctoring V2: Mobile-Device Detection & Real-Time Face-Detection Performance

| Field | Value |
|---|---|
| Product | InterviewSpar — AI Interview Practice & Assessment |
| Document status | Draft v0.1 |
| Author | Product / Engineering (Rudra Vaghela + team) |
| Date | 2026-08-16 |
| Repo | `interviewspar` (`backend/` FastAPI + MongoDB · `frontend/` React 19 + Vite 8) |
| Related docs | `flow.md` (backend logic), `task.md` (task breakdown) |

---

## 1. Executive Summary

InterviewSpar runs live AI interviews with on-device proctoring (face, body, hand,
attention). Two problems block it from being a trustworthy, production-grade exam tool:

1. **No mobile-device detection.** A candidate can hold a phone off to the side, read
   answers from it, or point it at the screen — none of this is flagged. The CV stack
   (`@vladmandic/human`) is loaded with **object detection disabled**
   (`object: { enabled: false }`), and the existing `hand_near_face` / `arms_crossed` /
   `looking_away` signals are heuristic-only and produce nothing actionable.

2. **Face detection is choppy.** The current loop runs all CV models
   (face-mesh + iris + pose + hand-skeleton) at **full 640×480 resolution on the main
   thread**, at a fixed 500 ms cadence, and calls React `setState` on every frame.
   Result: 3–7 FPS, event-loop jank, and a visibly stuttering overlay — which also makes
   the proctoring signals unreliable (missed frames, delayed "face lost" flags).

This PRD specifies the fixes: a **mobile/phone detection subsystem** built on
TensorFlow.js COCO-SSD running in a **Web Worker**, fused with the existing hand/pose
signals, and a **detection-engine refactor** that moves inference off the main thread,
downscales inputs, duty-cycles heavy models, and throttles React updates.

---

## 2. Problem Statement

### 2.1 Mobile-device cheating is undetected
- The most common online-exam cheat is a second device (phone/tablet/smartwatch) hidden
  in the lap, held beside the webcam, or pointed at the screen to photograph questions.
- Current system has zero object recognition, so a phone in frame is invisible to it.
- Existing pose heuristics (`hand_near_face`, `hand_off_screen`) generate noisy
  "warnings" but no hard, trustworthy flag a reviewer can act on.

### 2.2 Face detection is too slow to be useful
- Inference runs at full camera resolution on the UI thread.
- Every heavy model (iris, mesh, pose, hand) runs on **every tick**.
- Fixed 500 ms `setTimeout` cadence means the pipeline is *slower than the camera*, so
  the UI stutters and integrity events are delayed or missed.
- Every tick calls `setState` → full re-render of the detection subtree + analytics panel.

---

## 3. Goals & Success Metrics

### 3.1 Goals
| # | Goal |
|---|---|
| G1 | Detect a visible mobile/smart device in the webcam frame within ~2 s and raise an audible + visual alarm. |
| G2 | Raise detection engine to a **smooth, sustained 8–15 FPS** with < 50 ms main-thread jank. |
| G3 | Keep all video analysis **client-side** (no frames leave the browser) to preserve the privacy promise. |
| G4 | Make phone-detection flags **defensible** (debounced, confidence-gated, fused with pose evidence). |
| G5 | Extend backend integrity model with a `device` category + `mobile_phone_detected` critical event, aggregated into reports. |

### 3.2 Success Metrics (KPIs)
| Metric | Target |
|---|---|
| Detection FPS (sustained, mid-range 2019+ laptop, integrated GPU) | ≥ 8 FPS (target 10–15) |
| P95 frame-processing time (detect + draw) | ≤ 120 ms |
| Main-thread long tasks during monitoring | < 50 ms |
| Phone-in-frame → alarm latency (≥ 2 s visible) | ≥ 95% detection |
| False-positive phone flags per session | ≤ 1 |
| Vision model load time (broadband) | ≤ 6 s |
| Privacy | 0 frames transmitted for CV (bug fix required, see §6.4) |

---

## 4. Personas & User Stories

- **Candidate (primary):** takes a timed technical/HR interview in Chrome. Wants no
  disruption, understands that cheating is monitored.
  - *As a candidate, I want my phone use to be caught instantly so cheaters can't steal my score.*
  - *As a candidate, I want the camera overlay to be smooth so the interview doesn't feel broken.*
- **Proctor / evaluator:** reviews `reports` + `integrity_logs` after the session.
  - *As a proctor, I want clear, timestamped `mobile_phone_detected` events so I can verify violations without re-watching video.*
- **Developer (our team):** maintains `FaceDetection.jsx`, `faceLogic.js`, backend integrity routes.
  - *As a developer, I want the CV pipeline modular and testable (pure logic in `lib/`, worker isolated) so we can tune thresholds safely.*

---

## 5. Current State Analysis

### 5.1 Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind 4, react-router 7 |
| Vision | `@vladmandic/human` 3.3.6 (BlazeFace + facemesh + iris + MoveNet + handtrack) |
| Backend | FastAPI + uvicorn, PyMongo, MongoDB (Atlas/local), JWT (python-jose), bcrypt |
| LLM | Groq (primary) + Gemini (fallback) |
| Integrity API | `POST /integrity/*` → `integrity_logs` collection |

### 5.2 Relevant files (as of v0.1)
| File | Role |
|---|---|
| `frontend/src/components/FaceDetection.jsx` | Tiered detection loop (native → human → pixel-fallback) |
| `frontend/src/lib/faceLogic.js` | Pure edge-triggered event state machine (`stepState`) |
| `frontend/src/pages/Interview.jsx` | Camera boot, attention scoring, integrity wiring |
| `frontend/src/components/IntegrityMonitor.jsx` | Tab/blur/fullscreen events + consent |
| `frontend/src/components/InterviewAnalytics.jsx` | Live stats panel (re-renders every tick) |
| `backend/app/services/anticheat.py` | Severity/category maps + summary aggregation |
| `backend/app/routes/integrity.py` | `/integrity/*` endpoints |
| `backend/app/routes/video.py` | `/video/*` (frame analysis, pose heuristics) |

### 5.3 Root-cause findings (what makes it slow / why phones aren't caught)

**Choppiness (detection)**
1. **Full model stack every tick** — face-mesh + iris + MoveNet + hand-skeleton all run together at 2 FPS; iris alone is one of the most expensive models and is enabled even though head-pose comes from facemesh rotation.
2. **Full-resolution input** — detectors receive 640×480; model inference cost scales with input area. Face detection only needs ~160–224 px input.
3. **Main-thread inference** — `humanInstance.detect(video)` blocks the UI thread (only `async` I/O, not parallel compute).
4. **Fixed 500 ms `setTimeout` cadence** — no frame pacing, no `requestVideoFrameCallback`; when a tick runs long, the loop simply falls further behind → stutter.
5. **React churn** — `setStats`/`setDebug`/`setFlags`/`setPoseAlerts` on every tick + parent `onFacesDetected` → `setAnalytics` → full `Interview` re-render at 2 Hz; plus `canvas.width = video.videoWidth` re-allocates the canvas backing store every frame.
6. **Dev-mode StrictMode** double-mount doubles model load/detection on mount.
7. **Pixel-brightness fallback tier** runs a meaningless per-pixel loop at 500 ms — remove or gate it behind "no CV available".

**Phone detection (feature gap)**
8. `humanConfig.object.enabled = false` — Human ships an object detector, but it's never used.
9. No COCO-style "cell phone" class anywhere in the pipeline.
10. `hand_near_face` / `arms_crossed` heuristics fire on ordinary gestures (touching chin, resting arm) → noisy, low-trust warnings that reviewers ignore.
11. **Privacy contradiction:** `IntegrityMonitor` says *"Video never leaves your browser"*, yet `Interview.jsx` and `CameraView.jsx` both POST JPEG base64 frames to `/video/analyze-frame` every 5 s. Must be reconciled (either stop sending frames, or fix the consent text and treat it as evidence capture).

**Backend efficiency findings (bonus — fix opportunistically)**
12. `adaptive.py` queries `db.sessions.find_one({"_id": user_id})` — wrong key (`user_id` is a field, not `_id`); ability profile is never persisted correctly.
13. `video.py` pose heuristics duplicate client-side logic (`analyzePoseClient` in `FaceDetection.jsx`) — single source of truth should be the client + a server-side *audit-only* path.
14. `/video/analyze-frame` does an upsert `$push` per event → N round-trips per frame; batch integrity events instead.
15. `CameraView.jsx` and `Interview.jsx` both boot the camera and both call `/video/start` (duplicate video sessions).

---

## 6. Requirements

### 6.1 Functional — Mobile/Device Detection (FR-1)

**FR-1.1 Device object detection**
- Add `@tensorflow-models/coco-ssd` (Lite MobileNet V2, ~3–6 MB) loaded **lazily** in a **Web Worker** (`src/workers/detection.worker.js`) after the user consents to monitoring.
- Detect COCO classes `cell phone` (index 67) and `watch` (index 77); flag only `cell phone` by default (`watch` behind a config flag to control false positives).

**FR-1.2 Signal fusion & debounce**
- A phone alert requires **all three** conditions to hold for ≥ 8 of 10 consecutive samples (sample cadence ~200 ms → ~1.5–2 s):
  1. Phone box present with `score ≥ 0.5` (default; tunable via `VITE_PHONE_CONF_MIN`).
  2. **Size gating** — phone box is large enough to be "in hand" (e.g. box area ≥ 1.5% of frame) and not a tiny far-away object; reject stationary phones resting > 60 cm away by requiring corroborating evidence.
  3. **Corroboration (≥ 1 of):** hand box/palm-landmark overlaps the phone box **OR** wrist keypoint is inside the phone box bounds **OR** head pitch (gaze) is down > 10° from neutral **OR** the phone is detected in the lower 1/3 of frame (lap position).
- Consecutive-sample state machine lives in a pure function (extend `faceLogic.js` or new `lib/phoneLogic.js`) so it's unit-testable.

**FR-1.3 Alarm UX (in-session)**
- On confirmed alert:
  - Full-screen red warning overlay (`Phone detected — put your phone away or your session will be flagged.`) with a 5-second auto-dismiss or "I understand" button.
  - Audio alarm (2 short beeps, using `AudioContext`/`speechSynthesis`, muted-safe).
  - Persistent red badge + `IntegrityMonitor` event chip.
  - During **Assessment** mode: alert automatically logs a `critical` event; optionally auto-warn proctor via report.

**FR-1.4 Backend + reporting**
- New integrity event type: `mobile_phone_detected`.
  - Add to `_LEVEL_MAP`: `mobile_phone_detected: "critical"`.
  - Add to `_CATEGORY_MAP`: `mobile_phone_detected: "device"`.
- New optional endpoint `POST /integrity/device-event` (or reuse `/integrity/event`) accepting `{ session_id, device_type, confidence, evidence_signal }`.
- `compile_integrity_summary` already promotes any `critical` event to `risk_level: "high"` — device flags will flow into reports automatically.
- Persist evidence **metadata only** (no image): timestamp, confidence, fused signals, device_type.

**FR-1.5 Pre-session workspace scan (optional, Phase 3)**
- At interview start, request a 2–3 s "desk scan" clip (`getUserMedia`) analyzed by the same worker; surface "remove your phone from the desk" guidance before the exam clock starts.

### 6.2 Functional — Smooth Face Detection (FR-2)

**FR-2.1 Move inference to a Web Worker**
- Detection runs in `detection.worker.js`. Two options, decide in M1 spike (recommend MediaPipe):
  - **Recommended:** `@mediapipe/tasks-vision` (FaceDetector short-range @ 128/256 px input, SIMD/WASM, native worker support) + `FaceLandmarker` for head-pose/attention.
  - **Fallback:** keep `@vladmandic/human` but construct `new Human(...)` *inside* the worker (Human supports worker mode) with the reduced config below.
- Main thread only paces frames (`requestVideoFrameCallback`), copies the frame via `OffscreenCanvas` + `ImageBitmap`/transferable, and draws results. Zero inference on the UI thread.

**FR-2.2 Downscale detection input**
- All models infer on a fixed small input (160–224 px wide), not the raw 640×480 video.
- Keep the display canvas at screen size but only re-allocate on dimension change.

**FR-2.3 Duty-cycle heavy models**
| Model | Purpose | Cadence |
|---|---|---|
| FaceDetector | count/box (fast path) | every tick (~10 FPS) |
| FaceLandmarker | head-pose / attention | every 3rd tick (~3 FPS) |
| Pose (MoveNet) | person count / hands | every 5th tick (~2 FPS) or on-demand |
| Hand landmarks | phone-fusion corroboration | on-demand (only while phone detector is "warm") |
| COCO-SSD (phone) | device detection | every 5th tick (~2 FPS) in a separate worker |

**FR-2.4 Throttle React updates**
- Push stats/debug/pose state to React at **2–4 Hz** via a ref-buffered accumulator + reducer (not `setState` per tick).
- `onFacesDetected` parent callback throttled to same cadence; analytics panel subscribes to the buffered snapshot.
- Integrity events buffered client-side and flushed in **batches** (`POST /integrity/event` with an array or a new `/integrity/batch`).

**FR-2.5 Adaptive quality**
- Probe device capability once (WebGPU availability, cores, `navigator.hardwareConcurrency`); pick model tier + max FPS (e.g. high tier 12 FPS, low tier 6 FPS).
- Keep the existing slow-frame feedback (avg inference time → adjust cadence) but as *upshift*, not only *downshift*.

**FR-2.6 Cleanups**
- Remove the pixel-brightness fallback tier (or gate behind explicit flag) — it adds noise, not signal.
- Delete duplicate camera boot in `CameraView.jsx` (only `Interview.jsx` boots camera + `/video/start`).
- Reconcile frame-upload: stop sending frames to `/video/analyze-frame`, or update consent copy to say frames ARE captured as evidence.
- Keep `React.StrictMode` dev double-mount safe (guard worker/model init with a singleton ref).

### 6.3 Non-Functional Requirements (NFR)
| # | Requirement |
|---|---|
| NFR-1 | Performance: see §3.2 targets. Verified with Chrome DevTools Performance + long-task trace over a 10-min session. |
| NFR-2 | Compatibility: Chrome / Edge latest; graceful degradation to 2 FPS + `setTimeout` loop if `requestVideoFrameCallback` / WASM unavailable. |
| NFR-3 | Privacy: 0 frames transmitted for CV; only event metadata + (optional, consented) evidence stills. |
| NFR-4 | Security: worker code is same-origin, bundled by Vite; no new network egress except existing `/integrity` API. |
| NFR-5 | Resource use: model memory budget ≤ ~60 MB RSS delta; no new main-thread long tasks > 50 ms during monitoring. |
| NFR-6 | Reliability: worker crash → auto-restart with 1-attempt backoff, resume monitoring without session restart. |

---

## 7. Proposed Architecture

```
┌────────────────────────── Browser (frontend) ───────────────────────────┐
│                                                                          │
│  <video> ──rVFC──▶ FramePacer ──▶ OffscreenCanvas ──▶ ImageBitmap        │
│                                          │  (transferable, zero-copy)    │
│  ┌─────────────────────── Web Worker ───────────────────────┐            │
│  │  detection.worker.js                                     │            │
│  │   ├─ MediaPipe/Human FaceDetector  → faces, boxes        │            │
│  │   ├─ FaceLandmarker (duty 1:3)      → yaw/pitch/roll      │            │
│  │   ├─ MoveNet (duty 1:5)             → body count, joints  │            │
│  │   ├─ Hand landmark (on-demand)      → palm/wrist boxes    │            │
│  │   └─ COCO-SSD worker (duty 1:5)     → cell_phone/watch    │            │
│  └───────────────▲─────────────────────────┘                            │
│                  │ postMessage(results)                                 │
│  ┌───────────────┴────────────────────────────────────────────────┐     │
│  │  FusionEngine (pure)   faceLogic.js + phoneLogic.js           │     │
│  │   • person/multi/noFace/noPerson/body_part state machine      │     │
│  │   • phone state machine (debounce + fusion + size gating)     │     │
│  └───────────────┬────────────────────────────────────────────────┘     │
│                  │ throttled snapshots (2–4 Hz)                         │
│  FaceDetection.jsx ──▶ React (InterviewAnalytics, overlay, alarm)       │
│                  │ buffered integrity events (batch flush)              │
└──────────────────┼───────────────────────────────────────────────────────┘
                   │  POST /integrity/* (batched, metadata-only)
                   ▼
            FastAPI → integrity_logs → compile_integrity_summary → reports
```

**Key decisions**
- **COCO-SSD in a worker** (not Human's built-in object model): smaller, focused on the
  single `cell phone` class, and Human's `object` pipeline pulls in a heavier detector.
- **MediaPipe Tasks over @vladmandic/human for the fast path**: purpose-built WASM/SIMD,
  first-class worker support (`detectForVideo` is documented to block the main thread →
  must run in a worker anyway), better FPS on mid-range laptops.
- **Fusion before alarm** keeps false positives near zero: a phone on a desk in the
  background never matches the "in hand / in lap / gaze-down" corroboration.
- All CV stays on-device → preserves the existing privacy claim and avoids proctoring
  video storage costs.

---

## 8. Implementation Plan

### Phase 0 — Spike (≈ 3–5 dev-days)
- Benchmark `@mediapipe/tasks-vision` FaceDetector vs `@vladmandic/human` in a worker at 160/224 px on mid-range + low-end hardware.
- Measure COCO-SSD lite load time + per-inference cost in a worker.
- Decide: MediaPipe vs Human worker; confirm model hosting (Vite `public/models` or CDN with local fallback).
- **Exit criteria:** documented FPS table + chosen stack; this PRD updated accordingly.

### Phase 1 (M1) — Detection engine perf (solves "choppy")
- `detection.worker.js` + frame pacer (`requestVideoFrameCallback`) + OffscreenCanvas downscale.
- Duty-cycle config for mesh/pose/hand; fast-path face detection every tick.
- Throttled React snapshot (reducer + 2–4 Hz buffer).
- Remove pixel fallback; dedupe camera boot; fix `canvas` reallocation.
- **Deliverable:** smooth overlay; `InterviewAnalytics` shows real FPS + tier.
- **Acceptance:** NFR-1 met on target hardware.

### Phase 2 (M2) — Phone detection + alarm
- `phoneLogic.js` state machine (pure) + unit tests.
- COCO-SSD worker integration + fusion with pose/hand/gaze signals.
- Alarm overlay + audio + `mobile_phone_detected` logging.
- Backend: `_LEVEL_MAP` / `_CATEGORY_MAP` entries, batch event endpoint, summary wiring.
- **Acceptance:** FR-1.2/1.3/1.4, KPI "≥ 95% detection, ≤ 1 false positive/session".

### Phase 3 (M3) — Hardening & extras
- Device-capability tiering, worker crash-restart, benchmark dashboard.
- Pre-session workspace scan (FR-1.5).
- Fix `adaptive.py` ability-profile bug (wrong query key).
- Batch integrity writes on backend; reconcile frame-upload privacy.
- **Acceptance:** NFR-2/3/5/6; full test matrix passes.

---

## 9. API & Data Model Changes

### 9.1 Backend endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/integrity/batch` | Accept `{ session_id, events: [...] }`, single upsert/push. (New) |
| POST | `/integrity/device-event` | `{ session_id, device_type, confidence, evidence_signal, timestamp }`. (New, or fold into `/integrity/event`) |

### 9.2 Integrity log event schema (new event)
```json
{
  "type": "mobile_phone_detected",
  "device_type": "cell_phone",
  "confidence": 0.87,
  "evidence_signal": "hand_in_phone_box",
  "duration_ms": 2100,
  "timestamp": "2026-08-16T12:00:00Z"
}
```

### 9.3 `anticheat.py` mapping additions
```python
_LEVEL_MAP["mobile_phone_detected"] = "critical"
_CATEGORY_MAP["mobile_phone_detected"] = "device"
```

### 9.4 Config surface (frontend, env-driven)
```
VITE_PHONE_CONF_MIN=0.5
VITE_PHONE_MIN_AREA=0.015
VITE_PHONE_DEBOUNCE_SAMPLES=8
VITE_PHONE_SAMPLE_WINDOW=10
VITE_DETECT_FPS=10
VITE_CV_TIER=auto|high|low
```

---

## 10. UI/UX Design (Alarm)

- **Idle state:** small "monitoring" pill (existing `IntegrityMonitor`).
- **Warm state (phone candidate, not confirmed):** amber chip `device in view` with a 0.5 s fade-in — no interruption.
- **Confirmed state:** full-screen red overlay, centered message + device icon, 2-beep audio, buttons `I understand (5s)` / (Assessment) `Flag & continue`. Overlay is non-interactive with the exam area until dismissed; event is logged immediately at fire time, not at dismiss.
- **Analytics panel:** new row `Device: none / phone / watch` and `Phone alerts: n`.

---

## 11. Testing Strategy

| Level | Scope |
|---|---|
| Unit (Vitest) | `faceLogic.js`, `phoneLogic.js` (debounce, fusion, size gating, edge triggers), `anticheat` maps. |
| Integration | `/integrity/device-event` → `integrity_logs` → `/integrity/summary/{id}` risk_level `high`; batch endpoint atomicity. |
| Manual matrix | Phone in hand · phone on desk (far) · phone in lap · watch · bright/dim light · 0.5–2 m distance · 2 people · face-mask · glasses. |
| Performance | DevTools Performance long-task trace; FPS counter (real from worker); Lighthouse budget. |
| E2E | Interview start → camera → fake `phoneLogic` trigger via test hook → overlay + event logged → report shows device flag. |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| False positives (phone visible on desk) | Candidate harassment, trust loss | Size gating + hand/lap/gaze corroboration + debounce; `watch` off by default |
| Model load time / size | Slow session start | Lazy-load COCO-SSD only after consent; CDN + local fallback; preconnect |
| Privacy contradiction (frames sent today) | Trust/legal | M1: stop sending frames OR update consent text; CV stays client-side |
| Worker/WebGPU/WASM availability | Feature failure | Capability probe → tier fallback → degraded 2 FPS `setTimeout` loop |
| GPU contention with STT/LLM rendering | Jank | Duty-cycling + throttled UI + adaptive FPS |
| `adaptive.py` ability-profile bug | Wrong report data | Fix query key (`user_id` field) in M3 |
| Proctor can't verify alert | Non-actionable flags | Persist metadata-only evidence (time, signals, confidence); optional consented still image |

---

## 13. Out of Scope (v2)
- Live human proctoring / dashboards
- Server-side AI review of frames (costs + privacy)
- Audio-command detection ("Hey Siri"/"OK Google")
- Browser lockdown / tab lock enforcement (only logging)
- Mobile-app build (web-only)

---

## 14. Acceptance Criteria (Definition of Done)

1. **FR-2:** Face/person monitoring runs at ≥ 8 FPS sustained for a 10-minute session on the target hardware with < 50 ms long tasks; overlay is visually smooth.
2. **FR-1:** A phone held in hand / in lap visible ≥ 2 s triggers the alarm ≥ 95% of trials; a phone on a desk > 60 cm away triggers ≤ 1 false positive per session.
3. **FR-1.4:** A `mobile_phone_detected` critical event appears in `integrity_logs`, is aggregated by `compile_integrity_summary`, and raises session `risk_level` to `high`.
4. **NFR-3:** CV produces no network uploads; network tab shows only `/integrity/*` metadata calls.
5. All unit + integration tests green; performance trace saved as artifact.

---

## 15. Appendix — Quick code references for implementation

- Loop/tiers & config: `frontend/src/components/FaceDetection.jsx:13-51, 584-736`
- Event state machine (extend for phone): `frontend/src/lib/faceLogic.js`
- Camera boot + frame upload + attention: `frontend/src/pages/Interview.jsx:105-165, 326-397`
- Duplicate camera boot: `frontend/src/components/CameraView.jsx:17-117`
- Integrity severity/category maps: `backend/app/services/anticheat.py:10-50`
- Frame→event writes: `backend/app/routes/video.py:186-221`
- Ability-profile bug: `backend/app/adaptive.py:26-28, 44-46`
