import { useEffect, useRef, useState } from "react";

// STEP 9/UI — local webcam stream for the video-call room. Video never leaves the browser
// (rules.md: face-presence check is client-side only).
export function useWebcam() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOn(true);
      setError(null);
    } catch (e) {
      setError(e.message || "camera blocked");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  };

  useEffect(() => {
    return () => { stop(); };
  }, []);

  return { videoRef, on, error, start, stop };
}
