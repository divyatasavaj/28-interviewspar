import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { playHumanSpeech, stopAnySpeech } from '../src/utils/naturalSpeech.js';
import { createDictation } from '../src/utils/dictation.js';

const names = ['window', 'localStorage', 'Audio', 'SpeechSynthesisUtterance', 'fetch'];
const originals = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let spoken, audioInstances;
beforeEach(() => {
  spoken = []; audioInstances = [];
  const values = new Map([['interviewer_voice','en-US-BrianNeural'],['interviewer_rate','+10%'],['interviewer_pitch','+2Hz']]);
  const globals = {
    localStorage: {getItem: key => values.get(key) ?? null},
    window: {speechSynthesis: {cancel(){}, speak(utterance){spoken.push(utterance);}}},
    SpeechSynthesisUtterance: class {constructor(text){this.text=text;}},
    Audio: class {constructor(){audioInstances.push(this);} play(){return Promise.resolve();} pause(){}},
    fetch: async () => ({ok:true, blob:async () => new Blob(['synthetic audio'], {type:'audio/mpeg'})}),
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, {value, configurable:true, writable:true});
});
afterEach(() => {
  stopAnySpeech();
  for (const name of names) {
    if (originals[name]) Object.defineProperty(globalThis, name, originals[name]);
    else delete globalThis[name];
  }
});
const flush = () => new Promise(resolve => setImmediate(resolve));

test('interview speech uses saved preferences and settles on audio end', async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.voice, 'en-US-BrianNeural');
    assert.equal(body.rate, '+10%');
    assert.equal(body.pitch, '+2Hz');
    return {ok:true, blob:async () => new Blob(['audio'])};
  };
  const playing = playHumanSpeech('Question');
  await flush();
  assert.equal(audioInstances.length, 1);
  audioInstances[0].onended();
  await playing;
});

test('duplicate audio failure events trigger only one browser fallback', async () => {
  globalThis.Audio = class {
    pause(){}
    play(){ const error = this.onerror; error(); error(); return Promise.reject(new Error('autoplay blocked')); }
  };
  const playing = playHumanSpeech('Question');
  await flush();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].rate, 1.1);
  spoken[0].onend();
  await playing;
});

test('cancelling a pending request cannot start fallback speech later', async () => {
  let reject;
  globalThis.fetch = () => new Promise((_resolve, fail) => {reject=fail;});
  const playing = playHumanSpeech('Question');
  stopAnySpeech();
  reject(new Error('aborted'));
  await playing; await flush();
  assert.equal(spoken.length, 0);
  assert.equal(audioInstances.length, 0);
});

test('late microphone results are discarded after a question is submitted', () => {
  let microphone;
  class Recognition { constructor(){microphone=this;} start(){} stop(){} abort(){} }
  const transcripts=[];
  const dictation=createDictation(Recognition, {onTranscript:text=>transcripts.push(text),onEnd(){},onError(){}});
  dictation.start();
  const delayedResult = microphone.onresult;
  const results = [Object.assign([{transcript:'old answer'}], {isFinal:true})];
  delayedResult({resultIndex:0,results});
  assert.deepEqual(transcripts,['old answer']);
  dictation.abort();
  delayedResult({resultIndex:0,results});
  assert.deepEqual(transcripts,['old answer']);
});

test('stopping dictation waits for the final words before completing', async () => {
  let mic;
  class Recognition {
    constructor(){mic=this;}
    start(){this.onstart?.();}
    stop(){queueMicrotask(()=>{this.onresult({resultIndex:0,results:[Object.assign([{transcript:'final words'}],{isFinal:true})]});this.onend();});}
    abort(){}
  }
  const transcript=[];
  const session=createDictation(Recognition,{onTranscript:t=>transcript.push(t),onEnd(){},onError(){assert.fail('unexpected speech error');}});
  session.start(); await session.stop(); assert.deepEqual(transcript,['final words']);
  mic.onresult?.({resultIndex:0,results:[Object.assign([{transcript:'late words'}],{isFinal:true})]});
  assert.deepEqual(transcript,['final words']);
});

test('browser question playback needs no neural service and exposes completion', async () => {
  globalThis.fetch=()=>assert.fail('browser voice must not call the neural service');
  const playing=playHumanSpeech('Practice question',{engine:'browser',language:'en-IN'});
  assert.equal(spoken.length,1); assert.equal(spoken[0].lang,'en-IN');
  spoken[0].onend(); assert.deepEqual(await playing,{status:'ended',source:'browser'});
});

test('review and submit can await the same final speech result without stopping twice', async () => {
  let microphone, stops=0;
  class Recognition {
    constructor(){microphone=this;}
    start(){this.onstart();}
    stop(){if (++stops > 1) throw new Error('Recognition already stopping');}
    abort(){}
  }
  const words=[];
  const session=createDictation(Recognition,{onTranscript:text=>words.push(text),onEnd(){},onError(){assert.fail('unexpected error');}});
  session.start(); const review=session.stop(), submit=session.stop();
  microphone.onresult({resultIndex:0,results:[Object.assign([{transcript:'last words'}],{isFinal:true})]});
  microphone.onend();
  assert.equal((await review).status,'ended'); assert.equal((await submit).status,'ended');
  assert.equal(stops,1); assert.deepEqual(words,['last words']);
});

test('failed question playback is not reported as a completed question', async () => {
  let ended=0;
  const playing=playHumanSpeech('Practice question',{engine:'browser',onEnd:()=>ended++});
  spoken[0].onerror(); assert.equal((await playing).status,'unavailable'); assert.equal(ended,0);
});

test('speech finalization timeout is explicit and discards later words', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let microphone;
  class Recognition {constructor(){microphone=this;} start(){this.onstart();} stop(){} abort(){}}
  const words=[],errors=[];
  const session=createDictation(Recognition,{onTranscript:text=>words.push(text),onEnd(){},onError:code=>errors.push(code)});
  session.start(); const late=microphone.onresult; const stopping=session.stop();
  t.mock.timers.tick(3001);
  assert.equal((await stopping).status,'timeout');
  assert.deepEqual(errors,['finalization-timeout']);
  late({resultIndex:0,results:[Object.assign([{transcript:'late'}],{isFinal:true})]});
  assert.deepEqual(words,[]);
});
