import { useEffect, useRef, useCallback, useState } from "react"

const SAMPLE_W = 80
const VARIANCE_MIN = 5000
const CONFIDENCE_MIN = 0.15
const DETECT_INTERVAL = 500
const LOG_PREFIX = "[FaceDetection]"
const DEV = import.meta.env.DEV

// ── Tier 1: Native window.FaceDetector ──

let nativeInstance = null

async function probeNativeDetector() {
  if (nativeInstance) return nativeInstance
  const FD = window.FaceDetector
  if (!FD) {
    if (DEV) console.log(LOG_PREFIX, "Tier 1 unavailable: window.FaceDetector not found")
    return null
  }
  let instance
  try {
    instance = new FD({ maxDetectedFaces: 5, fastMode: true })
  } catch (e) {
    if (DEV) console.log(LOG_PREFIX, "Tier 1 unavailable: constructor threw", e.message)
    return null
  }
  // Probe with a real detect() call — this is where NotSupportedError surfaces
  const probe = document.createElement("canvas")
  probe.width = 16; probe.height = 16
  try {
    await instance.detect(probe)
  } catch (e) {
    if (DEV) console.log(LOG_PREFIX, "Tier 1 unavailable: detect() threw", e.message)
    return null
  }
  if (DEV) console.log(LOG_PREFIX, "Tier 1 available (native FaceDetector)")
  nativeInstance = instance
  return instance
}

// ── Tier 2: @vladmandic/human BlazeFace ──

let humanInstance = null
let humanLoadPromise = null

async function loadHuman() {
  if (humanInstance) return true
  if (humanLoadPromise) return humanLoadPromise
  if (DEV) console.log(LOG_PREFIX, "Tier 2 (Human): starting load")
  humanLoadPromise = (async () => {
    try {
      const H = await import("@vladmandic/human")
      const config = {
        modelBasePath: "/models/human/",
        backend: "webgl",
        debug: false,
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { maxDetected: 5, minConfidence: 0.5, rotation: false },
          mesh: { enabled: false },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
          gear: { enabled: false },
          attention: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        gesture: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
      }
      humanInstance = new H.Human(config)
      await humanInstance.load()
      if (DEV) console.log(LOG_PREFIX, "Tier 2 (Human): model loaded, ready")
      return true
    } catch (err) {
      console.warn(LOG_PREFIX, "Tier 2 (Human): load failed", err.message || err)
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

export default function FaceDetection({ videoRef, onFacesDetected, active, onDebug }) {
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const cxRef = useRef(0.5); const cyRef = useRef(0.5)

  const [tier, setTier] = useState("init")
  const [debug, setDebug] = useState({ confidence: 0, variance: 0, rawCx: 0.5, rawCy: 0.5 })

  // Determine which tier to use (runs once on mount)
  useEffect(() => {
    let cancelled = false
    // Tier 1 probe is async — don't await it, start Tier 3 immediately
    setTier("fallback")
    if (DEV) console.log(LOG_PREFIX, "Starting with Tier 3 (fallback)")

    probeNativeDetector().then((inst) => {
      if (cancelled) return
      if (inst) {
        if (DEV) console.log(LOG_PREFIX, "Upgrading to Tier 1 (native)")
        setTier("native")
      }
    })

    loadHuman().then((ok) => {
      if (cancelled) return
      if (ok && !nativeInstance) {
        if (DEV) console.log(LOG_PREFIX, "Upgrading to Tier 2 (Human)")
        setTier("human")
      } else if (ok && nativeInstance) {
        if (DEV) console.log(LOG_PREFIX, "Tier 2 loaded but Tier 1 already active — staying on Tier 1")
      } else {
        if (DEV) console.log(LOG_PREFIX, "Tier 2 failed to load — staying on Tier 3")
      }
    })

    return () => { cancelled = true }
  }, [])

  const videoReady = useCallback((video) => {
    return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
  }, [])

  // ── Tier 1 loop ──

  const runNative = useCallback(async () => {
    if (!active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !nativeInstance) return
    if (!videoReady(video)) { timerRef.current = setTimeout(runNative, 200); return }

    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    try {
      const faces = await nativeInstance.detect(video)
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height)
      const faceData = faces.map((f) => ({ box: f.boundingBox, landmarks: f.landmarks, confidence: 1.0 }))
      onFacesDetected?.(faceData)
      setDebug({ confidence: 1.0, variance: 0, rawCx: 0, rawCy: 0 })
      for (const f of faceData) {
        const b = f.box
        ctx.strokeStyle = "rgba(34, 197, 94, 0.8)"; ctx.lineWidth = 2
        ctx.strokeRect(b.x, b.y, b.width, b.height)
        ctx.fillStyle = "rgba(34, 197, 94, 0.15)"; ctx.fillRect(b.x, b.y, b.width, b.height)
        if (f.landmarks) for (const lm of f.landmarks) {
          ctx.fillStyle = "rgba(59, 130, 246, 0.8)"
          ctx.beginPath(); ctx.arc(lm.x, lm.y, 2, 0, Math.PI * 2); ctx.fill()
        }
      }
    } catch (e) {
      if (DEV) console.warn(LOG_PREFIX, "Tier 1 detect() threw — downgrading to fallback", e.message)
      setTier("fallback")
    }
    timerRef.current = setTimeout(runNative, DETECT_INTERVAL)
  }, [active, videoRef, onFacesDetected, videoReady])

  // ── Tier 2 loop ──

  const runHuman = useCallback(async () => {
    if (!active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !humanInstance) { timerRef.current = setTimeout(runHuman, 200); return }
    if (!videoReady(video)) { timerRef.current = setTimeout(runHuman, 200); return }

    try {
      const result = await humanInstance.detect(video)
      const detections = result.face || []
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height)
      const faceData = detections
        .filter((d) => d.boxScore >= 0.6)
        .map((d) => ({
          box: { x: d.box[0], y: d.box[1], width: d.box[2], height: d.box[3] },
          landmarks: [],
          confidence: d.boxScore,
        }))
      onFacesDetected?.(faceData)
      setDebug({ confidence: faceData[0]?.confidence || 0, variance: 0, rawCx: 0, rawCy: 0 })
      for (const f of faceData) {
        const b = f.box
        ctx.strokeStyle = "rgba(34, 197, 94, 0.8)"; ctx.lineWidth = 2
        ctx.strokeRect(b.x, b.y, b.width, b.height)
        ctx.fillStyle = "rgba(34, 197, 94, 0.15)"; ctx.fillRect(b.x, b.y, b.width, b.height)
      }
    } catch (e) {
      if (DEV) console.warn(LOG_PREFIX, "Tier 2 detect() threw", e.message)
    }
    timerRef.current = setTimeout(runHuman, DETECT_INTERVAL)
  }, [active, videoRef, onFacesDetected, videoReady])

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
      onFacesDetected?.([{ box: { x: boxX, y: boxY, width: boxW, height: boxH }, landmarks: [], confidence: r.confidence }])
    } else {
      onFacesDetected?.([])
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

    timerRef.current = setTimeout(runFallback, DETECT_INTERVAL)
  }, [active, videoRef, onFacesDetected, videoReady])

  // ── Loop dispatcher ──

  useEffect(() => {
    if (!active || tier === "init") return
    const loop = tier === "native" ? runNative : tier === "human" ? runHuman : runFallback
    timerRef.current = setTimeout(loop, 100)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active, tier, runNative, runHuman, runFallback])

  // Expose debug info to parent
  useEffect(() => {
    onDebug?.({ tier, ...debug })
  }, [tier, debug, onDebug])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  )
}
