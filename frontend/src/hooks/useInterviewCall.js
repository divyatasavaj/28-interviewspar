import {useCallback, useEffect, useRef, useState} from 'react';
import {createDictation} from '../utils/dictation';
import {createAudioMeter} from '../utils/audioMeter';
import {playHumanSpeech, stopAnySpeech} from '../utils/naturalSpeech';
import {cameraObservation,VisibilityActivity} from '../utils/deliveryMetrics';

const audioTotal = rows => rows.length ? rows.reduce((total,row) => {
  for (const key of Object.keys(row)) total[key] = key === 'longest_pause_ms' ? Math.max(total[key] || 0,row[key]) : (total[key] || 0) + row[key];
  return total;
}, {}) : null;

/** Own one turn at a time; stale media callbacks cannot change the next answer. */
export function useInterviewCall(question, onTranscript) {
  const [enabled,setEnabled] = useState(false), [status,setStatus] = useState('idle'), [error,setError] = useState('');
  const [interim,setInterim] = useState(''), [audio,setAudio] = useState(null), [voiceText,setVoiceText] = useState('');
  const [camera,setCamera] = useState(null), [focus,setFocus] = useState({observed_ms:0, hidden_ms:0, hidden_count:0});
  const [language,setLanguage] = useState('en-IN'), [engine,setEngine] = useState('browser');
  const active = useRef(false), phase = useRef('idle'), generation = useRef(0), microphone = useRef(null), meter = useRef(null);
  const incomplete = useRef(false);
  const records = useRef([]), recognized = useRef(''), cameraData = useRef(null), focusData = useRef(new VisibilityActivity());
  const append = useRef(onTranscript), prompt = useRef(question), options = useRef({language,engine});
  append.current = onTranscript; prompt.current = question; options.current = {language,engine};
  const changePhase = useCallback(value => {
    focusData.current.setRunning(value === 'listening',performance.now(),document.hidden);
    phase.current = value; setStatus(value);
  }, []);
  const finishMeter = useCallback(() => {
    if (meter.current) {
      const capture = meter.current; meter.current = null;
      const result = capture.stop();
      if (result.observed_ms > 0) records.current.push(result);
    }
    setAudio(audioTotal(records.current));
  }, []);
  const cancel = useCallback(() => {
    generation.current++; microphone.current?.abort(); microphone.current = null;
    if (meter.current) { meter.current.stop(); meter.current = null; }
    stopAnySpeech();
  }, []);
  const stopListening = useCallback(async () => {
    const current = microphone.current;
    const ticket = generation.current;
    changePhase(current ? 'finalizing' : 'review');
    finishMeter();
    const result = current ? await current.stop() : {status:'ended'};
    if (microphone.current === current) microphone.current = null;
    if (generation.current === ticket) changePhase('review');
    return result;
  }, [changePhase, finishMeter]);
  const listen = useCallback(async () => {
    if (!active.current || ['listening','preparing','finalizing'].includes(phase.current)) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError('Speech recognition is unavailable in this browser. Open this interview in Chrome or Edge to continue.'); changePhase('review'); return; }
    const ticket = ++generation.current;
    stopAnySpeech(); setError(''); setInterim(''); changePhase('preparing');
    const capture = createAudioMeter(value => {
      if (generation.current === ticket) setAudio(audioTotal([...records.current,value]));
    }, () => {
      if (generation.current === ticket) {
        incomplete.current = true;
        setError('Microphone disconnected. Reconnect it, then start the microphone again or send the transcript you have.');
        void stopListening();
      }
    });
    meter.current = capture;
    try {
      if (!await capture.start() || generation.current !== ticket) return;
      const recognition = createDictation(Recognition, {
        language:options.current.language,
        onStart:() => { if (generation.current === ticket) changePhase('listening'); },
        onTranscript:text => {
          if (generation.current !== ticket) return;
          const combined = `${recognized.current} ${text}`.trim();
          if (combined.length > 12000) { incomplete.current = true; setError('Transcript limit reached. Review your answer before submitting.'); void stopListening(); }
          recognized.current = combined.slice(0,12000);
          setVoiceText(recognized.current); append.current(text);
        },
        onInterim:text => { if (generation.current === ticket) setInterim(text); },
        onError:code => {
          if (generation.current !== ticket) return;
          // A recognition failure may omit spoken words even when the meter worked.
          incomplete.current = true;
          microphone.current?.abort(); microphone.current = null;
          setError(code === 'no-speech' ? 'No speech recognized. Check your microphone, then start it again.'
            : code === 'finalization-timeout' ? 'Final speech could not be confirmed. Check the transcript or record again.'
              : 'Speech recognition stopped. Check your microphone and internet connection, then try recording again.');
          finishMeter(); changePhase('review');
        },
        onEnd:() => { if (generation.current === ticket) { microphone.current = null; finishMeter(); changePhase('review'); } },
      });
      microphone.current = recognition; recognition.start();
    } catch (error) {
      if (generation.current === ticket) {
        microphone.current?.abort(); microphone.current = null; finishMeter(); changePhase('review');
        setError(error.name === 'NotAllowedError'
          ? 'Microphone unavailable. Allow microphone access in your browser’s site settings, then start the microphone again.'
          : 'Microphone unavailable. Connect a microphone and check system access, then start it again.');
      }
    }
  }, [changePhase, finishMeter, stopListening]);
  const speak = useCallback(async (autoListen = false) => {
    if (!prompt.current) return;
    const beforeStop = generation.current;
    const stopped = await stopListening();
    if (stopped.status !== 'ended' || generation.current !== beforeStop) return;
    const ticket = ++generation.current;
    setError(''); changePhase('loading-question');
    const result = await playHumanSpeech(prompt.current.prompt, {...options.current,
      onStart:() => { if (generation.current === ticket) changePhase('speaking'); }});
    if (generation.current !== ticket) return;
    if (result.status === 'ended' && autoListen && active.current) await listen();
    else {
      changePhase('review');
      if (result.status === 'unavailable') setError('Question audio is unavailable. Read the question and start the microphone when you’re ready.');
    }
  }, [changePhase, listen, stopListening]);
  const join = useCallback(() => { active.current = true; setEnabled(true); void speak(true); }, [speak]);
  const leave = useCallback(() => {
    if (microphone.current) incomplete.current = true;
    active.current = false; setEnabled(false); finishMeter(); cancel(); changePhase('review'); setInterim('');
  }, [cancel, changePhase, finishMeter]);
  useEffect(() => {
    cancel(); records.current = []; recognized.current = ''; cameraData.current = null; incomplete.current = false;
    focusData.current = new VisibilityActivity();
    setVoiceText(''); setAudio(null); setCamera(null); setFocus({...focusData.current.data}); setInterim(''); setError(''); changePhase('idle');
    if (active.current && prompt.current) void speak(true);
    return cancel;
  }, [question?.id, cancel, changePhase, speak]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (phase.current === 'listening') setFocus(focusData.current.tick(performance.now()));
    }, 500);
    const hidden = () => { focusData.current.visibility(document.hidden,performance.now()); };
    document.addEventListener('visibilitychange',hidden);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange',hidden); };
  }, []);
  useEffect(() => {
    if (status !== 'listening') return;
    const timeout = setTimeout(() => { setError('Recording stopped after ten minutes. Review and submit this answer.'); void stopListening(); }, 600000);
    return () => clearTimeout(timeout);
  }, [status,stopListening]);
  const observeFaces = useCallback((faces,width,height) => {
    if (!active.current || phase.current !== 'listening') return;
    const observation = cameraObservation(faces,width,height);
    if (!observation) return;
    const c = cameraData.current ||= {samples:0, face_samples:0, centered_samples:0, multiple_samples:0};
    c.samples++; c.face_samples += Number(observation.face); c.centered_samples += Number(observation.centered); c.multiple_samples += Number(observation.multiple);
    setCamera({...c});
  }, []);
  const retryAnswer = useCallback(() => {
    cancel(); records.current = []; recognized.current = ''; cameraData.current = null; incomplete.current = false;
    focusData.current = new VisibilityActivity();
    setVoiceText(''); setInterim(''); setAudio(null); setCamera(null); setFocus({...focusData.current.data});
    changePhase('review'); void listen();
  }, [cancel,changePhase,listen]);
  async function finishAnswer() {
    const stopped = await stopListening();
    if (stopped.status === 'timeout') throw new Error('Final speech could not be confirmed. Review the transcript, then submit again.');
    generation.current++; stopAnySpeech();
    if (!recognized.current && !records.current.length && !cameraData.current) return null;
    return {consent:true, transcript:recognized.current, transcript_complete:!incomplete.current, language, audio:audioTotal(records.current), camera:cameraData.current,
      focus:focusData.current.data.observed_ms ? {...focusData.current.data} : null};
  }
  return {enabled,status,error,interim,audio,voiceText,camera,focus,language,setLanguage,engine,setEngine,
    join,leave,speak,listen,retryAnswer,stopListening,finishAnswer,observeFaces};
}
