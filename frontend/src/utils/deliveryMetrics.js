/** Local microphone observations. Energy is a speech-activity estimate, not emotion detection. */
export class SpeechActivity {
  constructor() { this.observed = 0; this.voiced = 0; this.first = null; this.last = 0; this.pauseCount = 0; this.pauseMs = 0; this.longestPause = 0; this.clipped = 0; this.samples = 0; }
  sample(rms, peak, elapsedMs) {
    // A suspended/background tab is missing coverage, never a measured long pause.
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs > 250) return;
    const start = this.observed;
    this.observed += elapsedMs;
    this.samples++;
    if (peak >= .98) this.clipped++;
    if (rms >= .018) {
      if (this.first === null) this.first = start;
      else if (start - this.last >= 500) {
        const gap = start - this.last;
        this.pauseCount++; this.pauseMs += gap; this.longestPause = Math.max(this.longestPause, gap);
      }
      this.voiced += elapsedMs;
      this.last = this.observed;
    }
  }
  snapshot() {
    return { observed_ms: Math.round(this.observed), voiced_ms: Math.round(this.voiced),
      speech_span_ms: this.first === null ? 0 : Math.round(this.last - this.first),
      pause_count: this.pauseCount, pause_ms: Math.round(this.pauseMs), longest_pause_ms: Math.round(this.longestPause),
      sample_count: this.samples, clipped_samples: this.clipped };
  }
}

export function transcriptSignals(text = '') {
  const words = text.trim().match(/\b[\p{L}\p{N}]+(?:['’][\p{L}]+)?\b/gu) || [];
  const fillers = [...text.toLowerCase().matchAll(/\b(um+|uh+|erm|er|hmm+|you know|i mean)\b/g)].map(m => m[0]);
  const possible = [...text.toLowerCase().matchAll(/\b(like|well|actually|basically|literally)\b/g)].map(m => m[0]);
  return { word_count: words.length, filler_count: fillers.length, possible_filler_count: possible.length };
}

/** Bounds-based framing only. Face position does not establish eye contact or attention. */
export function cameraObservation(faces, width, height) {
  if (!(width > 0 && height > 0) || !Array.isArray(faces)) return null;
  const face = faces.length === 1 ? faces[0].box : null;
  const centered = !!face && Math.abs((face.x + face.width / 2) / width - .5) <= .25
    && Math.abs((face.y + face.height / 2) / height - .5) <= .3;
  return { face: faces.length > 0, centered, multiple: faces.length > 1 };
}

/** Visibility events retain elapsed hidden time even when background timers are throttled. */
export class VisibilityActivity {
  constructor() { this.last = null; this.hidden = false; this.data = {observed_ms:0,hidden_ms:0,hidden_count:0}; }
  tick(now) {
    if (this.last !== null) {
      const elapsed = Math.max(0,Math.round(now-this.last)); this.data.observed_ms += elapsed;
      if (this.hidden) this.data.hidden_ms += elapsed;
      this.last = now;
    }
    return {...this.data};
  }
  setRunning(running, now, hidden) { this.tick(now); this.last = running ? now : null; this.hidden = hidden; }
  visibility(hidden,now) {
    this.tick(now);
    if (this.last !== null && hidden && !this.hidden) this.data.hidden_count++;
    this.hidden = hidden;
  }
}
