import { useEffect, useRef, useState } from "react";
import { Human } from "@vladmandic/human";
import { logIntegrity } from "../api";
import { stepState } from "../lib/faceLogic.js";

// STEP 8 — face + body + hand presence detection on the local webcam stream using
// @vladmandic/human (MediaPipe/BlazeFace + MoveNet + handpose). Video never leaves the
// browser (rules.md: client-side only, no uploads).
//
// Signals (edge-triggered, debounced over consecutive frames):
//   face events: multi_face_detected / face_count_restored / face_not_detected / face_detected
//   body events: multi_person_detected / person_count_restored
//   hand events: body_part_detected / body_part_restored  (a lone hand/small body part is
//                not a "person" to MoveNet — it gets its own edge-triggered signal)
// bodyCount (result.body.length, MoveNet multipose) is the PRIMARY person signal;
// faceCount (result.face.length) and handCount (result.hand.length) are never summed into it.
const BASE_INTERVAL_MS = 500;   // throttled detect loop, not per-frame
const MAX_INTERVAL_MS = 1000;   // auto-throttle ceiling when frames run slow

const humanConfig = {
  backend: "webgl",
  modelBasePath: "/models/", // Vite serves public/models
  async: true,
  warmup: "none",
  debug: false,
  filter: { enabled: true },
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: "blazeface.json", maxDetected: 4, minConfidence: 0.3 },
    mesh: { enabled: false },
    iris: { enabled: false },
    attention: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    gear: { enabled: false },
  },
  body: {
    enabled: true,
    modelPath: "movenet-multipose.json", // multi-person pose → result.body.length can exceed 1
    maxDetected: 4,
    minConfidence: 0.2, // 0.3 missed head-and-shoulders / partial bodies on a webcam
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
};

export default function FaceDetection({ videoRef, sessionId, active }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [stats, setStats] = useState({ faces: 0, bodies: 0, hands: 0, ms: 0, avgMs: 0, interval: BASE_INTERVAL_MS });
  const [flags, setFlags] = useState({ multiFace: false, multiPerson: false, handPresent: false, faceGone: false, personGone: false });
  const humanRef = useRef(null);
  const countersRef = useRef({ multiFace: 0, multiPerson: 0, noFace: 0, noBody: 0, hand: 0 });
  const firedRef = useRef({ multiFace: false, multiPerson: false, noFace: false, noBody: false, hand: false });
  const samplesRef = useRef([]);

  async function send(event, detail) {
    try {
      await logIntegrity({ sessionId, event, detail });
    } catch {
      /* non-fatal */
    }
  }

  // Wrap the pure state machine with refs + flag shape used by the component.
  function evaluate(faceCount, bodyCount, handCount) {
    const { events } = stepState(countersRef.current, firedRef.current, faceCount, bodyCount, handCount);
    const next = {
      multiFace: firedRef.current.multiFace,
      multiPerson: firedRef.current.multiPerson,
      handPresent: firedRef.current.hand,
      faceGone: firedRef.current.noFace,
      personGone: firedRef.current.noBody,
    };
    return { events, next };
  }

  useEffect(() => {
    if (!active || !videoRef?.current || !sessionId) return;
    let stopped = false;
    let timer = null;
    let interval = BASE_INTERVAL_MS;

    const human = new Human(humanConfig);
    humanRef.current = human;
    setStatus("loading");

    (async () => {
      try {
        await human.load();
        if (!stopped) setStatus("ready");
      } catch (e) {
        console.error("[FaceDetection] model load failed:", e);
        if (!stopped) {
          setStatus("error");
          send("face_detector_error", { message: String(e.message || e) });
        }
      }
    })();

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        timer = setTimeout(tick, 300);
        return;
      }
      const t0 = performance.now();
      let res;
      try {
        res = await human.detect(video);
      } catch (e) {
        console.error("[FaceDetection] detect error:", e);
        timer = setTimeout(tick, interval);
        return;
      }
      const ms = Math.round(performance.now() - t0);
      const faceCount = res?.face?.length ?? 0;
      const bodyCount = res?.body?.length ?? 0;
      const handCount = res?.hand?.length ?? 0;

      // Rolling average for the auto-throttle + overlay.
      samplesRef.current.push(ms);
      if (samplesRef.current.length > 10) samplesRef.current.shift();
      const avgMs = Math.round(samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length);

      if (avgMs > interval * 0.7 && interval < MAX_INTERVAL_MS) {
        interval = Math.min(interval + 200, MAX_INTERVAL_MS);
        console.info(`[FaceDetection] slow frames (avg ${avgMs}ms) → interval ${interval}ms`);
      }

      const { events, next } = evaluate(faceCount, bodyCount, handCount);
      setFlags((prev) => ({ ...prev, ...next }));
      setStats({ faces: faceCount, bodies: bodyCount, hands: handCount, ms, avgMs, interval });

      for (const [event, detail] of events) {
        send(event, detail);
      }

      if (!stopped) timer = setTimeout(tick, interval);
    };

    timer = setTimeout(tick, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
      humanRef.current = null;
      try { human.dispose(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sessionId]);

  if (!active) return null;

  const badge = (ok, text) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${ok ? "bg-black/50 text-score-good" : "bg-score-poor/80 text-white"}`}>
      {text}
    </span>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-1 p-2 font-mono">
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          {status === "loading" ? "⌛ loading models…" : status === "error" ? "✗ model error" : "● detection"}
        </span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-score-warn">bodies: {stats.bodies}</span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-score-warn">faces: {stats.faces}</span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-score-warn">hands: {stats.hands}</span>
        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-ink-muted">{stats.ms}ms/{stats.interval}ms</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {badge(!flags.multiPerson, flags.multiPerson ? "multi-person" : "1 person")}
        {badge(!flags.multiFace, flags.multiFace ? "multi-face" : "1 face")}
        {flags.handPresent && badge(false, "body part (hand) in frame")}
        {flags.faceGone && badge(false, "face gone")}
        {flags.personGone && badge(false, "person gone")}
      </div>
    </div>
  );
}
