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
