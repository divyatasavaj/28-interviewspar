import { useEffect, useRef, useState, useCallback } from "react"
import { logIntegrity } from "../api/auth"
import { stepState } from "../lib/faceLogic.js"
import {
  phoneSample,
  stepPhoneState,
  createPhoneCounters,
  createPhoneFired,
  PHONE_STATE,
} from "../lib/phoneLogic.js"
import { getDetectionConfig } from "../lib/detectionConfig.js"

const DOWNSCALE_W = 224
const REACT_HZ = 3
const REACT_INTERVAL_MS = Math.round(1000 / REACT_HZ)
const LOG_PREFIX = "[FaceDetection]"
const DEV = import.meta.env.DEV

function filterQualifiedBodies(bodies) {
  if (!bodies || !Array.isArray(bodies)) return []
  const PERSON_BOX_SCORE = 0.3
  const PERSON_JOINT_SCORE = 0.35
  const PERSON_MIN_JOINTS = 2
  const PERSON_IOU_MERGE = 0.4
  const PERSON_MIN_NORM_SIZE = 0.03

  function iouBox(a, b) {
    const x1 = Math.max(a.x, b.x)
    const y1 = Math.max(a.y, b.y)
    const x2 = Math.min(a.x + a.width, b.x + b.width)
    const y2 = Math.min(a.y + a.height, b.y + b.height)
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    const union = a.width * a.height + b.width * b.height - inter
    return union > 0 ? inter / union : 0
  }

  function boxCenter(b) {
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }

  function samePerson(a, b) {
    if (iouBox(a, b) > PERSON_IOU_MERGE) return true
    const ca = boxCenter(a)
    const cb = boxCenter(b)
    const inside = (c, box) =>
      c.x >= box.x - box.width * 0.25 &&
      c.x <= box.x + box.width * 1.25 &&
      c.y >= box.y - box.height * 0.25 &&
      c.y <= box.y + box.height * 1.25
    return inside(ca, b) || inside(cb, a)
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
      if ((kp.score ?? kp.confidence ?? 0) >= PERSON_JOINT_SCORE) confident++
    }
    if (confident < PERSON_MIN_JOINTS) continue
    candidates.push({
      body,
      box: { x: box[0], y: box[1], width: box[2], height: box[3] },
      score,
      area: box[2] * box[3],
    })
  }

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

function extractPoseKeypoints(bodies) {
  const result = []
  if (!bodies || !Array.isArray(bodies)) return result
  for (const body of bodies) {
    const kps = body.keypoints || body.nodes || []
    const kpMap = {}
    for (let i = 0; i < kps.length; i++) {
      const kp = kps[i]
      const name = (kp.name || kp.label || "").toLowerCase()
      let x = 0, y = 0, score = 0
      if (Array.isArray(kp.position)) {
        x = kp.position[0]; y = kp.position[1]; score = kp.score ?? kp.confidence ?? 1
      } else if (kp.position && typeof kp.position.x === "number") {
        x = kp.position.x; y = kp.position.y; score = kp.score ?? kp.confidence ?? 1
      } else if (typeof kp.x === "number" && typeof kp.y === "number") {
        x = kp.x; y = kp.y; score = kp.score ?? kp.confidence ?? 1
      } else continue
      if (score < 0.2) continue

      if (name.includes("left_shoulder") || i === 5) kpMap.left_shoulder = { x, y, score }
      else if (name.includes("right_shoulder") || i === 6) kpMap.right_shoulder = { x, y, score }
      else if (name.includes("left_elbow") || i === 7) kpMap.left_elbow = { x, y, score }
      else if (name.includes("right_elbow") || i === 8) kpMap.right_elbow = { x, y, score }
      else if (name.includes("left_wrist") || name.includes("left_hand") || i === 9) kpMap.left_wrist = { x, y, score }
      else if (name.includes("right_wrist") || name.includes("right_hand") || i === 10) kpMap.right_wrist = { x, y, score }
    }
    result.push(kpMap)
  }
  return result
}

function analyzePoseClient(poseKeypoints, faceBoxes, vw, vh) {
  const alerts = []
  if (!poseKeypoints || !poseKeypoints.length) return alerts
  let fx = 0.5, fy = 0.4, fw = 0.3, fh = 0.4
  if (faceBoxes && faceBoxes.length) {
    const f = faceBoxes[0]
    fx = (f.box.x + f.box.width / 2) / vw
    fy = (f.box.y + f.box.height / 2) / vh
    fw = f.box.width / vw
    fh = f.box.height / vh
  }
  const faceRadius = Math.max(fw, fh) * 0.6
  const dist = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null

  for (const pose of poseKeypoints) {
    const { left_shoulder: ls, right_shoulder: rs, left_wrist: lw, right_wrist: rw } = pose
    if (!ls || !rs) continue
    for (const [wrist, label] of [[lw, "left"], [rw, "right"]]) {
      if (wrist) {
        const d = dist(wrist, { x: fx, y: fy })
        if (d !== null && d < faceRadius) {
          alerts.push({ type: "hand_near_face", hand: label, distance: d, threshold: faceRadius })
        }
      }
    }
    if (lw && rw) {
      const d1 = dist(lw, rs)
      const d2 = dist(rw, ls)
      const sw = dist(ls, rs)
      if (d1 !== null && d2 !== null && sw !== null && d1 < sw * 0.5 && d2 < sw * 0.5) {
        alerts.push({ type: "arms_crossed", left_wrist_to_right_shoulder: d1, right_wrist_to_left_shoulder: d2, shoulder_width: sw })
      }
    }
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

export default function FaceDetection({ videoRef, sessionId, active, onFacesDetected, onDebug, onPhoneDetected }) {
  const canvasRef = useRef(null)
  const workerRef = useRef(null)
  const downscaledCanvasRef = useRef(null)
  const rafIdRef = useRef(null)
  const countersRef = useRef({ multiFace: 0, multiPerson: 0, noFace: 0, noPerson: 0, hand: 0 })
  const firedRef = useRef({ multiFace: false, multiPerson: false, noFace: false, noPerson: false, hand: false })
  const phoneCountersRef = useRef(createPhoneCounters())
  const phoneFiredRef = useRef(createPhoneFired())
  const accumRef = useRef(null)
  const reactTimerRef = useRef(null)
  const detectingRef = useRef(false)
  const readyRef = useRef(false)
  const tickRef = useRef(0)
  const samplesRef = useRef([])

  const [tier, setTier] = useState("init")
  const [stats, setStats] = useState({ faces: 0, bodies: 0, hands: 0, rawBodies: 0, shoulders: 0, elbows: 0, wrists: 0, ms: 0, avgMs: 0, fps: 0 })
  const [flags, setFlags] = useState({ faceGone: false, personGone: false })
  const [poseAlerts, setPoseAlerts] = useState([])
  const [phoneState, setPhoneState] = useState(PHONE_STATE.IDLE)
  const [phoneAlert, setPhoneAlert] = useState(null)

  const send = useCallback(async (type, detail) => {
    if (!sessionId) return
    try {
      await logIntegrity(sessionId, type, { extra: detail })
    } catch { /* non-fatal */ }
  }, [sessionId])

  useEffect(() => {
    if (workerRef.current) return

    const config = getDetectionConfig()
    const worker = new Worker(new URL("../workers/detection.worker.js", import.meta.url), { type: "module" })
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === "ready" || (msg.type === "status" && msg.status === "ready")) {
        readyRef.current = true
        setTier("human")
        if (DEV) console.log(LOG_PREFIX, "Worker ready:", msg)
      }
      if (msg.type === "result" || msg.type === "results") {
        handleWorkerResult(msg)
      }
      if (msg.type === "error" || (msg.type === "status" && msg.status === "error")) {
        console.warn(LOG_PREFIX, msg.error)
      }
    }

    worker.onerror = (e) => {
      console.warn(LOG_PREFIX, "Worker error:", e.message)
    }

    worker.postMessage({ type: "init", config })

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const handleWorkerResult = useCallback((result) => {
    detectingRef.current = false

    const ms = result.inferenceMs || result.ms || 50
    samplesRef.current.push(ms)
    if (samplesRef.current.length > 20) samplesRef.current.shift()
    const avgMs = Math.round(samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length)

    const rawBodies = result.bodyResults || result.body || []
    const qualifiedBodies = filterQualifiedBodies(rawBodies)
    const bodyCount = qualifiedBodies.length

    const rawFaces = result.faceResults || result.face || []
    const faceCount = rawFaces.filter(f => (f.boxScore ?? f.confidence ?? 1) >= 0.3).length
    const rawHands = result.handResults || result.hand || []
    const handCount = rawHands.length

    const poseList = extractPoseKeypoints(qualifiedBodies)
    let shoulderCount = 0, elbowCount = 0, wristCount = 0
    const wristKeypoints = []
    for (const pose of poseList) {
      if (pose.left_shoulder) shoulderCount++
      if (pose.right_shoulder) shoulderCount++
      if (pose.left_elbow) elbowCount++
      if (pose.right_elbow) elbowCount++
      if (pose.left_wrist) { wristCount++; wristKeypoints.push(pose.left_wrist) }
      if (pose.right_wrist) { wristCount++; wristKeypoints.push(pose.right_wrist) }
    }

    const video = videoRef.current
    const vw = video?.videoWidth || 640
    const vh = video?.videoHeight || 480

    const faceData = rawFaces.filter(f => (f.boxScore ?? f.confidence ?? 1) >= 0.3).map(d => ({
      box: d.box ? (d.box.x !== undefined ? d.box : { x: d.box[0], y: d.box[1], width: d.box[2], height: d.box[3] }) : { x: 0, y: 0, width: 0, height: 0 },
      landmarks: d.landmarks || [],
      confidence: d.boxScore ?? d.confidence ?? 1,
    }))

    const handBoxes = rawHands.map(h => {
      if (!h.box) return null
      return Array.isArray(h.box)
        ? { x: h.box[0] / vw, y: h.box[1] / vh, w: h.box[2] / vw, h: h.box[3] / vh }
        : h.box
    }).filter(Boolean)

    const normalizedWrists = wristKeypoints.map(kp => ({ x: kp.x / vw, y: kp.y / vh }))

    let faceMeta = result.headPose || null
    if (!faceMeta && rawFaces.length) {
      const primary = rawFaces[0]
      if (primary?.rotation?.angle) {
        const a = primary.rotation.angle
        faceMeta = { yaw: a.yaw * 180 / Math.PI, pitch: a.pitch * 180 / Math.PI, roll: a.roll * 180 / Math.PI }
      }
    }

    const effectiveHandCount = Math.max(handCount, wristCount)
    const { events } = stepState(countersRef.current, firedRef.current, faceCount, bodyCount, effectiveHandCount)

    const objects = result.objectResults || result.phone || []
    const phoneDetections = objects.filter(o => {
      const cls = (o.class || o.label || "").toLowerCase()
      return cls === "cell phone" || cls === "phone" || cls === "remote" || cls === "mobile"
    })
    let phoneResult = null
    if (phoneDetections.length > 0) {
      phoneResult = phoneSample({
        phoneDetections,
        handBoxes,
        wristKeypoints: normalizedWrists,
        faceMeta,
        frameWidth: vw,
        frameHeight: vh,
      })
    }
    const phoneStep = stepPhoneState(phoneCountersRef.current, phoneFiredRef.current, phoneResult)
    if (phoneStep.state !== phoneState) setPhoneState(phoneStep.state)
    if (phoneResult) {
      setPhoneAlert(phoneResult)
      onPhoneDetected?.(phoneResult)
    }

    accumRef.current = {
      faceCount, bodyCount, handCount, shoulderCount, elbowCount, wristCount,
      ms: avgMs, avgMs, faceData, poseKeypoints: poseList.map(pose => {
        const kp = {}
        for (const [key, val] of Object.entries(pose)) {
          if (val) kp[key] = { x: val.x / vw, y: val.y / vh, score: val.score }
        }
        return kp
      }),
      handLandmarks: rawHands.map(h => ({
        box: h.box ? (Array.isArray(h.box) ? { x: h.box[0] / vw, y: h.box[1] / vh, width: h.box[2] / vw, height: h.box[3] / vh } : h.box) : null,
        landmarks: (h.landmarks || []).map(lm => ({ x: (Array.isArray(lm) ? lm[0] : lm.x) / vw, y: (Array.isArray(lm) ? lm[1] : lm.y) / vh })),
      })),
      rawBodies: rawBodies.length,
      faceMeta,
      events,
      poseAlerts: analyzePoseClient(
        poseList.map(pose => {
          const kp = {}
          for (const [key, val] of Object.entries(pose)) {
            if (val) kp[key] = { x: val.x / vw, y: val.y / vh, score: val.score }
          }
          return kp
        }),
        faceData, vw, vh
      ),
    }
  }, [sessionId, videoRef, phoneState, onPhoneDetected])

  useEffect(() => {
    if (!reactTimerRef.current) {
      reactTimerRef.current = setInterval(() => {
        const acc = accumRef.current
        if (!acc) return
        accumRef.current = null

        setFlags({ faceGone: firedRef.current.noFace, personGone: firedRef.current.noPerson })
        setStats({
          faces: acc.faceCount, bodies: acc.bodyCount, rawBodies: acc.rawBodies,
          hands: acc.handCount, shoulders: acc.shoulderCount, elbows: acc.elbowCount, wrists: acc.wristCount,
          ms: acc.ms, avgMs: acc.avgMs, fps: Math.round(1000 / Math.max(acc.ms, 1)),
        })
        setPoseAlerts(acc.poseAlerts)
        for (const [event, detail] of acc.events) send(event, detail)
        onFacesDetected?.(acc.faceData, acc.poseKeypoints, acc.handLandmarks, acc.bodyCount, acc.handCount, acc.faceMeta)
      }, REACT_INTERVAL_MS)
    }
    return () => {
      if (reactTimerRef.current) { clearInterval(reactTimerRef.current); reactTimerRef.current = null }
    }
  }, [send, onFacesDetected])

  const detectFrame = useCallback(() => {
    if (!active || !readyRef.current || detectingRef.current) {
      rafIdRef.current = requestAnimationFrame(detectFrame)
      return
    }

    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      rafIdRef.current = requestAnimationFrame(detectFrame)
      return
    }

    detectingRef.current = true
    tickRef.current++

    if (!downscaledCanvasRef.current) {
      downscaledCanvasRef.current = document.createElement("canvas")
    }
    const oc = downscaledCanvasRef.current
    const scale = DOWNSCALE_W / video.videoWidth
    oc.width = DOWNSCALE_W
    oc.height = Math.round(video.videoHeight * scale)
    const ctx = oc.getContext("2d")
    ctx.drawImage(video, 0, 0, oc.width, oc.height)

    const canvas = canvasRef.current
    if (canvas) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const dctx = canvas.getContext("2d")
      dctx.clearRect(0, 0, canvas.width, canvas.height)

      const faces = (accumRef.current?.faceData) || []
      for (const f of faces) {
        if (f.landmarks) {
          dctx.fillStyle = "rgba(59, 130, 246, 0.8)"
          for (const lm of f.landmarks) {
            dctx.beginPath()
            dctx.arc(lm.x, lm.y, 2, 0, Math.PI * 2)
            dctx.fill()
          }
        }
      }
    }

    createImageBitmap(oc)
      .then((bitmap) => {
        if (!workerRef.current) {
          detectingRef.current = false
          return
        }
        workerRef.current.postMessage(
          {
            type: "process_frame",
            bitmap,
            timestamp: performance.now(),
            width: oc.width,
            height: oc.height,
          },
          [bitmap]
        )
        // Safety timeout to unlock detection loop if worker drops frame
        setTimeout(() => { detectingRef.current = false }, 1000)
      })
      .catch(() => {
        detectingRef.current = false
      })

    rafIdRef.current = requestAnimationFrame(detectFrame)
  }, [active, videoRef])

  useEffect(() => {
    if (active && (readyRef.current || tier === "human")) {
      rafIdRef.current = requestAnimationFrame(detectFrame)
    }
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [active, tier, detectFrame])

  useEffect(() => {
    onDebug?.({ tier, stats, flags })
  }, [tier, stats, flags, onDebug])

  const badge = (ok, text) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${ok ? "bg-black/50 text-green-400" : "bg-red-500/80 text-white"}`}>
      {text}
    </span>
  )

  const faceState = stats.faces === 0 ? { ok: false, text: "no face" } : stats.faces === 1 ? { ok: true, text: "single face" } : { ok: false, text: "multiple face" }
  const bodyState = stats.bodies === 0 ? { ok: false, text: "no person" } : stats.bodies === 1 ? { ok: true, text: "single person" } : { ok: false, text: "multiple person" }
  const handCount = Math.max(stats.hands, stats.wrists)
  const handState = handCount === 0 ? null : handCount === 1 ? { ok: true, text: "hand in frame" } : { ok: false, text: "multiple hands" }

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-1 font-mono max-w-[calc(100%-6rem)]">
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {tier === "init" ? "● loading" : "● detection"}
          </span>
          {tier === "human" && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-gray-400">
              {stats.fps} FPS · {stats.ms}ms
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {badge(faceState.ok, faceState.text)}
          {badge(bodyState.ok, bodyState.text)}
          {handState && badge(handState.ok, handState.text)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {flags.faceGone && badge(false, "face gone")}
          {flags.personGone && badge(false, "person gone")}
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
