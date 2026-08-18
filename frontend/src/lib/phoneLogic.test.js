import test from "node:test"
import assert from "node:assert/strict"
import {
  evaluatePhoneSample,
  PhoneDebouncer,
  pointInBox,
  boxIoU,
  checkCorroboration,
} from "./phoneLogic.js"

test("pointInBox accurately identifies point containment", () => {
  const box = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }
  assert.equal(pointInBox(0.3, 0.3, box), true)
  assert.equal(pointInBox(0.1, 0.1, box), false)
})

test("boxIoU calculates overlap correctly", () => {
  const boxA = { x: 0, y: 0, width: 0.5, height: 0.5 }
  const boxB = { x: 0.25, y: 0, width: 0.5, height: 0.5 }
  const iou = boxIoU(boxA, boxB)
  assert.ok(iou > 0.3 && iou < 0.4)
})

test("checkCorroboration validates hand overlap", () => {
  const phoneBox = { x: 0.3, y: 0.3, width: 0.2, height: 0.3 }
  const handLandmarks = [
    {
      box: { x: 0.35, y: 0.35, width: 0.1, height: 0.1 },
      landmarks: [{ x: 0.36, y: 0.36 }],
    },
  ]
  assert.equal(checkCorroboration(phoneBox, { handLandmarks }), true)
})

test("checkCorroboration validates phone in lower lap region", () => {
  const phoneBox = { x: 0.3, y: 0.7, width: 0.2, height: 0.2 }
  assert.equal(checkCorroboration(phoneBox), true)
})

test("evaluatePhoneSample filters low confidence and tiny boxes", () => {
  const tinyDetection = [
    {
      class: "cell phone",
      score: 0.9,
      bbox: [0.1, 0.1, 0.05, 0.05], // area 0.0025 < 0.015 minArea
    },
  ]
  const res1 = evaluatePhoneSample(tinyDetection)
  assert.equal(res1.detected, false)

  const lowConf = [
    {
      class: "cell phone",
      score: 0.3, // score < 0.5
      bbox: [0.1, 0.1, 0.2, 0.2],
    },
  ]
  const res2 = evaluatePhoneSample(lowConf)
  assert.equal(res2.detected, false)

  const validLapPhone = [
    {
      class: "cell phone",
      score: 0.85,
      bbox: [0.4, 0.65, 0.2, 0.2], // area 0.04 > 0.015, y >= 0.65 lap
    },
  ]
  const res3 = evaluatePhoneSample(validLapPhone)
  assert.equal(res3.detected, true)
  assert.equal(res3.bestMatch.class, "cell phone")
})

test("PhoneDebouncer requires 8 of 10 samples to trigger alert", () => {
  const debouncer = new PhoneDebouncer({ requiredSamples: 8, windowSize: 10 })
  const positive = { detected: true, bestMatch: { score: 0.9 } }
  const negative = { detected: false, bestMatch: null }

  // 7 positive frames -> not active yet
  for (let i = 0; i < 7; i++) {
    const res = debouncer.step(positive)
    assert.equal(res.active, false)
    assert.equal(res.events.length, 0)
  }

  // 8th positive frame -> active alert fires
  const res8 = debouncer.step(positive)
  assert.equal(res8.active, true)
  assert.equal(res8.events.length, 1)
  assert.equal(res8.events[0].type, "mobile_phone_detected")

  // Sustained positive -> active stays true, no extra event
  const res9 = debouncer.step(positive)
  assert.equal(res9.active, true)
  assert.equal(res9.events.length, 0)

  // Clear event requires dropping positive count to <= 1
  for (let i = 0; i < 9; i++) {
    debouncer.step(negative)
  }
  const resClear = debouncer.step(negative)
  assert.equal(resClear.active, false)
  assert.equal(resClear.events[0]?.type, "mobile_phone_cleared")
})
