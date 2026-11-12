// Real UI/media integration with synthetic devices and a deterministic speech-service stub.
// Speech-service transcription/voice quality are deliberately not claimed by this test.
export const installCallMedia = (denied=false) => `(() => {
    const state = window.__callTest = {streams:[],questions:[],starts:0,stopTail:true,denied:${denied}};
    const originalRecognition=window.SpeechRecognition, originalWebkit=window.webkitSpeechRecognition;
    const originalSpeak=speechSynthesis.speak, originalCancel=speechSynthesis.cancel;
    const originalMedia=navigator.mediaDevices.getUserMedia;
    const originalFetch=window.fetch;
    window.fetch=async function(resource,options){
      if(typeof resource==='string' && resource.endsWith('/interview/answer') && options?.body) state.submitted=JSON.parse(options.body).delivery;
      return originalFetch.call(this,resource,options);
    };
    navigator.mediaDevices.getUserMedia=async function(constraints) {
      if (state.denied) throw new DOMException('Synthetic permission denial','NotAllowedError');
      let stream;
      if (constraints.audio) {
        const context=new AudioContext(); await context.resume();
        const oscillator=context.createOscillator(), gain=context.createGain(), destination=context.createMediaStreamDestination();
        oscillator.frequency.value=220; oscillator.connect(gain); gain.connect(destination); oscillator.start();
        const began=context.currentTime;
        for(let i=0;i<120;i+=3){gain.gain.setValueAtTime(.2,began+i);gain.gain.setValueAtTime(0,began+i+2);}
        stream=destination.stream;
        const stop=stream.getAudioTracks()[0].stop.bind(stream.getAudioTracks()[0]);
        stream.getAudioTracks()[0].stop=()=>{stop();oscillator.stop();context.close();};
      } else stream=await originalMedia.call(this,constraints);
      state.streams.push(stream); return stream;
    };
    class Recognition {
      start(){ state.current=this; state.starts++; queueMicrotask(()=>this.onstart?.()); }
      stop(){
        const finish=()=>{ if(state.stopTail) {state.emit('The result improved reliability.',this);state.stopTail=false;} this.onend?.(); };
        if(state.delayStop) state.finishStop=finish; else queueMicrotask(finish);
      }
      abort(){ this.aborted=true; }
    }
    state.emit=(text,target=state.current)=>target?.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});
    window.SpeechRecognition=Recognition;
    speechSynthesis.speak=function(utterance){ state.questions.push(utterance.text); queueMicrotask(()=>{utterance.onstart?.();utterance.onend?.();}); };
    speechSynthesis.cancel=function(){};
    state.restore=()=>{window.SpeechRecognition=originalRecognition;window.webkitSpeechRecognition=originalWebkit;speechSynthesis.speak=originalSpeak;speechSynthesis.cancel=originalCancel;navigator.mediaDevices.getUserMedia=originalMedia;window.fetch=originalFetch;};
  })()`;

export async function checkInterviewCall({goto,click,waitFor,evaluate,check,command,screenshot,savePdf,viewport,layout,hasText}) {
  const start=async()=>{
    await goto('/interview/start?persona=hr',hasText('Start interview'));
    await waitFor('document.querySelectorAll("#interview-domain option").length>4','domains');
    await click('#interview-save-consent');await click('button','Start interview');
    await waitFor('document.querySelector("progress")','call lobby');
  };
  const join=async(denied=false)=>{
    await evaluate(installCallMedia(denied));
    await click('input[aria-label="Speech recognition consent"]');await click('button','Join interview');
  };
  await start();
  check('Call lobby requires explicit speech consent',await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Join interview').disabled`));
  check('Interview has no round list, answer editor, or confidence questionnaire',await evaluate(`!document.querySelector('textarea,[contenteditable="true"],.interview-rounds,select[aria-label="Self-rated confidence"]') && !document.querySelector('.call-room').textContent.includes('Calibration')`));
  await command('Page.bringToFront');
  await click('button','Full screen');await waitFor('document.fullscreenElement?.classList.contains("call-room")','browser fullscreen');
  check('Browser full screen opens the call surface',true);
  await click('button','Exit full screen');await waitFor('!document.fullscreenElement','fullscreen exit');
  check('Exiting browser full screen preserves the call lobby',await evaluate('!!document.querySelector(".call-join")'));
  await screenshot('call-lobby-desktop');
  await join();
  await waitFor('window.__callTest.starts===1 && document.querySelector(".call-avatar-listening")','automatic microphone turn');
  check('Question playback automatically opens the spoken-answer turn',true);
  await waitFor('document.querySelector("video").srcObject?.active && document.querySelector("video").videoWidth>0','automatic synthetic camera');
  await waitFor(`document.querySelector('.camera-toolbar').textContent.includes('detected')`,'bundled face detector',45000);
  check('Joining connects the local camera and bundled face detector',true);
  await evaluate(`window.__callTest.emit('Replace this first attempt.');window.__callTest.stopTail=false;`);
  await click('button','Review transcript');await waitFor(`document.querySelector('.call-avatar-review')`,'review');
  await click('button','Record again');await waitFor('window.__callTest.starts===2','new attempt');
  check('Recording again clears the discarded transcript',await evaluate(`!document.querySelector('.call-transcript').textContent.includes('Replace this')`));
  await evaluate(`window.__callTest.stopTail=true; window.__callTest.emit('Um I built a reliable cache because our team needed faster responses and clear monitoring of each request across the service.');window.__callTest.late=window.__callTest.current.onresult;`);
  await waitFor(`parseFloat(document.querySelectorAll('.delivery-live-stats strong')[2].textContent)>=12`,'sufficient microphone timing');
  await layout('desktop video call');await screenshot('voice-call-desktop');
  check('Desktop call fills the viewport',await evaluate(`Math.abs(document.querySelector('.call-room').getBoundingClientRect().height-innerHeight)<2`));
  await viewport(390,844);await layout('mobile video call');await screenshot('voice-call-mobile');await viewport(1440);
  check('Camera stays active through recording and viewport changes',await evaluate(`document.querySelector('video').srcObject?.getVideoTracks()[0].readyState==='live'`));
  check('Sending is disabled until the recording is reviewed',await evaluate(`document.querySelector('.call-submit').disabled`));
  await click('button','Review transcript');
  await waitFor(`document.querySelector('.call-turn[data-phase="review"]') && ${hasText('The result improved reliability.')}`,'final transcript review');
  await click('button','Send spoken answer');
  await waitFor('window.__callTest.starts===3 && document.querySelector(".call-avatar-listening")','next question');
  check('Spoken answer saves final words and advances automatically',await evaluate(`window.__callTest.submitted.transcript.includes('The result improved reliability.') && !window.__callTest.submitted.transcript.includes('Replace this')`));
  await evaluate(`window.__callTest.late({resultIndex:0,results:[Object.assign([{transcript:'STALE WORDS'}],{isFinal:true})]})`);
  check('Late speech cannot enter the next answer',await evaluate(`!document.querySelector('.call-transcript').textContent.includes('STALE WORDS')`));
  check('Camera stays active across spoken questions',await evaluate(`document.querySelector('video').srcObject?.getVideoTracks()[0].readyState==='live'`));
  await evaluate('window.__callTest.delayStop=true');await click('button','Repeat question');
  await waitFor(`document.querySelector('.call-avatar-finalizing')`,'speech finalization');
  check('New recordings wait for finalization',await evaluate(`Array.from(document.querySelectorAll('.voice-panel button')).every(b=>b.disabled)`));
  await click('button','Disconnect devices');await evaluate('window.__callTest.finishStop()');
  check('Disconnecting cancels queued playback',await evaluate('window.__callTest.questions.length===2 && window.__callTest.starts===3'));
  await waitFor('window.__callTest.streams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))','released media');
  check('Disconnecting releases every microphone and camera track',true);
  await evaluate('window.__callTest.restore()');await click('button','End interview');
  await waitFor(hasText('Speaking, confidence & attention cues'),'delivery report');
  check('Report includes automatic confidence, attention, fluency and final spoken words',await evaluate(`${hasText('The result improved reliability.')} && ${hasText('Confidence cues')} && ${hasText('Speech flow')} && ${hasText('Attention cues')} && !${hasText('self-rated')}`));
  const pace=await evaluate(`(()=>{const d=window.__callTest.submitted,a=d.audio;return {eligible:d.transcript_complete && a.speech_span_ms>=5000 && a.voiced_ms>=1000 && a.observed_ms/a.capture_ms>=.8,shown:document.querySelector('.delivery-metrics dd').textContent};})()`);
  check('Saved pace respects microphone coverage',pace.eligible?/\d+ words\/min/.test(pace.shown):pace.shown==='Not measured');
  await screenshot('voice-report-desktop');await viewport(390,844);await layout('mobile voice report');await screenshot('voice-report-mobile');await viewport(1440);
  await evaluate('window.__beforeReload=true');await command('Page.reload');await waitFor(`!window.__beforeReload && ${hasText('Speaking, confidence & attention cues')}`,'report reload');
  check('Automatic delivery report survives reload',true);
  check('Full transcripts start collapsed',await evaluate('!!document.querySelector(".report-qa:not([open])")'));
  await click('a','Review question 1');
  check('Report coaching link opens the referenced transcript',await evaluate('document.querySelector("#answer-1").open'));
  await click('#answer-1 summary');
  await savePdf('voice-report');
  check('Compact PDF restores collapsed transcripts',await evaluate('!document.querySelector(".report-qa[open]")'));
  await click('input[type="checkbox"]');
  await click('.measurement-details summary');
  await evaluate('window.dispatchEvent(new Event("beforeprint"))');
  check('Full print opens transcripts and all measurement details',await evaluate('document.querySelectorAll(".measurement-details").length>1 && !document.querySelector(".report-qa:not([open]), .measurement-details:not([open])")'));
  await evaluate('window.dispatchEvent(new Event("afterprint"))');
  check('Full print restores the previously open measurement detail',await evaluate('document.querySelectorAll(".measurement-details[open]").length===1 && !document.querySelector(".report-qa[open]")'));
  await savePdf('voice-report-full');
  await click('button','Delete this interview'); await click('dialog button','Permanently delete');await waitFor('location.pathname==="/dashboard"','deletion');
  await start();await join(true);await waitFor(hasText('Microphone unavailable'),'permission denial');
  check('Denied microphone cannot submit a typed or empty answer',await evaluate(`!document.querySelector('textarea') && Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Send spoken answer').disabled`));
  check('Permission error explains how to recover',await evaluate(hasText('Allow microphone access')));
  await evaluate('window.__callTest.denied=false');
  await click('button','Start microphone');
  await waitFor('window.__callTest.starts===1 && document.querySelector(".call-turn[data-phase=listening]")','retry microphone in place');
  check('Microphone can be retried without leaving the interview',true);
  await evaluate('window.__callTest.restore()');await click('button','End interview');await waitFor(hasText('Your interview feedback'),'empty report');
  check('Failed microphone does not fabricate delivery measurements',await evaluate(`!${hasText('Speaking, confidence & attention cues')}`));
  await click('button','Delete this interview'); await click('dialog button','Permanently delete');await waitFor('location.pathname==="/dashboard"','failed call deletion');
}
