import { useEffect, useRef } from 'react';

let modelPromise;
async function detector() {
  if (window.FaceDetector) {
    try {
      const native = new window.FaceDetector({maxDetectedFaces: 4, fastMode: true});
      await native.detect(document.createElement('canvas'));
      return {name:'native', detect:async video => (await native.detect(video)).map(f => ({box:f.boundingBox}))};
    } catch { /* Use the bundled face model if native detection is unsupported. */ }
  }
  modelPromise ||= import('@vladmandic/face-api').then(async faceapi => {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    return faceapi;
  }).catch(error => { modelPromise = null; throw error; });
  const api = await modelPromise;
  return {name:'tiny-face-detector', detect:async video => (await api.detectAllFaces(video,
    new api.TinyFaceDetectorOptions({inputSize:320, scoreThreshold:.5}))).map(f => ({box:f.box, confidence:f.score}))};
}

/** Face presence/framing only; no gaze, emotion, identity, or brightness fallback. */
export default function FaceDetection({videoRef, active, onFacesDetected, onDebug}) {
  const canvasRef = useRef(null), callbacks = useRef({onFacesDetected, onDebug});
  callbacks.current = {onFacesDetected, onDebug};
  useEffect(() => {
    if (!active) return;
    let cancelled = false, timer;
    callbacks.current.onDebug?.({available:false, status:'loading'});
    detector().then(engine => {
      if (cancelled) return;
      async function frame() {
        const video = videoRef.current;
        if (cancelled) return;
        if (document.hidden || !video || video.readyState < 2 || !video.videoWidth) {
          timer = setTimeout(frame, 500); return;
        }
        try {
          const faces = await engine.detect(video);
          if (cancelled) return;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3;
          for (const {box:b} of faces) ctx.strokeRect(b.x,b.y,b.width,b.height);
          callbacks.current.onDebug?.({available:true, status:'ready', tier:engine.name});
          callbacks.current.onFacesDetected?.(faces);
          timer = setTimeout(frame, 500);
        } catch {
          if (!cancelled) callbacks.current.onDebug?.({available:false, status:'unavailable'});
        }
      }
      frame();
    }).catch(() => { if (!cancelled) callbacks.current.onDebug?.({available:false, status:'unavailable'}); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, videoRef]);
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none"/>;
}
