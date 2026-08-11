export const MULTI_FRAMES = 3 // consecutive frames to confirm a multi/body-part event
export const MULTI_PERSON_FRAMES = 5 // consecutive frames to confirm a second person
export const NO_FACE_FRAMES = 30 // ~15s sustained (at 500ms) before a "not detected" event

// Pure edge-triggered event state machine for face/body/hand presence.
// No React or Human deps, so it can be unit-tested in plain Node.
// A person is "present" when EITHER detector confirms it — qualified faces
// (BlazeFace) or qualified bodies (MoveNet). A face-only frame is still a
// person; body-only gating falsely declared "person gone" on tight,
// shoulders-up webcam framing where pose models can't find a torso.
// handCount (handpose) is never summed into person presence —
// a lone hand is not a "person" to the models, so it gets its own signal.
export function stepState(
  c,
  f,
  faceCount,
  bodyCount,
  handCount,
  { multiFrames = MULTI_FRAMES, multiPersonFrames = MULTI_PERSON_FRAMES, noFaceFrames = NO_FACE_FRAMES } = {}
) {
  c.multiFace = faceCount >= 2 ? c.multiFace + 1 : 0
  c.multiPerson = bodyCount >= 2 ? c.multiPerson + 1 : 0
  c.noFace = faceCount === 0 ? c.noFace + 1 : 0
  const personSignal = bodyCount >= 1 || faceCount >= 1
  c.noPerson = !personSignal ? c.noPerson + 1 : 0
  c.hand = handCount >= 1 ? c.hand + 1 : 0

  const events = []
  if (!f.multiFace && c.multiFace >= multiFrames) { f.multiFace = true; events.push(["multi_face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.multiFace && faceCount < 2) { f.multiFace = false; events.push(["face_count_restored", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  if (!f.multiPerson && c.multiPerson >= multiPersonFrames) { f.multiPerson = true; events.push(["multi_person_detected", { bodies: bodyCount, faces: faceCount, hands: handCount }]) }
  else if (f.multiPerson && bodyCount < 2) { f.multiPerson = false; events.push(["person_count_restored", { bodies: bodyCount, faces: faceCount, hands: handCount }]) }

  if (!f.hand && c.hand >= multiFrames) { f.hand = true; events.push(["body_part_detected", { hands: handCount, bodies: bodyCount, faces: faceCount }]) }
  else if (f.hand && handCount < 1) { f.hand = false; events.push(["body_part_restored", { hands: handCount, bodies: bodyCount, faces: faceCount }]) }

  if (!f.noFace && c.noFace >= noFaceFrames) { f.noFace = true; events.push(["face_not_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.noFace && faceCount >= 1) { f.noFace = false; events.push(["face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  if (!f.noPerson && c.noPerson >= noFaceFrames) { f.noPerson = true; events.push(["person_not_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }
  else if (f.noPerson && personSignal) { f.noPerson = false; events.push(["person_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]) }

  return { events }
}