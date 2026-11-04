import {useEffect, useState} from 'react';
import {useWebcam} from '../../hooks/useWebcam';
import FaceDetection from '../FaceDetection';
import InterviewerAvatar from '../InterviewerAvatar';
import VoicePanel from '../VoicePanel';

/** Active call surface: browser speech plus local camera, connected to the saved interview. */
export default function CallRoom({call, interviewType, questionPrompt, busy}) {
  const webcam = useWebcam();
  const [consent,setConsent] = useState(false), [detector,setDetector] = useState({status:'off'}), [faces,setFaces] = useState(null);
  const [aspect,setAspect] = useState(4/3);
  const stopCamera = webcam.stop;
  useEffect(() => { if (!call.enabled) { stopCamera(); setFaces(null); setDetector({status:'off'}); } }, [call.enabled,stopCamera]);
  function observe(detected) {
    setFaces(detected);
    const video = webcam.videoRef.current;
    call.observeFaces(detected,video?.videoWidth,video?.videoHeight);
  }
  return <section className="call-room" aria-labelledby="call-title">
    <div className="flex flex-wrap justify-between items-start gap-4 mb-4"><div><h2 id="call-title" className="text-lg font-bold">Your interview call</h2><p className="text-sm text-gray-600 mt-1">Hear the question, speak your answer, then review and submit.</p></div>{call.enabled && <button type="button" disabled={busy} className="text-sm text-primary underline" onClick={call.leave}>Leave voice mode</button>}</div>
    <div className="call-tiles">
      <InterviewerAvatar status={busy ? 'thinking' : call.status} interviewType={interviewType}/>
      <div className="camera-tile">
        <div className="camera-preview" style={{aspectRatio:aspect}}>
          <video ref={webcam.videoRef} autoPlay muted playsInline aria-label="Your local camera preview" onLoadedMetadata={e=>setAspect(e.currentTarget.videoWidth/e.currentTarget.videoHeight || 4/3)} className={webcam.on ? '' : 'hidden'}/>
          {webcam.on && <FaceDetection active={webcam.on} videoRef={webcam.videoRef} onFacesDetected={observe} onDebug={setDetector}/>}
          {!webcam.on && <div className="camera-placeholder"><span aria-hidden="true">◯</span><p>Your camera is off</p><small>You can practice with voice alone.</small></div>}
        </div>
        <div className="camera-toolbar"><span>{!webcam.on ? 'Local preview' : detector.status === 'loading' ? 'Loading face detection…' : detector.status !== 'ready' ? 'Face detection unavailable' : faces?.length ? `${faces.length} face${faces.length === 1 ? '' : 's'} detected` : 'No face detected in this sample'}</span><button type="button" disabled={busy || !call.enabled} onClick={() => { if (webcam.on || webcam.pending) webcam.stop(); else { setFaces(null); setDetector({status:'loading'}); void webcam.start(); } }}>{webcam.pending ? 'Cancel camera' : webcam.on ? 'Turn camera off' : 'Turn camera on'}</button></div>
      </div>
    </div>
    <p className="call-question-caption" aria-live="polite">{questionPrompt}</p>
    {webcam.error && <p role="alert" className="mt-3 text-sm text-red-700">{webcam.error}</p>}
    {!call.enabled && <div className="call-join">
      <div className="flex flex-wrap gap-4 mb-4"><label className="text-sm">Spoken language<select className="ml-2 rounded-lg border p-2 bg-white" value={call.language} onChange={e=>call.setLanguage(e.target.value)}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label><label className="text-sm">Question voice<select className="ml-2 rounded-lg border p-2 bg-white" value={call.engine} onChange={e=>call.setEngine(e.target.value)}><option value="browser">Browser voice</option><option value="neural">Online neural voice</option></select></label></div>
      <label className="flex gap-3 items-start text-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>I agree to browser speech recognition and saving delivery observations with my answers. My browser may send speech to its recognition provider. Camera frames and raw audio are not saved by InterviewSpar.</span></label>
      <button type="button" className="spar-button mt-4" disabled={busy || !consent} onClick={call.join}>Join voice interview</button>
    </div>}
    {(call.enabled || call.voiceText) && <VoicePanel call={call} disabled={busy}/>}
    <p className="text-xs text-gray-600 mt-4 leading-relaxed">Attention cues use tab visibility and sampled face presence/framing. They do not establish attention or eye contact. Confidence is your optional self-rating. Typed answers remain available.</p>
  </section>;
}
