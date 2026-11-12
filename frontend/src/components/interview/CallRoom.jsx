import {useEffect,useRef,useState} from 'react';
import {useWebcam} from '../../hooks/useWebcam';
import FaceDetection from '../FaceDetection';
import InterviewerAvatar from '../InterviewerAvatar';
import VoicePanel from '../VoicePanel';
import Brand from '../Brand';
import CodeEditor from './CodeEditor';
import {transcriptSignals} from '../../utils/deliveryMetrics';

export default function CallRoom({call,question,sessionId,hasCoding,codingOnly,busy,error,progress,onSubmit,onSkip,onFinish,feedback,onCodeChange,onCodeSubmit}) {
  const root=useRef(null), webcam=useWebcam();
  const [consent,setConsent]=useState(false),[cameraWanted,setCameraWanted]=useState(true);
  const [detector,setDetector]=useState({status:'off'}),[faces,setFaces]=useState(null);
  const [fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');
  const [microphoneCheck,setMicrophoneCheck]=useState('');
  const [checkingMic,setCheckingMic]=useState(false);
  const stopCamera=webcam.stop;
  useEffect(()=>{if(!call.enabled){stopCamera();setFaces(null);setDetector({status:'off'});}},[call.enabled,stopCamera]);
  useEffect(()=>{const changed=()=>setFullscreen(document.fullscreenElement===root.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  function observe(detected){setFaces(detected);const v=webcam.videoRef.current;call.observeFaces(detected,v?.videoWidth,v?.videoHeight);}
  function startCamera(){setFaces(null);setDetector({status:'loading'});void webcam.start();}
  function join(){call.join();if(cameraWanted && !webcam.on && !webcam.pending)startCamera();}
  function toggleCameraWanted(event){
    setCameraWanted(event.target.checked);
    if(!event.target.checked)webcam.stop();
  }
  async function checkMicrophone(){
    setCheckingMic(true);
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      stream.getTracks().forEach(track=>track.stop());
      setMicrophoneCheck(window.SpeechRecognition || window.webkitSpeechRecognition
        ? 'Microphone access confirmed.' : 'Microphone access confirmed. Speech recognition needs Chrome or Edge.');
    } catch {
      setMicrophoneCheck('Microphone access unavailable. Check browser permissions and try again.');
    } finally {setCheckingMic(false);}
  }
  async function toggleFullscreen(){
    setFullscreenError('');
    try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current.requestFullscreen();}
    catch{setFullscreenError('Browser full screen is unavailable. The call still fills this page.');}
  }
  const signals=transcriptSignals(call.voiceText);
  const coding=question.hands_on;
  const codingActive=coding && call.enabled;
  const previewing=!call.enabled && (webcam.on || webcam.pending);
  return <main ref={root} className={codingActive?'call-room call-room--coding':'call-room'} aria-label="Interview video call">
    <header className="call-header">
      <Brand to="/dashboard"/>
      <div className="call-session-status"><span className={call.enabled?'call-status-dot active':'call-status-dot'}/>{call.enabled?'Interview in progress':'Ready to connect'}<span>Question {progress.current} of {progress.total}</span></div>
      <div className="call-header-actions">{typeof document!=='undefined' && typeof document.documentElement.requestFullscreen==='function' && <button type="button" onClick={toggleFullscreen}>{fullscreen?'Exit full screen':'Full screen'}</button>}<button type="button" className="call-end" disabled={busy} onClick={onFinish}>End interview</button></div>
      <progress className="call-progress" aria-label="Interview progress" value={progress.answered} max={progress.total}/>
    </header>
    <section className={previewing?'call-stage call-stage--preview':'call-stage'} aria-label="Call participants">
      {!codingActive && !previewing && <InterviewerAvatar status={busy?'thinking':call.status}/>}
      <div className="camera-tile">
        <div className="camera-preview">
          <video ref={webcam.videoRef} autoPlay muted playsInline aria-label="Your local camera preview" className={webcam.on?'':'hidden'}/>
          {webcam.on && <FaceDetection active videoRef={webcam.videoRef} onFacesDetected={observe} onDebug={setDetector}/>}
          {!webcam.on && <div className="camera-placeholder"><span aria-hidden="true">◯</span><p>Your camera</p><small>{webcam.pending?'Connecting…':'Camera is off'}</small></div>}
        </div>
        <div className="camera-toolbar"><span>{!webcam.on?'You':detector.status==='loading'?'Connecting camera…':detector.status!=='ready'?'Face detection unavailable':faces?.length?'Face detected':'No face detected'}</span><button type="button" disabled={!call.enabled && !previewing} onClick={()=>webcam.on || webcam.pending ? webcam.stop() : startCamera()}>{webcam.pending?'Cancel camera':webcam.on?'Turn camera off':'Turn camera on'}</button></div>
      </div>
      {!call.enabled && <div className="call-lobby"><div className="call-join">
        <h2>{codingOnly?'Join coding practice':'Join your interview'}</h2>
        <p>{codingOnly ? 'Solve the exercises, then review your report.' : hasCoding ? 'Solve coding exercises, then answer interview questions aloud.' : 'Hear the questions, answer aloud, and review the captions before sending.'}</p>
        {!codingOnly && <div className="call-join-options"><label>Spoken language<select value={call.language} onChange={e=>call.setLanguage(e.target.value)}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label><label>Question voice<select value={call.engine} onChange={e=>call.setEngine(e.target.value)}><option value="browser">Browser voice</option><option value="neural">Online neural voice</option></select></label></div>}
        <label className="call-consent"><input type="checkbox" checked={cameraWanted} onChange={toggleCameraWanted}/>Connect my camera for framing and presence observations</label>
        <div className="device-check">
          {cameraWanted && <button type="button" onClick={previewing?webcam.stop:startCamera}>{previewing?'Stop camera preview':'Preview camera'}</button>}
          {!codingOnly && <button type="button" disabled={checkingMic} onClick={checkMicrophone}>{checkingMic?'Checking microphone…':'Check microphone'}</button>}
          {microphoneCheck && <p role="status">{microphoneCheck}</p>}
          {webcam.error && <p role="status">{webcam.error}</p>}
        </div>
        <label className="call-consent"><input type="checkbox" aria-label={codingOnly?'Coding observations consent':'Speech recognition consent'} checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{codingOnly
          ? 'I agree to saved tab visibility and face-presence observations when the camera is enabled. Camera frames stay on this device.'
          : 'I agree to browser speech recognition and saved observations. The browser may send audio to its speech provider. Camera frames stay on this device.'}</span></label>
        <button type="button" className="spar-button" disabled={busy || !consent || checkingMic} onClick={join}>Join interview</button>
        {!codingOnly && <small>Spoken answers use microphone access in Chrome or Edge.</small>}
      </div></div>}
    </section>
    {!codingActive && <div className="call-question-caption">
      <span>{coding ? 'Coding exercise' : question.source === 'ai-follow-up' ? 'AI follow-up' : 'Interviewer'}</span>
      <h1 key={question.id}>{coding ? question.title : question.prompt}</h1>
      {coding && <p className="coding-prompt">{question.prompt}</p>}
    </div>}
    <footer className="call-footer">
      {(!call.enabled || coding) && error && <p role="alert" className="call-error">{error}</p>}
      {(webcam.error || fullscreenError) && <p role="alert" className="call-error">{webcam.error || fullscreenError}</p>}
      {coding && <div hidden={!call.enabled}>
        <CodeEditor key={question.id} question={question} sessionId={sessionId} disabled={busy || !call.enabled}
          onChange={onCodeChange} onSubmit={onCodeSubmit} onSkip={onSkip}/>
      </div>}
      {call.enabled && !coding && <VoicePanel call={call} disabled={busy} submitError={error} onSubmit={onSubmit} onSkip={onSkip}/>}
      {call.enabled && <div className="call-footer-meta">
        <details name="call-information" className="call-observations"><summary>Live observations</summary>
          {coding ? <><div className="delivery-live-stats"><span>Camera samples <strong>{call.camera?.samples ?? '—'}</strong></span><span>Tab switches <strong>{call.focus?.hidden_count ?? 0}</strong></span></div><p>The microphone pauses during coding. Face presence and tab visibility are saved as practice observations.</p></>
          : <><div className="delivery-live-stats"><span>Recognized words <strong>{signals.word_count}</strong></span><span>Transcript fillers <strong>{call.voiceText?signals.filler_count:'—'}</strong></span><span>Observed audio <strong>{call.audio?`${(call.audio.observed_ms/1000).toFixed(1)}s`:'—'}</strong></span><span>Pauses ≥0.5s <strong>{call.audio?call.audio.pause_count:'—'}</strong></span></div><p>Confidence cues describe delivery steadiness. Attention cues describe camera presence and tab visibility. These are practice estimates.</p></>}
        </details>
        {feedback && <details name="call-information" className="call-previous-feedback"><summary>Previous answer feedback</summary><p>{feedback.feedback}</p>{feedback.ai_review && <p>AI code review · {feedback.ai_review}</p>}</details>}
        <button type="button" disabled={busy} onClick={call.leave}>Disconnect devices</button>
      </div>}
    </footer>
  </main>;
}
