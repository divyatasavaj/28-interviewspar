// STEP 8 — pure edge-triggered event state machine for face/body/hand presence.
// No React or Human deps, so it can be unit-tested in plain Node.
// Counters (`c`) and fired flags (`f`) are mutated in place.

export const MULTI_FRAMES = 3;   // consecutive frames to confirm a multi/body-part event
export const NO_FACE_FRAMES = 30; // ~15s sustained (at 500ms) before a "not detected" event

// Signals:
//   bodyCount (result.body.length, MoveNet multipose) — full/partial persons
//   faceCount (result.face.length, BlazeFace)          — faces, never summed into body
//   handCount (result.hand.length, handpose)           — body parts (hands) in frame;
//     a lone hand / small body part is not a "person" to MoveNet, so it gets its own
//     edge-triggered event (body_part_detected) instead of being counted as a person.
export function stepState(c, f, faceCount, bodyCount, handCount, { multiFrames = MULTI_FRAMES, noFaceFrames = NO_FACE_FRAMES } = {}) {
  c.multiFace = faceCount >= 2 ? c.multiFace + 1 : 0;
  c.multiPerson = bodyCount >= 2 ? c.multiPerson + 1 : 0;
  c.noFace = faceCount === 0 ? c.noFace + 1 : 0;
  c.noBody = bodyCount === 0 ? c.noBody + 1 : 0;
  c.hand = handCount >= 1 ? c.hand + 1 : 0;

  const events = [];
  if (!f.multiFace && c.multiFace >= multiFrames) { f.multiFace = true; events.push(["multi_face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]); }
  else if (f.multiFace && faceCount < 2) { f.multiFace = false; events.push(["face_count_restored", { faces: faceCount, bodies: bodyCount, hands: handCount }]); }

  if (!f.multiPerson && c.multiPerson >= multiFrames) { f.multiPerson = true; events.push(["multi_person_detected", { bodies: bodyCount, faces: faceCount, hands: handCount }]); }
  else if (f.multiPerson && bodyCount < 2) { f.multiPerson = false; events.push(["person_count_restored", { bodies: bodyCount, faces: faceCount, hands: handCount }]); }

  // Any body part (hand) in frame — a small part like a lone hand never registers as a
  // person to the pose model, so surface it as its own signal.
  if (!f.hand && c.hand >= multiFrames) { f.hand = true; events.push(["body_part_detected", { hands: handCount, bodies: bodyCount, faces: faceCount }]); }
  else if (f.hand && handCount < 1) { f.hand = false; events.push(["body_part_restored", { hands: handCount, bodies: bodyCount, faces: faceCount }]); }

  // Body present but no face for a sustained period → still a face violation.
  if (!f.noFace && c.noFace >= noFaceFrames) { f.noFace = true; events.push(["face_not_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]); }
  else if (f.noFace && faceCount >= 1) { f.noFace = false; events.push(["face_detected", { faces: faceCount, bodies: bodyCount, hands: handCount }]); }

  if (!f.noBody && c.noBody >= noFaceFrames) { f.noBody = true; events.push(["person_not_detected", { bodies: bodyCount, faces: faceCount, hands: handCount }]); }
  else if (f.noBody && bodyCount >= 1) { f.noBody = false; events.push(["person_detected", { bodies: bodyCount, faces: faceCount, hands: handCount }]); }

  return { events };
}

