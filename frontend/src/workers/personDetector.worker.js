// Dedicated multi-person detector: coco-ssd (TF.js), person class only.
// Runs on the CPU backend inside a Web Worker so it does NOT compete with the
// live BlazeFace/MoveNet WebGL loop. Frames are downscaled (~320x320) and
// posted by the main thread on a staggered interval (~1-1.5s).
//
// Tradeoff note: coco-ssd (ssdlite_mobilenet_v2) is the fastest to integrate
// into the existing TF.js stack. YOLOv8n via onnxruntime-web is a stronger
// detector (better small/occluded persons) but heavier: a separate runtime
// (~2-3MB) + a ~6MB model, and ONNX Runtime doesn't share TF.js's WebGL pool,
// so it's a bigger bundle/CPU cost. Chosen: coco-ssd.

import * as tf from "@tensorflow/tfjs-core"
import "@tensorflow/tfjs-backend-cpu"
import * as cocoSsd from "@tensorflow-models/coco-ssd"

const MODEL_URL = "/models/coco-ssd/model.json"
const PERSON_SCORE_MIN = 0.5

let model = null
let debug = false

async function init(msg) {
  // Debug flag (dev-only, set by the main thread) emits EVERY raw detection —
  // any class, any score, before the person filter — so a missed second person
  // can be diagnosed as "never detected" vs "detected below PERSON_SCORE_MIN".
  debug = msg?.debug === true
  // CPU backend deliberately: keeps GPU/WebGL for the live face/pose loop.
  await tf.setBackend("cpu")
  await tf.ready()
  model = await cocoSsd.load({ modelUrl: MODEL_URL })
}

async function detect(data, width, height) {
  const pixels = new Uint8ClampedArray(data)
  const image = new ImageData(pixels, width, height)
  const predictions = await model.detect(image)
  if (debug) self.postMessage({ type: "raw", width, height, predictions })
  return predictions
    .filter((p) => p.class === "person" && p.score >= PERSON_SCORE_MIN)
    .map((p) => ({
      box: [
        p.bbox[0] / width,
        p.bbox[1] / height,
        p.bbox[2] / width,
        p.bbox[3] / height,
      ],
      score: p.score,
      centroid: [
        (p.bbox[0] + p.bbox[2] / 2) / width,
        (p.bbox[1] + p.bbox[3] / 2) / height,
      ],
    }))
}

self.onmessage = async (e) => {
  const msg = e.data
  try {
    if (msg.type === "init") {
      await init(msg)
      self.postMessage({ type: "ready" })
    } else if (msg.type === "detect" && model) {
      const persons = await detect(msg.data, msg.width, msg.height)
      self.postMessage({ type: "result", persons })
    }
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message ?? err) })
  }
}
