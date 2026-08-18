// Pure phone detection state machine & signal fusion logic.
// Zero React/DOM dependencies for easy unit testing in Node/Vitest.

export const DEFAULT_CONFIDENCE_MIN = 0.5
export const DEFAULT_MIN_AREA = 0.015 // 1.5% of frame area
export const DEBOUNCE_SAMPLES = 8
export const SAMPLE_WINDOW = 10

export const PHONE_STATE = {
  IDLE: "idle",
  WARM: "warm",
  CONFIRMED: "confirmed",
}

export function createPhoneCounters() {
  return { sampleCount: 0, positiveCount: 0 }
}

export function createPhoneFired() {
  return { confirmed: false, warm: false }
}

export function phoneSample({ phoneDetections = [], handBoxes = [], wristKeypoints = [], faceMeta = null, frameWidth = 640, frameHeight = 480 } = {}) {
  if (!Array.isArray(phoneDetections) || phoneDetections.length === 0) return null
  const primary = phoneDetections[0]
  const score = primary.score ?? primary.confidence ?? 0
  if (score < 0.15) return null

  const box = primary.box
    ? primary.box
    : Array.isArray(primary.bbox)
    ? { x: primary.bbox[0] / frameWidth, y: primary.bbox[1] / frameHeight, width: primary.bbox[2] / frameWidth, height: primary.bbox[3] / frameHeight }
    : null
  if (!box) return null

  const area = box.width * box.height
  if (area < 0.0005) return null

  let corroboration = "visible"
  if (faceMeta && typeof faceMeta.pitch === "number" && Math.abs(faceMeta.pitch) > 10) {
    corroboration = "gaze_down"
  } else if (box.y + box.height / 2 >= 0.6) {
    corroboration = "lap_position"
  } else if (handBoxes.length > 0 || wristKeypoints.length > 0) {
    corroboration = "hand_overlap"
  }

  return {
    confidence: score,
    box,
    area,
    corroboration,
  }
}

export function stepPhoneState(counters, fired, phoneResult) {
  if (!counters.history) counters.history = []
  counters.history.push(Boolean(phoneResult))
  if (counters.history.length > 10) counters.history.shift()

  const positives = counters.history.filter(Boolean).length

  if (positives >= 2) {
    fired.confirmed = true
    return { state: PHONE_STATE.CONFIRMED, positives }
  } else if (positives >= 1) {
    return { state: PHONE_STATE.WARM, positives }
  } else {
    fired.confirmed = false
    return { state: PHONE_STATE.IDLE, positives }
  }
}

/**
 * Checks if a point (x, y) lies inside a bounding box with an optional margin expansion.
 * Coordinates are expected in normalized (0..1) space.
 */
export function pointInBox(px, py, box, margin = 0.05) {
  if (!box || typeof px !== "number" || typeof py !== "number") return false
  const minX = box.x - box.width * margin
  const maxX = box.x + box.width * (1 + margin)
  const minY = box.y - box.height * margin
  const maxY = box.y + box.height * (1 + margin)
  return px >= minX && px <= maxX && py >= minY && py <= maxY
}

/**
 * Calculates Intersection over Union (IoU) of two normalized boxes {x, y, width, height}.
 */
export function boxIoU(a, b) {
  if (!a || !b) return 0
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

/**
 * Checks if phone detection satisfies corroborating evidence:
 * 1. Hand overlap or landmark inside phone box
 * 2. Wrist keypoint inside phone box
 * 3. Gaze / head pitch looking down (pitch > 10 degrees down)
 * 4. Phone located in lower 1/3 of frame (lap position)
 */
export function checkCorroboration(phoneBox, { poseKeypoints = [], handLandmarks = [], headPose = null } = {}) {
  if (!phoneBox) return false

  // 1. Hand landmark point or hand bounding box inside phone box
  if (Array.isArray(handLandmarks)) {
    for (const hand of handLandmarks) {
      if (hand.box && boxIoU(phoneBox, hand.box) > 0.05) return true
      if (Array.isArray(hand.landmarks)) {
        for (const lm of hand.landmarks) {
          const px = Array.isArray(lm) ? lm[0] : lm.x
          const py = Array.isArray(lm) ? lm[1] : lm.y
          if (pointInBox(px, py, phoneBox, 0.1)) return true
        }
      }
    }
  }

  // 2. Wrist keypoints in pose
  if (Array.isArray(poseKeypoints)) {
    for (const pose of poseKeypoints) {
      const lw = pose.left_wrist
      const rw = pose.right_wrist
      if (lw && pointInBox(lw.x, lw.y, phoneBox, 0.15)) return true
      if (rw && pointInBox(rw.x, rw.y, phoneBox, 0.15)) return true
    }
  }

  // 3. Head pitch looking down (> 10° down)
  if (headPose && typeof headPose.pitch === "number") {
    // Pitch positive or negative depending on face model convention; check magnitude > 10°
    if (Math.abs(headPose.pitch) > 10) return true
  }

  // 4. Phone in lower 1/3 of frame (y_center > 0.65)
  const phoneCenterY = phoneBox.y + phoneBox.height / 2
  if (phoneCenterY >= 0.65) return true

  return false
}

/**
 * Evaluates a single sample frame for valid phone presence.
 */
export function evaluatePhoneSample(
  detections,
  {
    minConfidence = DEFAULT_CONFIDENCE_MIN,
    minArea = DEFAULT_MIN_AREA,
    poseKeypoints = [],
    handLandmarks = [],
    headPose = null,
  } = {}
) {
  if (!Array.isArray(detections) || detections.length === 0) {
    return { detected: false, bestMatch: null }
  }

  for (const det of detections) {
    const isPhone = det.class === "cell phone" || det.label === "cell phone"
    if (!isPhone) continue

    const score = det.score ?? det.confidence ?? 0
    if (score < minConfidence) continue

    // Normalize box if provided as [x, y, w, h] or object
    const box = det.box
      ? det.box
      : Array.isArray(det.bbox)
      ? { x: det.bbox[0], y: det.bbox[1], width: det.bbox[2], height: det.bbox[3] }
      : null
    if (!box) continue

    const area = box.width * box.height
    if (area < minArea) continue

    const corroborated = checkCorroboration(box, { poseKeypoints, handLandmarks, headPose })
    if (corroborated) {
      return {
        detected: true,
        bestMatch: {
          class: "cell phone",
          score,
          box,
          area,
          corroborated: true,
        },
      }
    }
  }

  return { detected: false, bestMatch: null }
}

/**
 * Pure sliding-window debouncer state machine for phone alerts.
 */
export class PhoneDebouncer {
  constructor({ requiredSamples = DEBOUNCE_SAMPLES, windowSize = SAMPLE_WINDOW } = {}) {
    this.requiredSamples = requiredSamples
    this.windowSize = windowSize
    this.history = []
    this.active = false
  }

  step(sampleResult) {
    this.history.push(Boolean(sampleResult.detected))
    if (this.history.length > this.windowSize) {
      this.history.shift()
    }

    const positiveCount = this.history.filter(Boolean).length
    const events = []

    if (!this.active && positiveCount >= this.requiredSamples) {
      this.active = true
      events.push({
        type: "mobile_phone_detected",
        confidence: sampleResult.bestMatch?.score ?? 0,
        box: sampleResult.bestMatch?.box,
        timestamp: new Date().toISOString(),
      })
    } else if (this.active && positiveCount <= 1) {
      this.active = false
      events.push({
        type: "mobile_phone_cleared",
        timestamp: new Date().toISOString(),
      })
    }

    return {
      active: this.active,
      positiveCount,
      historyLength: this.history.length,
      events,
    }
  }

  reset() {
    this.history = []
    this.active = false
  }
}
