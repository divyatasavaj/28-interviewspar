import UiIcon from './UiIcon';
/** Read-only captions: answers can only enter through the microphone. */
export default function VoicePanel({call, disabled=false, onSubmit, onSkip}) {
  const recording=['listening','preparing'].includes(call.status), finalizing=call.status==='finalizing';
  const locked=disabled || finalizing || call.status==='preparing';
  return <div className="voice-panel">
    <div className="call-transcript" role="log" aria-label="Spoken answer transcript" aria-live="polite">
      <span className="call-caption-label">You {recording ? '· microphone on' : ''}</span>
      <p>{call.voiceText || (recording ? 'Listening. Take your time and speak naturally.' : 'Your spoken answer appears here.')} {call.interim && <span className="interim-caption">{call.interim}</span>}</p>
    </div>
    {call.error && <p role="alert" className="call-error">{call.error}</p>}
    <div className="call-answer-controls"><div className="call-control-group" role="group" aria-label="Microphone and recording">
      <button type="button" disabled={locked || !call.enabled} onClick={()=>recording ? call.stopListening() : call.listen()}><UiIcon name="mic"/>{finalizing ? 'Finishing transcript…' : recording ? 'Pause microphone' : 'Continue speaking'}</button>
      <button type="button" disabled={locked || !call.enabled || recording} onClick={call.retryAnswer}>Record again</button>
      </div><div className="call-control-group" role="group" aria-label="Question controls"><button type="button" disabled={locked || !call.enabled} onClick={()=>call.speak(true)}>Repeat question</button>
      <button type="button" disabled={locked} onClick={onSkip}>Skip question</button>
      </div><button type="button" className="call-submit" disabled={locked || !call.enabled || (!call.voiceText && !recording)} onClick={onSubmit}>{disabled ? 'Saving answer…' : 'Send spoken answer'}<UiIcon name="arrow"/></button>
    </div>
  </div>;
}
