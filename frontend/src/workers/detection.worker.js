import { Human } from "@vladmandic/human"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import * as tf from "@tensorflow/tfjs"

let humanInstance = null
let cocoInstance = null
let isInitializing = false
let isReady = false
let tickCount = 0

const humanConfig = {
  backend: "humangl",
  modelBasePath: "/models/",
  async: true,
  warmup: "none",
  debug: false,
  filter: { enabled: true },
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: "human/blazeface.json", maxDetected: 4, minConfidence: 0.3 },
    mesh: { enabled: true },
    iris: { enabled: false }, // disabled for performance
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

async function initModels() {
  if (isReady) return true
  if (isInitializing) return false
  isInitializing = true

  try {
    // 1. Initialize TensorFlow backend if needed
    try {
      await tf.ready()
    } catch (e) {
      console.warn("[Worker] TF ready warn:", e)
    }

    // 2. Initialize Human instance with backend fallback
    humanInstance = new Human(humanConfig)
    try {
      await humanInstance.load()
    } catch (e) {
      console.warn("[Worker] humangl backend failed, trying wasm/cpu fallback:", e)
      humanInstance.config.backend = "wasm"
      try {
        await humanInstance.load()
      } catch (e2) {
        console.warn("[Worker] wasm backend failed, trying cpu fallback:", e2)
        humanInstance.config.backend = "cpu"
        await humanInstance.load()
      }
    }

    isReady = true
    isInitializing = false
    self.postMessage({ type: "status", status: "ready" })

    // 3. Initialize COCO-SSD for cell phone detection asynchronously
    cocoSsd.load({ base: "lite_mobilenet_v2" })
      .then((model) => {
        cocoInstance = model
        console.log("[Worker] COCO-SSD loaded successfully")
      })
      .catch((err) => {
        console.warn("[Worker] COCO-SSD load failed, trying default:", err)
        cocoSsd.load()
          .then((model) => {
            cocoInstance = model
            console.log("[Worker] COCO-SSD default loaded")
          })
          .catch((err2) => {
            console.warn("[Worker] COCO-SSD unavailable:", err2)
          })
      })

    return true
  } catch (err) {
    console.error("[Worker] Model initialization error:", err)
    isInitializing = false
    self.postMessage({ type: "status", status: "error", error: err.message || String(err) })
    return false
  }
}

// OffscreenCanvas used for downscaling frame input inside worker
let offscreenCanvas = null
let offscreenCtx = null

self.onmessage = async (event) => {
  const { type, bitmap, timestamp, width, height } = event.data

  if (type === "init") {
    await initModels()
    return
  }

  if (type === "process_frame") {
    if (!isReady) {
      const ready = await initModels()
      if (!ready) {
        if (bitmap) bitmap.close()
        return
      }
    }

    if (!bitmap) return

    const t0 = performance.now()
    tickCount++

    const targetW = width || 224
    const targetH = height || 168

    if (!offscreenCanvas) {
      offscreenCanvas = new OffscreenCanvas(targetW, targetH)
      offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true })
    } else if (offscreenCanvas.width !== targetW || offscreenCanvas.height !== targetH) {
      offscreenCanvas.width = targetW
      offscreenCanvas.height = targetH
    }

    try {
      // Downscale incoming bitmap to worker offscreen canvas
      offscreenCtx.drawImage(bitmap, 0, 0, targetW, targetH)
      bitmap.close()

      // Duty cycle configuration:
      // Face detection every tick (~10 FPS)
      // Mesh/Gaze every 3rd tick (~3 FPS)
      // Pose/Hand every 5th tick (~2 FPS)
      // COCO-SSD Phone detection every 5th tick (~2 FPS)

      humanInstance.config.face.mesh.enabled = tickCount % 2 === 0
      humanInstance.config.body.enabled = false
      humanInstance.config.hand.enabled = false

      // Run Human detection on offscreen canvas
      const humanResult = await humanInstance.detect(offscreenCanvas)

      // Run COCO-SSD object detection on every tick
      let objectDetections = []
      if (cocoInstance) {
        try {
          const rawObjects = await cocoInstance.detect(offscreenCanvas, 10, 0.20)
          objectDetections = rawObjects.map((obj) => ({
            class: obj.class,
            score: obj.score,
            // Convert bbox [x, y, w, h] to normalized 0..1 coordinates relative to targetW/targetH
            bbox: [
              obj.bbox[0] / targetW,
              obj.bbox[1] / targetH,
              obj.bbox[2] / targetW,
              obj.bbox[3] / targetH,
            ],
            box: {
              x: obj.bbox[0] / targetW,
              y: obj.bbox[1] / targetH,
              width: obj.bbox[2] / targetW,
              height: obj.bbox[3] / targetH,
            },
          }))
        } catch (e) {
          console.warn("[Worker] COCO-SSD detection error:", e)
        }
      }

      // Extract head pose/rotation if available
      let headPose = null
      if (humanResult.face && humanResult.face.length > 0) {
        const primary = humanResult.face[0]
        if (primary?.rotation?.angle) {
          const a = primary.rotation.angle
          headPose = {
            yaw: (a.yaw * 180) / Math.PI,
            pitch: (a.pitch * 180) / Math.PI,
            roll: (a.roll * 180) / Math.PI,
          }
        }
      }

      const inferenceMs = Math.round(performance.now() - t0)

      // Normalize face boxes to 0..1 range
      const faceResults = (humanResult.face || []).map((f) => ({
        box: {
          x: f.box[0] / targetW,
          y: f.box[1] / targetH,
          width: f.box[2] / targetW,
          height: f.box[3] / targetH,
        },
        boxScore: f.boxScore,
      }))

      // Return detection payloads
      self.postMessage({
        type: "results",
        timestamp,
        faceResults,
        bodyResults: humanResult.body || [],
        handResults: humanResult.hand || [],
        objectResults: objectDetections,
        headPose,
        inferenceMs,
        tickCount,
      })
    } catch (err) {
      if (bitmap) bitmap.close()
      console.error("[Worker] Error processing frame:", err)
      self.postMessage({ type: "error", error: err.message || String(err) })
    }
  }
}
