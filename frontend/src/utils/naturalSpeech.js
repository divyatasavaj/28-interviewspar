import { fetchSpeechAudioBlob } from '../api/tts.js';

let cancelCurrent = () => {};

export function stopAnySpeech() {
  cancelCurrent();
  cancelCurrent = () => {};
  window.speechSynthesis?.cancel();
}

export function playHumanSpeech(text, options = {}) {
  stopAnySpeech();
  const cleaned = (text || '').replace(/```[\s\S]*?```/g, '').replace(/[*#`_]/g, '').trim();
  const voice = options.voice ?? localStorage.getItem('interviewer_voice') ?? 'en-US-AvaNeural';
  const rate = options.rate ?? localStorage.getItem('interviewer_rate') ?? '-3%';
  const pitch = options.pitch ?? localStorage.getItem('interviewer_pitch') ?? '+0Hz';

  return new Promise(resolve => {
    let finished = false;
    let fallbackStarted = false;
    let audio = null;
    let url = null;
    let playbackTimeout;
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 16000);

    function releaseAudio() {
      if (audio) {
        audio.onplay = audio.onended = audio.onerror = null;
        audio.pause();
      }
      if (url) { URL.revokeObjectURL(url); url = null; }
    }
    function finish(cancelled = false) {
      if (finished) return;
      finished = true;
      clearTimeout(requestTimeout);
      clearTimeout(playbackTimeout);
      controller.abort();
      releaseAudio();
      if (cancelled) window.speechSynthesis?.cancel();
      else options.onEnd?.();
      resolve();
    }
    cancelCurrent = () => finish(true);

    function fallback() {
      if (finished || fallbackStarted) return;
      fallbackStarted = true;
      clearTimeout(playbackTimeout);
      clearTimeout(requestTimeout);
      releaseAudio();
      if (!window.speechSynthesis) { options.onError?.(); finish(); return; }
      try {
        const speech = new SpeechSynthesisUtterance(cleaned);
        speech.lang = 'en-US';
        speech.rate = Math.max(0.5, Math.min(2, 1 + (Number.parseFloat(rate) || 0) / 100));
        speech.onstart = () => { if (!finished) options.onStart?.(); };
        speech.onend = () => finish();
        speech.onerror = () => { if (!finished) options.onError?.(); finish(); };
        playbackTimeout = setTimeout(() => { window.speechSynthesis.cancel(); finish(); }, 180000);
        window.speechSynthesis.speak(speech);
      } catch {
        options.onError?.();
        finish();
      }
    }

    if (!cleaned) { finish(); return; }
    fetchSpeechAudioBlob(cleaned, voice, rate, pitch, controller.signal).then(blob => {
      clearTimeout(requestTimeout);
      if (finished) return;
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onplay = () => { if (!finished) options.onStart?.(); };
      audio.onended = () => finish();
      audio.onerror = fallback;
      playbackTimeout = setTimeout(() => finish(true), 180000);
      audio.play().catch(fallback);
    }).catch(fallback);
  });
}
