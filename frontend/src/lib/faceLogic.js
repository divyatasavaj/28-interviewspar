export const MULTI_FRAMES = 3 // consecutive frames to confirm a multi/body-part event
export const MULTI_PERSON_FRAMES = 5 // consecutive frames to confirm a second person
export const PERSON_ABSENT_FRAMES = 6 // consecutive frames of "candidate gone" before it's trusted (~3s at 500ms)
export const PERSON_PRESENT_FRAMES = 30 // consecutive frames of "candidate back" before the alert clears (conservative, ~15s at 500ms)

// Shared across every detection tier: the multi-person count is the max of all
// signal sources — qualified faces, qualified bodies, and the coco-ssd worker
// count. Any one source reporting >= 2 means more than one person may be in
// frame. Tier paths that have no real face/body signal pass 0 for those (the
// fallback tier, which fakes a single "content present" box), so the helper
// simply returns the worker count in that case.
export function resolveMultiPersonCount(faceCount, bodyCount, workerCount) {
  return Math.max(faceCount, bodyCount, workerCount)
}

// Pure edge-triggered event state machine for face/body/hand/person presence.
// No React or Human deps, so it can be unit-tested in plain Node.
// A person is "present" when EITHER detector confirms it — qualified faces
// (BlazeFace) or qualified bodies (MoveNet). A face-only frame is still a
// person; body-only gating falsely declared "person gone" on tight,
// shoulders-up webcam framing where pose models can't find a torso.
// handCount (handpose) is never summed into person presence —
// a lone hand is not a "person" to the models, so it gets its own signal.
//
// Two SEPARATE concepts, never merged:
//  - personSignal / noPerson: "is the candidate still in frame?" (face OR body).
//  - multiPersonCount: "is there more than one person?" — fed by
//    max(qualifiedFaces, qualifiedBodies, objectDetectorPersons), an additive
//    signal from the dedicated coco-ssd detector. multiPersonCount >= 2 drives
//    the multi-person alert only; it does not affect personSignal.
//  - handIntrusion: a hand with no spatial correspondence to the confirmed
//    candidate (a hand-only intrusion), distinct from person-counting.
//
// Candidate-presence uses TWO independent confirm counts (defaults):
//  - absentFrames  (PERSON_ABSENT_FRAMES, 6)  — consecutive frames of "gone"
//    before face/person_not_detected fires. Shortened so a candidate who steps
//    out (or is swapped) flags within ~3s at 500ms/frame.
//  - presentFrames (PERSON_PRESENT_FRAMES, 30) — consecutive frames of "back"
//    before the badge clears, keeping the alert sticky against flicker blips.
// Both stay edge-triggered: each fires once per transition, not continuously.
export function stepState(
  c,
  f,
  faceCount,
  bodyCount,
  handCount,
  multiPersonCount = Math.max(faceCount, bodyCount),
  handIntrusion = false,
  { multiFrames = MULTI_FRAMES, multiPersonFrames = MULTI_PERSON_FRAMES, absentFrames = PERSON_ABSENT_FRAMES, presentFrames = PERSON_PRESENT_FRAMES } = {}
) {
  c.multiFace = faceCount >= 2 ? c.multiFace + 1 : 0
  c.multiPerson = multiPersonCount >= 2 ? c.multiPerson + 1 : 0
  c.noFace = faceCount === 0 ? c.noFace + 1 : 0
  c.facePresent = faceCount >= 1 ? c.facePresent + 1 : 0
  const personSignal = bodyCount >= 1 || faceCount >= 1
  c.noPerson = !personSignal ? c.noPerson + 1 : 0
  c.personPresent = personSignal ? c.personPresent + 1 : 0
  c.hand = handCount >= 1 ? c.hand + 1 : 0
  c.handIntrusion = handIntrusion ? c.handIntrusion + 1 : 0

  const events = []
  if (!f.multiFace && c.multiFace >= multiFrames) { f.multiFace = true; events.push(["multi_face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.multiFace && faceCount < 2) { f.multiFace = false; events.push(["face_count_restored", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  if (!f.multiPerson && c.multiPerson >= multiPersonFrames) { f.multiPerson = true; events.push(["multi_person_detected", { multiPersonCount, bodies: bodyCount, faces: faceCount, hands: handCount }]) }
  else if (f.multiPerson && multiPersonCount < 2) { f.multiPerson = false; events.push(["person_count_restored", { multiPersonCount, bodies: bodyCount, faces: faceCount, hands: handCount }]) }

  if (!f.hand && c.hand >= multiFrames) { f.hand = true; events.push(["body_part_detected", { hands: handCount, bodies: bodyCount, faces: faceCount }]) }
  else if (f.hand && handCount < 1) { f.hand = false; events.push(["body_part_restored", { hands: handCount, bodies: bodyCount, faces: faceCount }]) }

  if (!f.handIntrusion && c.handIntrusion >= multiFrames) { f.handIntrusion = true; events.push(["hand_intrusion_detected", { hands: handCount, multiPersonCount, bodies: bodyCount, faces: faceCount }]) }
  else if (f.handIntrusion && !handIntrusion) { f.handIntrusion = false; events.push(["hand_intrusion_restored", { hands: handCount, multiPersonCount, bodies: bodyCount, faces: faceCount }]) }

  if (!f.noFace && c.noFace >= absentFrames) { f.noFace = true; events.push(["face_not_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.noFace && c.facePresent >= presentFrames) { f.noFace = false; events.push(["face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  if (!f.noPerson && c.noPerson >= absentFrames) { f.noPerson = true; events.push(["person_not_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.noPerson && c.personPresent >= presentFrames) { f.noPerson = false; events.push(["person_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  return { events }
}