import test from 'node:test';
import assert from 'node:assert/strict';
import {SpeechActivity,transcriptSignals,cameraObservation,VisibilityActivity} from '../src/utils/deliveryMetrics.js';
import {createAudioMeter} from '../src/utils/audioMeter.js';

function feed(activity, seconds, rms) { for(let i=0;i<seconds*20;i++) activity.sample(rms,rms,50); }
test('audio observations distinguish internal pauses from leading/trailing silence',()=>{
  const a=new SpeechActivity(); feed(a,1,0); feed(a,2,.1); feed(a,1,0); feed(a,2,.1); feed(a,3,0);
  const s=a.snapshot();
  assert.equal(s.observed_ms,9000); assert.equal(s.voiced_ms,4000); assert.equal(s.speech_span_ms,5000);
  assert.equal(s.pause_count,1); assert.equal(s.pause_ms,1000); assert.equal(s.longest_pause_ms,1000);
});
test('silence is not a speaking pace and browser suspension is missing coverage',()=>{
  const a=new SpeechActivity(); feed(a,2,0); a.sample(0,0,5000);
  assert.equal(a.snapshot().observed_ms,2000); assert.equal(a.snapshot().speech_span_ms,0); assert.equal(a.snapshot().pause_count,0);
});
test('potentially meaningful words are separate from filler expressions',()=>{
  const s=transcriptSignals('Um I mean I like SQL, and well designed APIs. UH you know.');
  assert.equal(s.filler_count,4); assert.equal(s.possible_filler_count,2);
  assert.equal(transcriptSignals('umbrella human earth').filler_count,0);
});
test('camera unavailable differs from no face; multiple faces cannot count as centered',()=>{
  assert.equal(cameraObservation([],0,0),null);
  assert.deepEqual(cameraObservation([],640,480),{face:false,centered:false,multiple:false});
  const face={box:{x:220,y:100,width:200,height:240}};
  assert.deepEqual(cameraObservation([face],640,480),{face:true,centered:true,multiple:false});
  assert.deepEqual(cameraObservation([face,face],640,480),{face:true,centered:false,multiple:true});
});
test('a cancelled microphone permission request releases a late stream',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let grant,stops=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>{grant=r;})}}});
  try {
    const meter=createAudioMeter(()=>assert.fail('cancelled capture must not emit metrics'));
    const pending=meter.start(); meter.stop(); grant({getTracks:()=>[{stop(){stops++;}}]});
    assert.equal(await pending,false); assert.equal(stops,1);
  } finally { if(original) Object.defineProperty(globalThis,'navigator',original); else delete globalThis.navigator; }
});

test('tab visibility includes throttled hidden time and excludes review time',()=>{
  const a=new VisibilityActivity();
  a.setRunning(true,0,false); a.visibility(true,2000); a.visibility(false,12000); a.setRunning(false,15000,false);
  assert.deepEqual(a.tick(30000),{observed_ms:15000,hidden_ms:10000,hidden_count:1});
});
