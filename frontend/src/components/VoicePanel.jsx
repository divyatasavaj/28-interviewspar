import UiIcon from './UiIcon';

const phaseLabels = {
  idle: 'Getting your question ready',
  'loading-question': 'Loading question audio',
  speaking: 'Interviewer is speaking',
  preparing: 'Connecting your microphone',
  listening: 'Microphone is recording',
  finalizing: 'Finishing your transcript',
};

export default function VoicePanel({ call, disabled = false, submitError, onSubmit, onSkip }) {
  const { status, voiceText, interim, error, listen, stopListening, retryAnswer, speak } = call;
  const recording = status === 'listening';
  const reviewing = status === 'review';
  const hasAnswer = Boolean(voiceText.trim());
  const locked = disabled || status === 'preparing' || status === 'finalizing';
  const phase = disabled ? 'Saving your answer'
    : reviewing ? (hasAnswer ? 'Review your transcript' : 'Ready for your answer')
      : phaseLabels[status];
  const guidance = recording ? 'Speak your answer, then select Review transcript.'
    : reviewing && hasAnswer ? 'Check the captions, then send your answer or record again.'
      : reviewing ? 'Select Start microphone when you’re ready to answer.' : '';

  return <div className="voice-panel">
    <div className="call-turn" data-phase={status}>
      <p role="status">{phase}</p>
      {guidance && <p>{guidance}</p>}
    </div>
    <div className="call-transcript" role="log" aria-label="Spoken answer transcript" aria-live="polite">
      <span className="call-caption-label">Your spoken answer</span>
      <p>{voiceText}{interim && <span className="interim-caption"> {interim}</span>}
        {!voiceText && !interim && 'Your captions appear here as you speak.'}
      </p>
    </div>
    {(error || submitError) && <p role="alert" className="call-error">{submitError || error}</p>}
    <div className="call-answer-controls">
      <div className="call-control-group" role="group" aria-label="Microphone and recording">
        <button type="button" disabled={locked || (!recording && !reviewing)}
          className={recording || (reviewing && !hasAnswer) ? 'call-primary' : undefined}
          onClick={recording ? stopListening : listen}>
          <UiIcon name="mic"/>{recording ? 'Review transcript' : hasAnswer ? 'Continue speaking' : 'Start microphone'}
        </button>
        {hasAnswer && <button type="button" disabled={locked || !reviewing} onClick={retryAnswer}>Record again</button>}
      </div>
      <div className="call-control-group" role="group" aria-label="Question controls">
        <button type="button" disabled={locked || (!recording && !reviewing)} onClick={() => speak(true)}>Repeat question</button>
        <button type="button" disabled={locked} onClick={onSkip}>Skip question</button>
      </div>
      <button type="button" className="call-submit" disabled={locked || !reviewing || !hasAnswer} onClick={onSubmit}>
        {disabled ? 'Saving answer…' : 'Send spoken answer'}<UiIcon name="arrow"/>
      </button>
    </div>
  </div>;
}
