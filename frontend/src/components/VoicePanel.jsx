import {transcriptSignals} from '../utils/deliveryMetrics';

/** Live captions and observed delivery; final transcript remains editable before submission. */
export default function VoicePanel({call, disabled = false}) {
  const signals = transcriptSignals(call.voiceText);
  const recording = ['listening','preparing'].includes(call.status);
  const finalizing = call.status === 'finalizing';
  return <div className="voice-panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-sm">Your spoken answer</h3>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="spar-button secondary" disabled={disabled || !call.enabled || call.status === 'preparing' || finalizing} onClick={() => recording ? call.stopListening() : call.listen()}>{finalizing ? 'Finishing transcript…' : recording ? 'Stop and review' : 'Speak answer'}</button>
        <button type="button" className="text-sm text-primary px-3" disabled={disabled || !call.enabled || recording || finalizing} onClick={() => call.speak(true)}>Repeat question</button>
      </div>
    </div>
    <p className="mt-3 text-sm leading-relaxed min-h-12" role="status" aria-live="polite">{call.interim || (finalizing ? 'Waiting for the last recognized words…' : recording ? 'Listening… your confirmed words appear in the answer below.' : 'Your transcript appears in the answer below. Review it before submitting.')}</p>
    {call.error && <p role="alert" className="mt-3 text-sm text-red-700">{call.error}</p>}
    <div className="delivery-live-stats"><span>Recognized words <strong>{signals.word_count}</strong></span><span>Transcript fillers <strong>{call.voiceText ? signals.filler_count : '—'}</strong></span><span>Observed audio <strong>{call.audio ? `${(call.audio.observed_ms/1000).toFixed(1)}s` : '—'}</strong></span><span>Pauses ≥0.5s <strong>{call.audio ? call.audio.pause_count : '—'}</strong></span></div>
    <p className="mt-3 text-xs text-gray-600">Fillers come from recognized text and may be missed. Pauses use microphone energy; background noise can affect them.</p>
    <p className="mt-3 text-xs text-gray-600">Attention cues while speaking: face present in {call.camera?.samples ? `${Math.round(call.camera.face_samples/call.camera.samples*100)}% of camera samples` : 'no measured samples yet'}; interview tab visible {call.focus.observed_ms ? `${Math.round((1-call.focus.hidden_ms/call.focus.observed_ms)*100)}% of observed time` : '—'}.</p>
    <label className="mt-4 flex flex-wrap gap-3 items-center text-sm">How confident did you feel? <select aria-label="Self-rated confidence" className="rounded-lg border border-gray-200 p-2 bg-white" disabled={disabled || !call.enabled} value={call.confidence} onChange={e=>call.setConfidence(e.target.value)}><option value="">Optional self-rating</option><option value="1">1 — Not confident</option><option value="2">2 — Slightly confident</option><option value="3">3 — Moderately confident</option><option value="4">4 — Confident</option><option value="5">5 — Very confident</option></select></label>
  </div>;
}
