// Main-thread wrapper for the coco-ssd person detector worker.
// Downsamples a frame (~320x320), posts it to the worker on a staggered
// interval (~1.25s), applies a static-object guard (posters/photos of people
// don't move) and reports a count of "real" persons plus the raw person boxes.
// Non-largest boxes are excluded only when proven static over a ~10-12s rolling
// window; everything else is counted by default.

const DEV = import.meta.env.DEV

const FRAME_SIZE = 320
const INTERVAL_MS = 1250
const TRACK_MATCH_RADIUS = 0.12 // centroid distance to consider same track
const TRACK_DROP_MS = 4000 // keep a track's history across brief misses
const WINDOW_TICKS = 10 // ~10-12s at 1.25s/tick: movement judged over this rolling window
const CUMULATIVE_STATIC_THRESHOLD = 0.02 // centroid spread (normalized) below this over the full window = "static"

function createTrack(cx, cy, now) {
  return { cx, cy, history: [], lastSeen: now }
}

// Dev-only: print every raw detection from the worker (any class, any score,
// pre-filter) so a missed person can be diagnosed as absent-vs-below-threshold.
function logRaw(msg) {
  const { width, height, predictions } = msg
  const persons = predictions.filter((p) => p.class === "person")
  console.group(
    `[person-debug] raw detections (${width}x${height}px input): ${predictions.length} total, ${persons.length} person-class`
  )
  for (const p of predictions) {
    const [x, y, w, h] = p.bbox
    console.log(
      `${p.class} score=${p.score.toFixed(3)} box=[${Math.round(x)}, ${Math.round(y)}, ${Math.round(w)}, ${Math.round(h)}] (${(w / width * 100).toFixed(1)}% frame width)`
    )
  }
  console.groupEnd()
}

// A track is "static" only once it has a full window of history AND the spread
// of its centroid positions over that window stays below the static threshold.
// Until the window fills — or any real motion accumulates — it is treated as a
// person (count by default, exclude only with strong sustained evidence).
function isTrackStatic(track) {
  if (track.history.length < WINDOW_TICKS) return false
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const pt of track.history) {
    if (pt.x < minX) minX = pt.x
    if (pt.x > maxX) maxX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.y > maxY) maxY = pt.y
  }
  return Math.hypot(maxX - minX, maxY - minY) < CUMULATIVE_STATIC_THRESHOLD
}

// Static-object guard: a person box counts by default; it is only excluded
// when there is strong, sustained evidence it is static — cumulative centroid
// spread below CUMULATIVE_STATIC_THRESHOLD over a full WINDOW_TICKS window
// (~10-12s). A single-tick delta was too strict for seated/still people
// (breathing, micro-shifts rarely clear 0.02 in one ~1.25s tick), while a
// poster/photo has near-zero spread across the whole window, so flipping the
// default (count unless proven static) is a higher bar for exclusion. The
// largest box always counts (the candidate in frame).
function applyStaticGuard(persons, state, now) {
  const sorted = persons.slice().sort((a, b) => (b.box[2] * b.box[3]) - (a.box[2] * a.box[3]))
  const used = new Set()
  const next = []
  let count = 0

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]
    let best = null
    let bestDist = Infinity
    for (const t of state.tracks) {
      if (used.has(t)) continue
      const d = Math.hypot(t.cx - p.centroid[0], t.cy - p.centroid[1])
      if (d < bestDist) { bestDist = d; best = t }
    }
    let track
    if (best && bestDist <= TRACK_MATCH_RADIUS) {
      track = best
      used.add(track)
    } else {
      track = createTrack(p.centroid[0], p.centroid[1], now)
    }
    track.cx = p.centroid[0]
    track.cy = p.centroid[1]
    track.lastSeen = now
    track.history.push({ x: track.cx, y: track.cy })
    if (track.history.length > WINDOW_TICKS) track.history.shift()
    next.push(track)
    // Largest box always counts; others are excluded only when proven static
    // across the whole rolling window.
    if (i === 0 || !isTrackStatic(track)) count++
  }

  // Keep tracks that briefly vanished (detector flake) so their history and
  // static determination survive short gaps.
  for (const t of state.tracks) {
    if (!used.has(t) && now - t.lastSeen < TRACK_DROP_MS) next.push(t)
  }
  state.tracks = next
  return count
}

// Hand-only intrusion: a hand whose center has no spatial correspondence to the
// one confirmed candidate (primary face box, else primary body box). Hands near
// the candidate's expanded region belong to the candidate; anything else is a
// separate hand-intrusion signal (not folded into multiPersonCount).
// hands: raw hand detections (h.box = [x,y,w,h] pixels). candidate: {x,y,width,height} pixels | null.
export function detectHandIntrusion(hands, candidate, vw, vh) {
  if (!hands || !hands.length) return false
  const region = candidate
    ? (() => {
        const cx = candidate.x + candidate.width / 2
        const cy = candidate.y + candidate.height / 2
        const ew = candidate.width * 1.7
        const eh = candidate.height * 1.7
        return { x: (cx - ew / 2) / vw, y: (cy - eh / 2) / vh, w: ew / vw, h: eh / vh }
      })()
    : null
  for (const h of hands) {
    if (!h.box) continue
    const [bx, by, bw, bh] = h.box
    const hc = { x: (bx + bw / 2) / vw, y: (by + bh / 2) / vh }
    if (region && hc.x >= region.x && hc.x <= region.x + region.w && hc.y >= region.y && hc.y <= region.y + region.h) continue
    return true
  }
  return false
}

export function createPersonDetector({ videoRef, onUpdate, interval = INTERVAL_MS, debug = false }) {
  let worker = null
  let timer = null
  const canvas = document.createElement("canvas")
  canvas.width = FRAME_SIZE
  canvas.height = FRAME_SIZE
  const ctx = canvas.getContext("2d")
  const state = { tracks: [] }
  let ready = false

  function sendFrame() {
    const video = videoRef.current
    if (!video || !ready) return
    if (video.readyState < 2 || !video.videoWidth) return
    try {
      ctx.drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE)
      const img = ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE)
      worker.postMessage({ type: "detect", data: img.data.buffer, width: FRAME_SIZE, height: FRAME_SIZE }, [img.data.buffer])
    } catch { /* frame grab failed, try next tick */ }
  }

  function start() {
    if (worker) return
    worker = new Worker(new URL("../workers/personDetector.worker.js", import.meta.url), { type: "module" })
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === "ready") {
        ready = true
      } else if (msg.type === "raw") {
        if (DEV && debug) logRaw(msg)
      } else if (msg.type === "result") {
        const now = performance.now()
        const count = applyStaticGuard(msg.persons, state, now)
        onUpdate?.({ count, persons: msg.persons })
      } else if (msg.type === "error") {
        if (import.meta.env.DEV) console.warn("[personDetector]", msg.error)
      }
    }
    worker.postMessage({ type: "init", debug })
    sendFrame()
    timer = setInterval(sendFrame, interval)
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
    if (worker) { worker.terminate(); worker = null }
    ready = false
    state.tracks = []
  }

  return { start, stop }
}
