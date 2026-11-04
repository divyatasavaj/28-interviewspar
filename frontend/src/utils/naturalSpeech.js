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
    let source = 'neural';
    let playbackTimeout, startupTimeout;
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 16000);

    function releaseAudio() {
      if (audio) {
        audio.onplay = audio.onended = audio.onerror = null;
        audio.pause();
      }
      if (url) { URL.revokeObjectURL(url); url = null; }
    }
    function finish(status = 'ended') {
      if (finished) return;
      finished = true;
      clearTimeout(requestTimeout);
      clearTimeout(playbackTimeout);
      clearTimeout(startupTimeout);
      controller.abort();
      releaseAudio();
      if (status !== 'ended') window.speechSynthesis?.cancel();
      else options.onEnd?.();
      resolve({status, source});
    }
    cancelCurrent = () => finish('cancelled');

    function fallback() {
      if (finished || fallbackStarted) return;
      fallbackStarted = true;
      source = 'browser';
      clearTimeout(playbackTimeout);
      clearTimeout(startupTimeout);
      clearTimeout(requestTimeout);
      releaseAudio();
      if (!window.speechSynthesis) { options.onError?.(); finish('unavailable'); return; }
      try {
        const speech = new SpeechSynthesisUtterance(cleaned);
        speech.lang = options.language || 'en-US';
        const voices = window.speechSynthesis.getVoices?.() || [];
        speech.voice = voices.find(v => v.lang === speech.lang) || null;
        speech.rate = Math.max(0.5, Math.min(2, 1 + (Number.parseFloat(rate) || 0) / 100));
        speech.onstart = () => { clearTimeout(startupTimeout); if (!finished) options.onStart?.(); };
        speech.onend = () => finish();
        speech.onerror = () => { if (!finished) options.onError?.(); finish('unavailable'); };
        playbackTimeout = setTimeout(() => { options.onError?.(); finish('unavailable'); }, 180000);
        startupTimeout = setTimeout(() => { options.onError?.(); finish('unavailable'); }, 10000);
        window.speechSynthesis.speak(speech);
      } catch {
        options.onError?.();
        finish('unavailable');
      }
    }

    if (!cleaned) { finish(); return; }
    if (options.engine === 'browser') { fallback(); return; }
    fetchSpeechAudioBlob(cleaned, voice, rate, pitch, controller.signal).then(blob => {
      clearTimeout(requestTimeout);
      if (finished) return;
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onplay = () => { clearTimeout(startupTimeout); if (!finished) options.onStart?.(); };
      audio.onended = () => finish();
      audio.onerror = fallback;
      playbackTimeout = setTimeout(() => { options.onError?.(); finish('unavailable'); }, 180000);
      startupTimeout = setTimeout(fallback, 10000);
      audio.play().catch(fallback);
    }).catch(fallback);
  });
}
