import { useCallback, useEffect, useRef, useState } from 'react';

/** Camera preview stays local. Pending permission requests are cancelled by generation. */
export function useWebcam() {
  const videoRef = useRef(null), streamRef = useRef(null), generation = useRef(0);
  const [on, setOn] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const release = useCallback(() => {
    generation.current++;
    streamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setOn(false); setPending(false); }, [release]);
  const start = useCallback(async () => {
    release(); const ticket = generation.current; setPending(true); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: {ideal:640}, height: {ideal:480}, facingMode:'user' }, audio: false });
      if (ticket !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => { stop(); setError('Camera disconnected. You can continue without it.'); };
      setOn(true);
    } catch { if (ticket === generation.current) setError('Camera unavailable. Check browser permission or continue without it.'); }
    finally { if (ticket === generation.current) setPending(false); }
  }, [release, stop]);
  useEffect(() => {
    if (on && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => setError('Camera preview could not play. Turn the camera off and try again.'));
    }
  }, [on]);
  useEffect(() => release, [release]);
  return { videoRef, on, pending, error, start, stop };
}
