import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {apiRequest,answerInterview} from '../api/auth';
import CodeEditor from '../components/interview/CodeEditor';
import {playHumanSpeech,stopAnySpeech} from '../utils/naturalSpeech';
import {createDictation} from '../utils/dictation';

export default function InterviewPage(){
  const {sessionId}=useParams();const navigate=useNavigate();
  const [session,setSession]=useState(null),[answer,setAnswer]=useState(''),[code,setCode]=useState({code:'',language:'javascript'});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false);
  const recognition=useRef(null),started=useRef(Date.now()),requestId=useRef(null),gate=useRef(false);
  useEffect(()=>{let alive=true;setSession(null);apiRequest(`/interview/${sessionId}`).then(s=>{if(alive)setSession(s);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;recognition.current?.abort();stopAnySpeech();};},[sessionId]);
  const question=session?.current_question;
  useEffect(()=>{recognition.current?.abort();recognition.current=null;setListening(false);stopAnySpeech();started.current=Date.now();setAnswer('');setCode({code:question?.starter_code?.javascript || '',language:'javascript'});requestId.current=null;},[sessionId,question?.id,question?.starter_code?.javascript]);
  function accept(next){if(next.current_question?.id!==question?.id){setAnswer('');}setSession(next);requestId.current=null;if(next.status==='completed')navigate(`/interview/${sessionId}/report`,{replace:true});}
  async function submit(skipped=false){
    if(gate.current)return;gate.current=true;setBusy(true);setError('');recognition.current?.abort();recognition.current=null;setListening(false);stopAnySpeech();
    try{
      requestId.current ||= crypto.randomUUID();
      accept(await answerInterview({session_id:sessionId,question_id:question.id,version:session.version,request_id:requestId.current,answer,...code,skipped,latency_ms:Math.max(0,Math.min(86400000,Date.now()-started.current))}));
    }catch(e){setError(e.message);if(e.status===409){try{setSession(await apiRequest(`/interview/${sessionId}`));requestId.current=null;}catch(reloadError){setError(reloadError.message);}}}
    finally{gate.current=false;setBusy(false);}
  }
  async function finish(){if(gate.current)return;gate.current=true;setBusy(true);recognition.current?.abort();recognition.current=null;setListening(false);stopAnySpeech();try{accept(await apiRequest(`/interview/${sessionId}/complete`,{method:'POST'}));}catch(e){setError(e.message);}finally{gate.current=false;setBusy(false);}}
  function dictate(){
    const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Recognition){setError('Speech recognition is unavailable in this browser. You can type your answer.');return;}
    if(listening){recognition.current?.stop();return;}
    recognition.current?.abort();
    const listener=createDictation(Recognition, {
      onTranscript:text=>setAnswer(a=>`${a} ${text}`.trim()),
      onError:()=>{setListening(false);setError('Microphone input stopped. Check browser permission or type your answer.');},
      onEnd:()=>setListening(false),
    });
    recognition.current=listener;
    try { listener.start(); setListening(true); }
    catch { listener.abort(); recognition.current=null; setListening(false); setError('Microphone input could not start. You can type your answer.'); }
  }
  if(!session)return <main className="mx-auto max-w-3xl p-10 text-gray-900"><Link to="/dashboard">← Dashboard</Link><p role="status" className="mt-6">{error || 'Loading interview…'}</p></main>;
  if(!question)return <main className="p-10 text-gray-900"><Link to={`/interview/${sessionId}/report`}>View completed interview report →</Link></main>;
  const last=session.answers?.at(-1);
  return <div className="min-h-screen bg-[#fbfaff] text-gray-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 p-5"><Link to="/dashboard" className="font-bold text-purple-700">InterviewSpar</Link><span className="text-sm">{session.domain} · {session.mode}</span><button disabled={busy} onClick={finish} className="text-sm text-gray-600 underline">Finish and view report</button></div></header>
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <div className="flex flex-wrap gap-2">{session.rounds.map(round=><span key={round} className={`rounded-full px-3 py-1 text-xs capitalize ${round===session.current_round?'bg-purple-700 text-white':'bg-gray-100 text-gray-600'}`}>{round}</span>)}</div>
      <div><p className="mb-2 text-sm text-gray-500">Question {session.progress.current} of {session.progress.total} · {question.difficulty}</p><progress aria-label="Interview progress" className="h-2 w-full accent-purple-700" value={session.progress.answered} max={session.progress.total}/></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {last && session.mode==='practice' && !last.skipped && <aside className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-sm"><strong>Feedback on your previous answer</strong><p className="mt-1">{last.evaluation.feedback}</p><p className="mt-2 text-xs text-gray-600">Text structure indicator: {last.evaluation.communication_score}/100 (keyword and length cues). Technical correctness: {last.evaluation.correctness_score ?? 'not evaluated'}.</p></aside>}
      <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">{session.current_round}</p>
        <h1 className="text-2xl font-semibold leading-relaxed">{question.prompt}</h1>
        <button type="button" disabled={busy} onClick={()=>playHumanSpeech(question.prompt)} className="text-sm text-purple-700 underline">Read question aloud</button>
        {question.type==='coding' && <CodeEditor key={question.id} question={question} sessionId={sessionId} disabled={busy} onChange={setCode}/>}
        <form onSubmit={e=>{e.preventDefault();submit();}} className="space-y-4">
          <label className="block text-sm font-medium">{question.type==='coding'?'Explain your approach':'Your answer'}<textarea className="mt-2 min-h-44 w-full rounded-xl border border-gray-200 p-4 font-normal focus:ring-2 focus:ring-purple-300" required maxLength={12000} value={answer} disabled={busy} onChange={e=>{setAnswer(e.target.value);requestId.current=null;}}/></label>
          <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={dictate} className="rounded-xl border px-4 py-2 text-sm">{listening?'Stop microphone':'Dictate answer'}</button><button type="button" disabled={busy} onClick={()=>submit(true)} className="px-3 py-2 text-sm text-gray-600 underline">Skip question</button><button disabled={busy || !answer.trim()} className="ml-auto rounded-xl bg-purple-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy?'Saving answer…':'Submit answer'}</button></div>
          <p className="text-xs text-gray-500">Read-aloud sends the question to a speech service. Dictation uses your browser’s speech service. Typed answers are always available. No camera recording is required.</p>
        </form>
      </section>
    </main>
  </div>;
}
