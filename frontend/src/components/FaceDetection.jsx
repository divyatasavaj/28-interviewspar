import { useEffect, useRef, useState, useCallback } from "react"
import { logIntegrity } from "../api/auth"
import { stepState, resolveMultiPersonCount } from "../lib/faceLogic.js"
import { createPersonDetector, detectHandIntrusion } from "../lib/personDetector.js"

const SAMPLE_W = 80
const VARIANCE_MIN = 5000
const CONFIDENCE_MIN = 0.15
const BASE_INTERVAL_MS = 500
const MAX_INTERVAL_MS = 1000
const LOG_PREFIX = "[FaceDetection]"
const DEV = import.meta.env.DEV

const humanConfig = {
  backend: "webgl",
  modelBasePath: "/models/",
  async: true,
  warmup: "none",
  debug: false,
  filter: { enabled: true },
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: "human/blazeface.json", maxDetected: 4, minConfidence: 0.3 },
    mesh: { enabled: true },
    iris: { enabled: true },
    attention: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    gear: { enabled: false },
  },
  body: {
    enabled: true,
    modelPath: "movenet-lightning.json",
    maxDetected: 1,
    minConfidence: 0.3,
    skipFrames: 1,
    skipTime: 200,
  },
  hand: {
    enabled: true,
    detector: { modelPath: "handtrack.json" },
    skeleton: { modelPath: "handlandmark-lite.json" },
    landmarks: true,
    maxDetected: 4,
    minConfidence: 0.2,
  },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: false },
}

// ── Tier 1: Native window.FaceDetector ──

let nativeInstance = null
let humanInstance = null
let humanLoadPromise = null

async function probeNativeDetector() {
  if (nativeInstance) return nativeInstance
  const FD = window.FaceDetector
  if (!FD) return null
  let instance
  try {
    instance = new FD({ maxDetectedFaces: 5, fastMode: true })
  } catch {
    return null
  }
  const probe = document.createElement("canvas")
  probe.width = 16; probe.height = 16
  try {
    await instance.detect(probe)
  } catch {
    return null
  }
  nativeInstance = instance
  return instance
}

async function loadHuman() {
  if (humanInstance) return true
  if (humanLoadPromise) return humanLoadPromise
  if (DEV) console.log(LOG_PREFIX, "Human: starting load")
  humanLoadPromise = (async () => {
    try {
      const { Human } = await import("@vladmandic/human")
      humanInstance = new Human(humanConfig)
      await humanInstance.load()
      if (DEV) console.log(LOG_PREFIX, "Human: model loaded, ready")
      return true
    } catch (err) {
      console.warn(LOG_PREFIX, "Human: load failed", err.message || err)
      humanLoadPromise = null
      return false
    }
  })()
  return humanLoadPromise
}

// ── Tier 3: Pixel brightness fallback ──

function analyzeFrameSimple(imageData) {
  const { data, width, height } = imageData
  const total = width * height
  let sumGray = 0, sumGraySq = 0, grayMin = 255
  let brightX = 0, brightY = 0, brightWeight = 0
  for (let i = 0; i < total; i++) {
    const idx = i * 4
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    sumGray += gray; sumGraySq += gray * gray
    if (gray < grayMin) grayMin = gray
    const w = gray - grayMin
    brightX += (i % width) * w; brightY += Math.floor(i / width) * w; brightWeight += w
  }
  const mean = sumGray / total
  const variance = sumGraySq / total - mean * mean
  const hasContent = variance > VARIANCE_MIN
  let cx = 0.5, cy = 0.5, confidence = 0
  if (hasContent && brightWeight > 0) {
    cx = brightX / brightWeight / width; cy = brightY / brightWeight / height
    confidence = Math.min(0.5, variance / 10000)
  }
  return { hasContent, cx, cy, confidence, variance: Math.round(variance) }
}

// ── Component ──

// ── Keypoint Extraction & Skeleton Rendering Helpers ──

function parseKeypoint(kp) {
  if (!kp) return null
  let x = 0, y = 0, score = 0
  if (Array.isArray(kp.position)) {
    x = kp.position[0]
    y = kp.position[1]
    score = kp.score ?? kp.confidence ?? 1
  } else if (kp.position && typeof kp.position.x === "number") {
    x = kp.position.x
    y = kp.position.y
    score = kp.score ?? kp.confidence ?? 1
  } else if (typeof kp.x === "number" && typeof kp.y === "number") {
    x = kp.x
    y = kp.y
    score = kp.score ?? kp.confidence ?? 1
  } else {
    return null
  }
  return { x, y, score }
}

function extractPoseKeypoints(bodies) {
  const result = []
  if (!bodies || !Array.isArray(bodies)) return result

  for (const body of bodies) {
    const kps = body.keypoints || body.nodes || []
    const kpMap = {}

    for (let i = 0; i < kps.length; i++) {
      const kp = kps[i]
      const name = (kp.name || kp.label || "").toLowerCase()
      const parsed = parseKeypoint(kp)
      if (!parsed || parsed.score < 0.2) continue

      if (name.includes("left_shoulder") || name.includes("left shoulder") || i === 5) {
        kpMap.left_shoulder = parsed
      } else if (name.includes("right_shoulder") || name.includes("right shoulder") || i === 6) {
        kpMap.right_shoulder = parsed
      } else if (name.includes("left_elbow") || name.includes("left elbow") || i === 7) {
        kpMap.left_elbow = parsed
      } else if (name.includes("right_elbow") || name.includes("right elbow") || i === 8) {
        kpMap.right_elbow = parsed
      } else if (name.includes("left_wrist") || name.includes("left wrist") || name.includes("left_hand") || i === 9) {
        kpMap.left_wrist = parsed
      } else if (name.includes("right_wrist") || name.includes("right wrist") || name.includes("right_hand") || i === 10) {
        kpMap.right_wrist = parsed
      }
    }
    result.push(kpMap)
  }
  return result
}

// ── Multi-person accuracy ──
// MoveNet multipose emits one body per detected person, but it can also split a
// single person into fragments or duplicate the same person. The box each body
// gets is just the bounding box of its confident keypoints, so a fragment (an
// arm, a shoulder) produces a small box of its own. To count people accurately:
//   1. drop weak detections and tiny noise boxes,
//   2. require at least a couple of confident joints (a real person's body part),
//   3. merge any box that overlaps or sits inside the primary (largest) box so a
//      split/fragmented single person is NOT counted as multiple people.
// A genuinely separate person whose box is spatially distinct still counts.

const PERSON_BOX_SCORE = 0.3 // per-body detection confidence (boxScore)
const PERSON_JOINT_SCORE = 0.35 // per-joint confidence floor
const PERSON_MIN_JOINTS = 2 // confident joints needed to count as a person
const PERSON_IOU_MERGE = 0.4 // overlapping boxes above this = same person
const PERSON_MIN_NORM_SIZE = 0.03 // smallest box dim >= 3% of frame to skip noise

function iouBox(a, b) {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  const iw = Math.max(0, x2 - x1)
  const ih = Math.max(0, y2 - y1)
  const inter = iw * ih
  const union = a.width * a.height + b.width * b.height - inter
  return union > 0 ? inter / union : 0
}

function boxCenter(b) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

// Returns true if box `b` is likely the SAME person as box `a` (overlap or nested).
function samePerson(a, b) {
  if (iouBox(a, b) > PERSON_IOU_MERGE) return true
  const ca = boxCenter(a)
  const cb = boxCenter(b)
  const inside = (c, box) => (
    c.x >= box.x - box.width * 0.25
    && c.x <= box.x + box.width * 1.25
    && c.y >= box.y - box.height * 0.25
    && c.y <= box.y + box.height * 1.25
  )
  return inside(ca, b) || inside(cb, a)
}

// Returns only the bodies that look like distinct, real people.
function filterQualifiedBodies(bodies) {
  if (!bodies || !Array.isArray(bodies)) return []

  if (DEV && import.meta.env.VITE_BODY_DEBUG !== "0") {
    for (const b of bodies) {
      const kps = b.keypoints || []
      const kpLog = kps
        .map((k) => `${k.part ?? k.name ?? "kp"}:${(k.score ?? k.confidence ?? 0).toFixed(2)}`)
        .join(" ")
      const boxRaw = b.boxRaw || b.box
      console.log("[body-debug]", {
        score: b.score ?? b.boxScore,
        boxMaxDimNorm: Array.isArray(boxRaw) && boxRaw.length >= 4 ? Math.max(boxRaw[2], boxRaw[3]).toFixed(3) : null,
        keypointsAbove035: kps.filter((k) => (k.score ?? k.confidence ?? 0) >= 0.35).length,
        allKeypointScores: kpLog || "(none)",
      })
    }
  }

  const candidates = []
  for (const body of bodies) {
    const score = body.score ?? body.boxScore ?? 1
    if (score < PERSON_BOX_SCORE) continue

    const boxRaw = body.boxRaw
    const box = boxRaw || body.box
    if (!Array.isArray(box) || box.length < 4) continue
    if (boxRaw && Math.max(boxRaw[2], boxRaw[3]) < PERSON_MIN_NORM_SIZE) continue

    const kps = body.keypoints || []
    let confident = 0
    for (const kp of kps) {
      const s = kp.score ?? kp.confidence ?? 0
      if (s >= PERSON_JOINT_SCORE) confident++
    }
    if (confident < PERSON_MIN_JOINTS) continue

    candidates.push({
      body,
      box: { x: box[0], y: box[1], width: box[2], height: box[3] },
      score,
      area: box[2] * box[3],
    })
  }

  // Keep the LARGEST detection first (the primary person), then merge any box
  // that overlaps or nests inside an already-kept box.
  candidates.sort((a, b) => b.area - a.area)
  const kept = []
  for (const c of candidates) {
    let merged = false
    for (const k of kept) {
      if (samePerson(c.box, k.box)) {
        merged = true
        break
      }
    }
    if (!merged) kept.push(c)
  }
  return kept.map((c) => c.body)
}

// Client-side pose analysis for suspicious patterns
function analyzePoseClient(poseKeypoints, faceBoxes, vw, vh) {
  const alerts = []
  if (!poseKeypoints || !poseKeypoints.length) return alerts

  // Get primary face center (normalized)
  let fx = 0.5, fy = 0.4, fw = 0.3, fh = 0.4
  if (faceBoxes && faceBoxes.length) {
    const f = faceBoxes[0]
    fx = (f.box.x + f.box.width / 2) / vw
    fy = (f.box.y + f.box.height / 2) / vh
    fw = f.box.width / vw
    fh = f.box.height / vh
  }
  const faceRadius = Math.max(fw, fh) * 0.6

  for (const pose of poseKeypoints) {
    const ls = pose.left_shoulder
    const rs = pose.right_shoulder
    const _le = pose.left_elbow
    const _re = pose.right_elbow
    const lw = pose.left_wrist
    const rw = pose.right_wrist
    if (!ls || !rs) continue

    const dist = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null

    // Hands near face
    for (const [wrist, label] of [[lw, "left"], [rw, "right"]]) {
      if (wrist) {
        const d = dist(wrist, { x: fx, y: fy })
        if (d !== null && d < faceRadius) {
          alerts.push({ type: "hand_near_face", hand: label, distance: d, threshold: faceRadius })
        }
      }
    }

    // Arms crossed
    if (lw && rw) {
      const d1 = dist(lw, rs)
      const d2 = dist(rw, ls)
      const sw = dist(ls, rs)
      if (d1 !== null && d2 !== null && sw !== null) {
        if (d1 < sw * 0.5 && d2 < sw * 0.5) {
          alerts.push({ type: "arms_crossed", left_wrist_to_right_shoulder: d1, right_wrist_to_left_shoulder: d2, shoulder_width: sw })
        }
      }
    }

    // Hands off-screen
    for (const [wrist, label] of [[lw, "left"], [rw, "right"]]) {
      if (wrist) {
        const margin = 0.05
        if (wrist.x < margin || wrist.x > 1 - margin || wrist.y < margin || wrist.y > 1 - margin) {
          alerts.push({ type: "hand_off_screen", hand: label, position: { x: wrist.x, y: wrist.y } })
        }
      }
    }
  }
  return alerts
}

// ── Component ──

export default function FaceDetection({ videoRef, sessionId, active, onFacesDetected, onDebug }) {
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const cxRef = useRef(0.5); const cyRef = useRef(0.5)
  const countersRef = useRef({ multiFace: 0, multiPerson: 0, noFace: 0, noPerson: 0, hand: 0, handIntrusion: 0, facePresent: 0, personPresent: 0 })
  const firedRef = useRef({ multiFace: false, multiPerson: false, noFace: false, noPerson: false, hand: false, handIntrusion: false })
  const samplesRef = useRef([])
  const multiPersonCountRef = useRef(0)

  const [tier, setTier] = useState("init")
  const [debug, setDebug] = useState({ confidence: 0, variance: 0, rawCx: 0.5, rawCy: 0.5 })
  const [stats, setStats] = useState({
    faces: 0,
    bodies: 0,
    hands: 0,
    rawBodies: 0,
    shoulders: 0,
    elbows: 0,
    wrists: 0,
    ms: 0,
    avgMs: 0,
    interval: BASE_INTERVAL_MS,
    multiPerson: 0,
  })
  const [flags, setFlags] = useState({ faceGone: false, personGone: false, multiPerson: false, handIntrusion: false })
  const [poseAlerts, setPoseAlerts] = useState([])

  const send = useCallback(async (type, detail) => {
    if (!sessionId) return
    try {
      await logIntegrity(sessionId, type, { extra: detail })
    } catch {
      /* non-fatal */
    }
  }, [sessionId])

  const evaluate = useCallback((faceCount, bodyCount, handCount, shoulderCount, elbowCount, wristCount, ms, avgMs, intervalMs, onFaces, faceBoxes, poseKeypoints, handLandmarks, rawBodies = 0, faceMeta = null, multiPersonCount = 0, handIntrusion = false) => {
    const effectiveHandCount = Math.max(handCount, wristCount)
    const { events } = stepState(countersRef.current, firedRef.current, faceCount, bodyCount, effectiveHandCount, multiPersonCount, handIntrusion)
    setFlags({
      faceGone: firedRef.current.noFace,
      personGone: firedRef.current.noPerson,
      multiPerson: firedRef.current.multiPerson,
      handIntrusion: firedRef.current.handIntrusion,
    })
    setStats({
      faces: faceCount,
      bodies: bodyCount,
      rawBodies,
      hands: handCount,
      shoulders: shoulderCount,
      elbows: elbowCount,
      wrists: wristCount,
      ms,
      avgMs,
      interval: intervalMs,
      multiPerson: multiPersonCount,
    })
    for (const [event, detail] of events) {
      send(event, detail)
    }
    if (onFaces) onFaces(faceBoxes, poseKeypoints, handLandmarks, bodyCount, handCount, faceMeta)
  }, [send])

  // Determine which tier to use (runs once on mount)
  useEffect(() => {
    let cancelled = false
    setTier("fallback")
    if (DEV) console.log(LOG_PREFIX, "Starting with Tier 3 (fallback)")

    probeNativeDetector().then((inst) => {
      if (cancelled) return
      if (inst) setTier("native")
    })

    loadHuman().then((ok) => {
      if (cancelled) return
      if (ok) setTier("human")
    })

    return () => { cancelled = true }
  }, [])

  // Dedicated multi-person detector (coco-ssd in a Web Worker, CPU backend,
  // ~320px frame on a staggered ~1.25s interval). Additive signal: feeds
  // multiPersonCount only — it never feeds Task 2's candidate-presence
  // (personSignal/noPerson), which stays face-or-body based.
  useEffect(() => {
    if (!active) return
    const det = createPersonDetector({
      videoRef,
      onUpdate: ({ count }) => { multiPersonCountRef.current = count },
      // Dev-only: log every raw coco-ssd detection (any class, any score) so a
      // missed second person can be diagnosed as absent vs below-threshold.
      debug: DEV && import.meta.env.VITE_PERSON_DEBUG !== "0",
    })
    det.start()
    return () => { det.stop(); multiPersonCountRef.current = 0 }
  }, [active, videoRef])

  const videoReady = useCallback((video) => {
    return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
  }, [])

  const drawFace = useCallback((ctx, f) => {
    if (f.landmarks) {
      for (const lm of f.landmarks) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.8)"
        ctx.beginPath(); ctx.arc(lm.x, lm.y, 2, 0, Math.PI * 2); ctx.fill()
      }
    }
  }, [])

  const drawPoseSkeleton = useCallback((ctx, bodies, hands) => {
    const poseList = extractPoseKeypoints(bodies)

    // 1. Draw Body Keypoints & Connections (Shoulders, Elbows, Wrists/Palms)
    for (const pose of poseList) {
      const { left_shoulder: ls, right_shoulder: rs, left_elbow: le, right_elbow: re, left_wrist: lw, right_wrist: rw } = pose

      // Shoulder collar line
      if (ls && rs) {
        ctx.strokeStyle = "rgba(6, 182, 212, 0.85)" // Cyan
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(ls.x, ls.y)
        ctx.lineTo(rs.x, rs.y)
        ctx.stroke()
      }

      // Upper arm lines (Shoulder -> Elbow)
      if (ls && le) {
        ctx.strokeStyle = "rgba(168, 85, 247, 0.85)" // Purple
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(ls.x, ls.y)
        ctx.lineTo(le.x, le.y)
        ctx.stroke()
      }
      if (rs && re) {
        ctx.strokeStyle = "rgba(168, 85, 247, 0.85)" // Purple
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(rs.x, rs.y)
        ctx.lineTo(re.x, re.y)
        ctx.stroke()
      }

      // Forearm lines (Elbow -> Wrist/Palm)
      if (le && lw) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)" // Amber
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(le.x, le.y)
        ctx.lineTo(lw.x, lw.y)
        ctx.stroke()
      }
      if (re && rw) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)" // Amber
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(re.x, re.y)
        ctx.lineTo(rw.x, rw.y)
        ctx.stroke()
      }

      // Draw Joint Nodes & Text Labels
      const joints = [
        { kp: ls, label: "L.Shoulder", color: "#06b6d4" },
        { kp: rs, label: "R.Shoulder", color: "#06b6d4" },
        { kp: le, label: "L.Elbow", color: "#a855f7" },
        { kp: re, label: "R.Elbow", color: "#a855f7" },
        { kp: lw, label: "Palm/Wrist", color: "#f59e0b" },
        { kp: rw, label: "Palm/Wrist", color: "#f59e0b" },
      ]

      for (const { kp, label, color } of joints) {
        if (!kp) continue
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.font = "10px monospace"
        ctx.fillStyle = "#ffffff"
        ctx.shadowColor = "rgba(0,0,0,0.8)"
        ctx.shadowBlur = 4
        ctx.fillText(label, kp.x + 7, kp.y + 3)
        ctx.shadowBlur = 0
      }
    }

    // 2. Draw Hand / Palm Landmark Skeletons (result.hand)
    if (hands && Array.isArray(hands)) {
      for (const h of hands) {
        if (h.box) {
          const [bx, by, bw, bh] = h.box
          ctx.strokeStyle = "rgba(245, 158, 11, 0.7)"
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.strokeRect(bx, by, bw, bh)
          ctx.setLineDash([])
        }
        if (h.landmarks && Array.isArray(h.landmarks)) {
          for (const lm of h.landmarks) {
            const px = Array.isArray(lm) ? lm[0] : lm.x
            const py = Array.isArray(lm) ? lm[1] : lm.y
            if (typeof px === "number" && typeof py === "number") {
              ctx.fillStyle = "rgba(239, 68, 68, 0.9)"
              ctx.beginPath()
              ctx.arc(px, py, 2.5, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }
    }
  }, [])

  // ── Tier 1 loop ──

  const runNative = useCallback(async () => {
    if (!active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !nativeInstance) { timerRef.current = setTimeout(runNative, 200); return }
    if (!videoReady(video)) { timerRef.current = setTimeout(runNative, 200); return }

    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    try {
      const faces = await nativeInstance.detect(video)
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height)
      const faceData = faces.map((f) => ({ box: f.boundingBox, landmarks: f.landmarks, confidence: 1.0 }))
      setDebug({ confidence: 1.0, variance: 0, rawCx: 0, rawCy: 0 })
      evaluate(faceData.length, 0, 0, 0, 0, 0, 0, 0, BASE_INTERVAL_MS, onFacesDetected, faceData, undefined, undefined, 0, undefined, resolveMultiPersonCount(faceData.length, 0, multiPersonCountRef.current))
      for (const f of faceData) drawFace(ctx, f)
    } catch (e) {
      if (DEV) console.warn(LOG_PREFIX, "Tier 1 detect() threw — downgrading to fallback", e.message)
      setTier("fallback")
    }
    timerRef.current = setTimeout(runNative, BASE_INTERVAL_MS)
  }, [active, videoRef, onFacesDetected, videoReady, evaluate, drawFace])

  // ── Tier 2 loop ──

  const runHuman = useCallback(async () => {
    if (!active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !humanInstance) { timerRef.current = setTimeout(runHuman, 200); return }
    if (!videoReady(video)) { timerRef.current = setTimeout(runHuman, 200); return }

    const t0 = performance.now()
    let interval = BASE_INTERVAL_MS
    try {
      const result = await humanInstance.detect(video)
      const ms = Math.round(performance.now() - t0)

      samplesRef.current.push(ms)
      if (samplesRef.current.length > 10) samplesRef.current.shift()
      const avgMs = Math.round(samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length)

      if (avgMs > interval * 0.7 && interval < MAX_INTERVAL_MS) {
        interval = Math.min(interval + 200, MAX_INTERVAL_MS)
        if (DEV) console.info(`[FaceDetection] slow frames (avg ${avgMs}ms) → interval ${interval}ms`)
      }

      const qualifiedBodies = filterQualifiedBodies(result.body || [])
      const bodyCount = qualifiedBodies.length
      const handCount = result.hand?.length ?? 0

      // Keypoint counts for shoulders, elbows, wrists/palms
      const poseList = extractPoseKeypoints(qualifiedBodies)
      let shoulderCount = 0
      let elbowCount = 0
      let wristCount = 0

      for (const pose of poseList) {
        if (pose.left_shoulder) shoulderCount++
        if (pose.right_shoulder) shoulderCount++
        if (pose.left_elbow) elbowCount++
        if (pose.right_elbow) elbowCount++
        if (pose.left_wrist) wristCount++
        if (pose.right_wrist) wristCount++
      }

      // Prepare pose keypoints for backend (normalized 0-1)
      const vw = video.videoWidth
      const vh = video.videoHeight
      const poseKeypoints = poseList.map(pose => {
        const kp = {}
        for (const [key, val] of Object.entries(pose)) {
          if (val) kp[key] = { x: val.x / vw, y: val.y / vh, score: val.score }
        }
        return kp
      })

      // Prepare hand landmarks for backend
      const handLandmarks = (result.hand || []).map(h => ({
        box: h.box ? { x: h.box[0] / vw, y: h.box[1] / vh, width: h.box[2] / vw, height: h.box[3] / vh } : null,
        landmarks: (h.landmarks || []).map(lm => ({
          x: (Array.isArray(lm) ? lm[0] : lm.x) / vw,
          y: (Array.isArray(lm) ? lm[1] : lm.y) / vh,
        })),
      }))

      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height)
      const facesRaw = (result.face || []).filter((d) => d.boxScore >= 0.6)
      const faceData = facesRaw.map((d) => ({
        box: { x: d.box[0], y: d.box[1], width: d.box[2], height: d.box[3] },
        landmarks: [],
        confidence: d.boxScore,
      }))
      // Qualified face count (same source the single-face badge uses) — feeds
      // the person-presence state machine alongside bodyCount.
      const faceCount = facesRaw.length
      // Head pose / gaze of the primary (largest) face, converted to degrees.
      // Produced by Human's facemesh (+iris) models — see FaceResult.rotation.
      let faceMeta = null
      if (facesRaw.length) {
        const primary = facesRaw.reduce((a, b) => ((a.box[2] * a.box[3]) > (b.box[2] * b.box[3]) ? a : b))
        if (primary?.rotation?.angle) {
          const a = primary.rotation.angle
          faceMeta = {
            yaw: a.yaw * 180 / Math.PI,
            pitch: a.pitch * 180 / Math.PI,
            roll: a.roll * 180 / Math.PI,
            gazeStrength: primary.rotation.gaze?.strength ?? 0,
          }
        }
      }
      setDebug({ confidence: faceData[0]?.confidence || 0, variance: 0, rawCx: 0, rawCy: 0 })
      // Combined multi-person count: max(qualified faces, qualified bodies,
      // object-detector persons). Distinct from candidate-presence (noPerson).
      const multiPersonCount = resolveMultiPersonCount(faceCount, bodyCount, multiPersonCountRef.current)
      // Candidate region for hand-intrusion check: primary face, else primary body.
      let cand = null
      if (facesRaw.length) {
        const b = facesRaw.reduce((a, b) => ((a.box[2] * a.box[3]) > (b.box[2] * b.box[3]) ? a : b)).box
        cand = { x: b[0], y: b[1], width: b[2], height: b[3] }
      } else if (qualifiedBodies[0]?.box) {
        const b = qualifiedBodies[0].box
        cand = Array.isArray(b) ? { x: b[0], y: b[1], width: b[2], height: b[3] } : b
      }
      const handIntrusion = detectHandIntrusion(result.hand || [], cand, vw, vh)
      evaluate(faceCount, bodyCount, handCount, shoulderCount, elbowCount, wristCount, ms, avgMs, interval, onFacesDetected, faceData, poseKeypoints, handLandmarks, result.body?.length ?? 0, faceMeta, multiPersonCount, handIntrusion)

      for (const f of faceData) drawFace(ctx, f)
      drawPoseSkeleton(ctx, qualifiedBodies, result.hand || [])

      // Client-side pose analysis for immediate visual feedback
      const alerts = analyzePoseClient(poseKeypoints, faceData, vw, vh)
      if (alerts.length) setPoseAlerts(alerts)
      else setPoseAlerts([])
    } catch (e) {
      if (DEV) console.warn(LOG_PREFIX, "Tier 2 detect() threw", e.message)
    }
    timerRef.current = setTimeout(runHuman, interval)
  }, [active, videoRef, onFacesDetected, videoReady, evaluate, drawFace, drawPoseSkeleton])

  // ── Tier 3 loop ──

  const runFallback = useCallback(() => {
    if (!active) return
    const video = videoRef.current
    if (!video) { timerRef.current = setTimeout(runFallback, 200); return }
    if (!videoReady(video)) { timerRef.current = setTimeout(runFallback, 200); return }

    const sw = SAMPLE_W; const sh = Math.round(SAMPLE_W * (video.videoHeight / video.videoWidth))
    const c = document.createElement("canvas"); c.width = sw; c.height = sh
    const ctx = c.getContext("2d")
    if (!ctx) { timerRef.current = setTimeout(runFallback, 200); return }
    ctx.drawImage(video, 0, 0, sw, sh)
    const imgData = ctx.getImageData(0, 0, sw, sh)
    const r = analyzeFrameSimple(imgData)

    cxRef.current = cxRef.current + (r.cx - cxRef.current) * 0.25
    cyRef.current = cyRef.current + (r.cy - cyRef.current) * 0.25
    setDebug({ confidence: r.confidence, variance: r.variance, rawCx: r.cx, rawCy: r.cy })

    const svw = video.videoWidth; const svh = video.videoHeight

    if (r.hasContent && r.confidence > CONFIDENCE_MIN) {
      const boxW = svw * 0.3; const boxH = svh * 0.45
      const boxX = cxRef.current * svw - boxW / 2; const boxY = cyRef.current * svh - boxH / 2
      evaluate(1, 0, 0, 0, 0, 0, 0, 0, BASE_INTERVAL_MS, onFacesDetected, [{ box: { x: boxX, y: boxY, width: boxW, height: boxH }, landmarks: [], confidence: r.confidence }], undefined, undefined, 0, undefined, resolveMultiPersonCount(0, 0, multiPersonCountRef.current))
    } else {
      evaluate(0, 0, 0, 0, 0, 0, 0, 0, BASE_INTERVAL_MS, onFacesDetected, [], undefined, undefined, 0, undefined, resolveMultiPersonCount(0, 0, multiPersonCountRef.current))
    }

    if (canvasRef.current) {
      const oc = canvasRef.current; const octx = oc.getContext("2d")
      if (octx) {
        oc.width = svw; oc.height = svh; octx.clearRect(0, 0, oc.width, oc.height)
        if (r.hasContent && r.confidence > CONFIDENCE_MIN) {
          const boxW = svw * 0.3; const boxH = svh * 0.45
          const boxX = cxRef.current * svw - boxW / 2; const boxY = cyRef.current * svh - boxH / 2
          octx.strokeStyle = "rgba(234, 179, 8, 0.5)"; octx.lineWidth = 1
          octx.setLineDash([3, 3])
          octx.beginPath(); octx.moveTo(svw / 2 - 8, svh / 2); octx.lineTo(svw / 2 + 8, svh / 2)
          octx.moveTo(svw / 2, svh / 2 - 8); octx.lineTo(svw / 2, svh / 2 + 8); octx.stroke()
          octx.setLineDash([])
          octx.strokeStyle = "rgba(234, 179, 8, 0.6)"; octx.lineWidth = 2
          octx.strokeRect(boxX, boxY, boxW, boxH); octx.fillStyle = "rgba(234, 179, 8, 0.08)"; octx.fillRect(boxX, boxY, boxW, boxH)
        }
      }
    }

    timerRef.current = setTimeout(runFallback, BASE_INTERVAL_MS)
  }, [active, videoRef, onFacesDetected, videoReady, evaluate])

  // ── Loop dispatcher ──

  useEffect(() => {
    if (!active || tier === "init") return
    const loop = tier === "native" ? runNative : tier === "human" ? runHuman : runFallback
    timerRef.current = setTimeout(loop, 100)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active, tier, runNative, runHuman, runFallback])

  // Expose debug info to parent
  useEffect(() => {
    onDebug?.({ tier, ...debug, stats, flags })
  }, [tier, debug, stats, flags, onDebug])

  const badge = (ok, text, warn = false) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
      ok ? "bg-black/50 text-green-400"
      : warn ? "bg-yellow-500/80 text-white"
      : "bg-red-500/80 text-white"
    }`}>
      {text}
    </span>
  )

  // Presentation-only state labels (Task A taxonomy). The underlying detection
  // state (personSignal OR-gate, multiPersonCount) is untouched — only wording
  // and severity tone change here.
  const faceState =
    stats.faces === 0 ? { ok: false, text: "Face not visible", warn: true }
    : stats.faces === 1 ? { ok: true, text: "Face in frame" }
    : { ok: false, text: "Multiple faces" }
  // Candidate = face OR body (mirrors personSignal). Absent only when BOTH are
  // gone; present-single vs additional-person driven by the combined count.
  const candidatePresent = stats.faces >= 1 || stats.bodies >= 1
  const candidateState =
    !candidatePresent ? { ok: false, text: "Candidate not visible" }
    : stats.multiPerson > 1 ? { ok: false, text: "Additional person detected" }
    : { ok: true, text: "Candidate in frame" }
  const handCount = Math.max(stats.hands, stats.wrists)
  const handState =
    handCount === 0 ? null
    : handCount === 1 ? { ok: true, text: "hand in frame" }
    : { ok: false, text: "multiple hands" }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />
      <div className="pointer-events-none absolute top-9 left-3 z-10 flex flex-col items-start gap-1 font-mono max-w-[calc(100%-6rem)]">
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {tier === "init" || tier === "fallback" || tier === "loading" ? "● detection" : tier === "error" ? "✗ model error" : "● detection"}
          </span>
          {tier === "human" && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-gray-400">{stats.ms}ms</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {badge(faceState.ok, faceState.text, faceState.warn)}
          {badge(candidateState.ok, candidateState.text, candidateState.warn)}
          {handState && badge(handState.ok, handState.text)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {flags.faceGone && badge(false, "Face not visible", true)}
          {flags.personGone && badge(false, "Candidate not visible")}
          {flags.multiPerson && badge(false, "Additional person detected")}
          {flags.handIntrusion && badge(false, "Unidentified hand in frame")}
          {poseAlerts.map((a, i) => (
            <span key={i} className="rounded-full bg-red-500/80 text-white px-1.5 py-0.5 text-[10px]">
              {a.type === "hand_near_face" && `⚠ ${a.hand} hand near face`}
              {a.type === "arms_crossed" && "⚠ arms crossed"}
              {a.type === "hand_off_screen" && `⚠ ${a.hand} hand off-screen`}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}