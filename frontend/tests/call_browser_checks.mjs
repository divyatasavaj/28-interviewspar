// Real UI/media integration with synthetic devices and a deterministic speech-service stub.
// Speech-service transcription/voice quality are deliberately not claimed by this test.
export async function checkInterviewCall({goto,click,fill,select,waitFor,evaluate,check,command,screenshot,viewport,layout,hasText}) {
  const install = denied => `(() => {
    const state = window.__callTest = {streams:[],questions:[],starts:0,stopTail:true};
    const originalRecognition=window.SpeechRecognition, originalWebkit=window.webkitSpeechRecognition;
    const originalSpeak=speechSynthesis.speak, originalCancel=speechSynthesis.cancel;
    const originalMedia=navigator.mediaDevices.getUserMedia;
    const originalFetch=window.fetch;
    window.fetch=async function(resource,options){
      if(typeof resource==='string' && resource.endsWith('/interview/answer') && options?.body) state.submitted=JSON.parse(options.body).delivery;
      return originalFetch.call(this,resource,options);
    };
    navigator.mediaDevices.getUserMedia=async function(constraints) {
      if (${denied}) throw new DOMException('Synthetic permission denial','NotAllowedError');
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
  const start = async () => {
    await goto('/interview/start?persona=hr',hasText('Start interview'));
    await waitFor('document.querySelectorAll("select option").length>4','domains for call');
    await click('input[type="checkbox"]'); await click('button','Start interview');
    await waitFor('document.querySelector("progress")','call room');
  };
  await start();
  check('Voice mode requires explicit observation consent',await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Join voice interview').disabled`));
  await evaluate(install(false));
  await click('.call-join input[type="checkbox"]'); await click('button','Join voice interview');
  await waitFor('window.__callTest.starts===1 && document.querySelector(".call-avatar-listening")','automatic microphone turn');
  check('Question playback automatically opens the spoken-answer turn',true);
  await click('button','Turn camera on');
  await waitFor('document.querySelector("video").srcObject?.active && document.querySelector("video").videoWidth>0','synthetic camera preview');
  await waitFor(`document.querySelector('.camera-toolbar').textContent.includes('detected')`,'bundled face detector',45000);
  check('Camera preview and bundled face detector run locally',true);
  await evaluate(`window.__callTest.emit('Um I built a cache because our team needed faster responses and clearer monitoring for the service.'); window.__callTest.late=window.__callTest.current.onresult;`);
  await waitFor(`parseFloat(document.querySelectorAll('.delivery-live-stats strong')[2].textContent)>=6.5`,'observed microphone timing');
  await select('select[aria-label="Self-rated confidence"]','4');
  await layout('desktop voice call'); await screenshot('voice-call-desktop');
  await viewport(390,844); await layout('mobile voice call'); await screenshot('voice-call-mobile'); await viewport(1440);
  check('Camera stays active throughout the answer and viewport changes',await evaluate(`document.querySelector('video').srcObject?.getVideoTracks()[0].readyState==='live'`));
  await click('button','Submit answer');
  await waitFor(`window.__callTest.starts===2 && document.querySelector('.call-avatar-listening')`,'next spoken question');
  check('Submitting waits for final speech and starts the next question',await evaluate(`window.__callTest.questions.length===2 && document.querySelector('.delivery-feedback')?.textContent.includes('Transcript fillers')`));
  await evaluate(`window.__callTest.late({resultIndex:0,results:[Object.assign([{transcript:'STALE WORDS'}],{isFinal:true})]})`);
  check('Late speech callbacks cannot enter the next answer',await evaluate(`!document.querySelector('form textarea').value.includes('STALE WORDS')`));
  check('Camera stays active across spoken questions',await evaluate(`document.querySelector('video').srcObject?.getVideoTracks()[0].readyState==='live'`));
  await evaluate('window.__callTest.delayStop=true');
  await click('button','Read question aloud');
  await waitFor(`document.querySelector('.call-avatar-finalizing')`,'final speech before repeating');
  check('New recordings wait while the last recognized words are finalized',await evaluate(`Array.from(document.querySelectorAll('.voice-panel button')).every(b=>b.disabled)`));
  await click('button','Leave voice mode');
  await evaluate('window.__callTest.finishStop()');
  check('Leaving during finalization cannot restart question playback',await evaluate('window.__callTest.questions.length===2 && window.__callTest.starts===2'));
  await waitFor(`window.__callTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))`,'all call tracks released');
  check('Leaving voice mode releases microphone and camera tracks',true);
  await evaluate('window.__callTest.restore()');
  await click('button','Finish and view report');
  await waitFor(hasText('Speaking, fluency & attention cues'),'saved delivery report');
  check('Report includes final recognized words and delivery observations',await evaluate(`${hasText('The result improved reliability.')} && ${hasText('4 / 5')} && ${hasText('Recognized filler expressions: um')}`));
  // Debugger/renderer stalls are missing coverage, not a reason to fabricate pace.
  const pace = await evaluate(`(() => {
    const d=window.__callTest.submitted, a=d?.audio;
    const eligible=d?.transcript_complete && a?.speech_span_ms>=5000 && a.voiced_ms>=1000 && a.observed_ms/a.capture_ms>=.8;
    const shown=document.querySelector('.delivery-metrics dd')?.textContent;
    return {eligible,shown,coverage:a ? 100*a.observed_ms/a.capture_ms : null};
  })()`);
  check('Saved pace respects the captured microphone coverage',pace.eligible ? /[0-9]+ words\/min/.test(pace.shown) : pace.shown==='Not measured');
  console.log(`Synthetic microphone coverage: ${pace.coverage?.toFixed(1)}%; pace shown: ${pace.shown}`);
  await screenshot('voice-report-desktop');
  await viewport(390,844); await layout('mobile voice report'); await screenshot('voice-report-mobile'); await viewport(1440);
  await evaluate('window.__beforeReload = true');
  await command('Page.reload'); await waitFor(`!window.__beforeReload && ${hasText('Speaking, fluency & attention cues')}`,'delivery report reload');
  check('Delivery report survives reload',true);
  await click('button','Delete this interview'); await waitFor('location.pathname==="/dashboard"','voice session deletion');

  await start(); await evaluate(install(true));
  await click('.call-join input[type="checkbox"]'); await click('button','Join voice interview');
  await waitFor(hasText('Microphone unavailable'),'controlled permission error');
  check('Denied microphone permission leaves a usable typed interview',true);
  await click('button','Leave voice mode'); await evaluate('window.__callTest.restore()');
  await fill('form textarea','I built an inventory dashboard because the team needed visibility. The result reduced manual checking.');
  await click('button','Submit answer'); await waitFor(hasText('Question 2 of'),'typed fallback progression');
  await click('button','Finish and view report'); await waitFor(hasText('Your interview feedback'),'typed fallback report');
  check('Unavailable microphone measurements are not fabricated in reports',await evaluate(`!${hasText('Speaking, fluency & attention cues')}`));
  await click('button','Delete this interview'); await waitFor('location.pathname==="/dashboard"','typed fallback deletion');
}
