import {useEffect,useRef,useState} from 'react';
import {useWebcam} from '../../hooks/useWebcam';
import FaceDetection from '../FaceDetection';
import InterviewerAvatar from '../InterviewerAvatar';
import VoicePanel from '../VoicePanel';
import Brand from '../Brand';
import {transcriptSignals} from '../../utils/deliveryMetrics';

export default function CallRoom({call,questionPrompt,busy,error,progress,onSubmit,onSkip,onFinish,feedback}) {
  const root=useRef(null), webcam=useWebcam();
  const [consent,setConsent]=useState(false),[cameraWanted,setCameraWanted]=useState(true);
  const [detector,setDetector]=useState({status:'off'}),[faces,setFaces]=useState(null);
  const [fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');
  const stopCamera=webcam.stop;
  useEffect(()=>{if(!call.enabled){stopCamera();setFaces(null);setDetector({status:'off'});}},[call.enabled,stopCamera]);
  useEffect(()=>{const changed=()=>setFullscreen(document.fullscreenElement===root.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  function observe(detected){setFaces(detected);const v=webcam.videoRef.current;call.observeFaces(detected,v?.videoWidth,v?.videoHeight);}
  function startCamera(){setFaces(null);setDetector({status:'loading'});void webcam.start();}
  function join(){call.join();if(cameraWanted)startCamera();}
  async function toggleFullscreen(){
    setFullscreenError('');
    try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current.requestFullscreen();}
    catch{setFullscreenError('Browser full screen is unavailable. The call still fills this page.');}
  }
  const signals=transcriptSignals(call.voiceText);
  return <main ref={root} className="call-room" aria-label="Interview video call">
    <header className="call-header">
      <Brand to="/dashboard"/>
      <div className="call-session-status"><span className={call.enabled?'call-status-dot active':'call-status-dot'}/>{call.enabled?'Interview in progress':'Ready to connect'}<span>Question {progress.current} of {progress.total}</span></div>
      <div className="call-header-actions">{typeof document!=='undefined' && typeof document.documentElement.requestFullscreen==='function' && <button type="button" onClick={toggleFullscreen}>{fullscreen?'Exit full screen':'Full screen'}</button>}<button type="button" className="call-end" disabled={busy} onClick={onFinish}>End interview</button></div>
      <progress className="call-progress" aria-label="Interview progress" value={progress.answered} max={progress.total}/>
    </header>
    <section className="call-stage" aria-label="Call participants">
      <InterviewerAvatar status={busy?'thinking':call.status}/>
      <div className="camera-tile">
        <div className="camera-preview">
          <video ref={webcam.videoRef} autoPlay muted playsInline aria-label="Your local camera preview" className={webcam.on?'':'hidden'}/>
          {webcam.on && <FaceDetection active videoRef={webcam.videoRef} onFacesDetected={observe} onDebug={setDetector}/>}
          {!webcam.on && <div className="camera-placeholder"><span aria-hidden="true">◯</span><p>Your camera</p><small>{webcam.pending?'Connecting…':'Camera is off'}</small></div>}
        </div>
        <div className="camera-toolbar"><span>{!webcam.on?'You':detector.status==='loading'?'Connecting camera…':detector.status!=='ready'?'Face detection unavailable':faces?.length?'Face detected':'No face detected'}</span><button type="button" disabled={!call.enabled} onClick={()=>webcam.on || webcam.pending ? webcam.stop() : startCamera()}>{webcam.pending?'Cancel camera':webcam.on?'Turn camera off':'Turn camera on'}</button></div>
      </div>
      {!call.enabled && <div className="call-lobby"><div className="call-join">
        <span className="section-kicker">Your interview call</span><h2>Let’s talk.</h2><p>Hear the question and answer aloud. Review the captions, record again if needed, then send your answer.</p>
        <div className="call-join-options"><label>Spoken language<select value={call.language} onChange={e=>call.setLanguage(e.target.value)}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label><label>Question voice<select value={call.engine} onChange={e=>call.setEngine(e.target.value)}><option value="browser">Browser voice</option><option value="neural">Online neural voice</option></select></label></div>
        <label className="call-consent"><input type="checkbox" checked={cameraWanted} onChange={e=>setCameraWanted(e.target.checked)}/>Connect my camera for framing and attention cues</label>
        <label className="call-consent"><input type="checkbox" aria-label="Speech recognition consent" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to browser speech recognition and saved delivery observations. The browser may send audio to its speech provider. Camera frames and raw audio are not saved by InterviewSpar.</span></label>
        <button type="button" className="spar-button" disabled={busy || !consent} onClick={join}>Join interview</button>
        <small>Microphone access is required. Use Chrome or Edge.</small>
      </div></div>}
    </section>
      <div className="call-question-caption"><span>Interviewer</span><h1 key={questionPrompt}>{questionPrompt}</h1></div>
    <footer className="call-footer">
      {(!call.enabled && error || webcam.error || fullscreenError) && <p role="alert" className="call-error">{(!call.enabled && error) || webcam.error || fullscreenError}</p>}
      {call.enabled ? <VoicePanel call={call} disabled={busy} submitError={error} onSubmit={onSubmit} onSkip={onSkip}/> : <p className="call-offline-note">Speech-only interview · Automatic delivery feedback · Local camera preview</p>}
      {call.enabled && <div className="call-footer-meta">
        <details name="call-information" className="call-observations"><summary>Live observations</summary><div className="delivery-live-stats"><span>Recognized words <strong>{signals.word_count}</strong></span><span>Transcript fillers <strong>{call.voiceText?signals.filler_count:'—'}</strong></span><span>Observed audio <strong>{call.audio?`${(call.audio.observed_ms/1000).toFixed(1)}s`:'—'}</strong></span><span>Pauses ≥0.5s <strong>{call.audio?call.audio.pause_count:'—'}</strong></span></div><p>Confidence cues describe delivery steadiness. Attention cues describe camera presence and tab visibility. These are practice estimates.</p></details>
        {feedback && <details name="call-information" className="call-previous-feedback"><summary>Previous answer feedback</summary><p>{feedback.feedback}</p></details>}
        <button type="button" disabled={busy} onClick={call.leave}>Disconnect devices</button>
      </div>}
    </footer>
  </main>;
}
