import { SpeechActivity } from './deliveryMetrics.js';

/** Read microphone energy in memory; release every track on stop, cancellation or failure. */
export function createAudioMeter(onUpdate, onLost = () => {}) {
  let stream, context, timer, source, stopped = false, startedAt, previous, lastUpdate = 0;
  const activity = new SpeechActivity();
  function snapshot() { return { ...activity.snapshot(), capture_ms: startedAt ? Math.round(performance.now() - startedAt) : 0 }; }
  function stop() {
    const result = snapshot(); stopped = true; clearInterval(timer);
    source?.disconnect(); stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    context?.close().catch(() => {});
    return result;
  }
  return {
    async start() {
      try {
        // Meter the input consistently; speech recognition applies its own processing.
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return false; }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext(); await context.resume();
        if (stopped) { stop(); return false; }
        source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser(); analyser.fftSize = 2048; source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        startedAt = previous = performance.now();
        stream.getAudioTracks()[0].onended = () => { stop(); onLost(); };
        timer = setInterval(() => {
          const current = performance.now(), elapsed = current - previous; previous = current;
          if (context.state !== 'running') return;
          analyser.getFloatTimeDomainData(samples);
          let sum = 0, peak = 0;
          for (const value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
          activity.sample(Math.sqrt(sum / samples.length), peak, elapsed);
          if (current - lastUpdate >= 250) { lastUpdate = current; onUpdate(snapshot()); }
        }, 50);
        return true;
      } catch (error) { stop(); throw error; }
    },
    stop, snapshot,
  };
}
