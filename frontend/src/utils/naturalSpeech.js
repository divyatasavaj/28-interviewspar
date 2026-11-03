import {fetchSpeechAudioBlob} from '../api/tts';
let cancelCurrent = () => {};
export function stopAnySpeech() { cancelCurrent(); cancelCurrent=()=>{}; window.speechSynthesis?.cancel(); }
export function playHumanSpeech(text, options={}) {
  stopAnySpeech();
  const cleaned=(text || '').replace(/```[\s\S]*?```/g,'').replace(/[*#`_]/g,'').trim();
  return new Promise(resolve=>{
    let finished=false,audio=null,url=null;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),16000);
    function finish(cancelled=false){
      if(finished)return;finished=true;clearTimeout(timeout);controller.abort();audio?.pause();
      if(url)URL.revokeObjectURL(url);
      if(!cancelled)options.onEnd?.();resolve();
    }
    cancelCurrent=()=>finish(true);
    function fallback(){
      if(finished)return;
      if(!window.speechSynthesis){finish();return;}
      const speech=new SpeechSynthesisUtterance(cleaned);speech.lang='en-US';speech.rate=.92;
      speech.onstart=()=>options.onStart?.();speech.onend=()=>finish();speech.onerror=()=>{options.onError?.();finish();};
      window.speechSynthesis.speak(speech);
    }
    if(!cleaned){finish();return;}
    fetchSpeechAudioBlob(cleaned,options.voice,options.rate,options.pitch,controller.signal).then(blob=>{
      clearTimeout(timeout);if(finished)return;url=URL.createObjectURL(blob);audio=new Audio(url);
      audio.onplay=()=>options.onStart?.();audio.onended=()=>finish();audio.onerror=fallback;
      audio.play().catch(fallback);
    }).catch(fallback);
  });
}
