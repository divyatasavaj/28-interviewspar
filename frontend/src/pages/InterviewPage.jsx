import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {apiRequest,answerInterview} from '../api/auth';
import CodeEditor from '../components/interview/CodeEditor';
import Brand from '../components/Brand';
import UiIcon from '../components/UiIcon';
import {useInterviewCall} from '../hooks/useInterviewCall';
import CallRoom from '../components/interview/CallRoom';
import InterviewAnalytics from '../components/InterviewAnalytics';

export default function InterviewPage(){
  const {sessionId}=useParams();const navigate=useNavigate();
  const [session,setSession]=useState(null),[answer,setAnswer]=useState(''),[code,setCode]=useState({code:'',language:'javascript'});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const started=useRef(Date.now()),requestId=useRef(null),gate=useRef(false),answerRef=useRef('');
  const question=session?.current_question;
  const updateAnswer=useCallback(value=>{answerRef.current=value.slice(0,12000);setAnswer(answerRef.current);requestId.current=null;},[]);
  const appendTranscript=useCallback(text=>updateAnswer(`${answerRef.current} ${text}`.trim()),[updateAnswer]);
  const call=useInterviewCall(question,appendTranscript);
  useEffect(()=>{let alive=true;setSession(null);apiRequest(`/interview/${sessionId}`).then(s=>{if(alive)setSession(s);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[sessionId]);
  useEffect(()=>{started.current=Date.now();updateAnswer('');setCode({code:question?.starter_code?.javascript || '',language:'javascript'});},[sessionId,question?.id,question?.starter_code?.javascript,updateAnswer]);
  function accept(next){if(next.current_question?.id!==question?.id){setAnswer('');}setSession(next);requestId.current=null;if(next.status==='completed')navigate(`/interview/${sessionId}/report`,{replace:true});}
  async function submit(skipped=false){
    if(gate.current)return;gate.current=true;setBusy(true);setError('');
    try{
      const delivery=await call.finishAnswer();
      requestId.current ||= crypto.randomUUID();
      accept(await answerInterview({session_id:sessionId,question_id:question.id,version:session.version,request_id:requestId.current,answer:answerRef.current,...code,skipped,delivery:skipped?null:delivery,latency_ms:Math.max(0,Math.min(86400000,Date.now()-started.current))}));
    }catch(e){setError(e.message);if(e.status===409){try{setSession(await apiRequest(`/interview/${sessionId}`));requestId.current=null;}catch(reloadError){setError(reloadError.message);}}}
    finally{gate.current=false;setBusy(false);}
  }
  async function finish(){if(gate.current)return;gate.current=true;setBusy(true);call.leave();try{accept(await apiRequest(`/interview/${sessionId}/complete`,{method:'POST'}));}catch(e){setError(e.message);}finally{gate.current=false;setBusy(false);}}
  if(!session)return <main className="mx-auto max-w-3xl p-10 text-gray-900"><Link to="/dashboard">← Dashboard</Link><p role="status" className="mt-6">{error || 'Loading interview…'}</p></main>;
  if(!question)return <main className="p-10 text-gray-900"><Link to={`/interview/${sessionId}/report`}>View completed interview report →</Link></main>;
  const last=session.answers?.at(-1);
  const roundLabel=round=>round==='final'?'Reflection':round==='hr'?'HR':round;
  return <div className="min-h-screen bg-[#f8f5ef] text-gray-900">
    <header className="interview-header"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-5"><Brand to="/dashboard"/><button disabled={busy} onClick={finish} className="text-xs sm:text-sm text-primary font-semibold">Finish and view report →</button></div></header>
    <main className="interview-workspace">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="section-kicker">Space to think. Time to explain.</p><p className="mt-2 text-sm text-gray-600">{session.domain} · {session.mode==='practice'?'Feedback during practice':'Feedback in the final report'}</p></div><div><p className="mb-2 text-xs text-gray-600">Question {session.progress.current} of {session.progress.total} · {question.difficulty}</p><progress aria-label="Interview progress" className="interview-progress" value={session.progress.answered} max={session.progress.total}/></div></div>
      <div className="interview-grid">
        <aside className="interview-rounds" aria-label="Interview rounds"><p className="section-kicker">Your interview</p><ol>{session.rounds.map((round,i)=><li key={round} aria-current={round===session.current_round?'step':undefined}><span>{i<session.rounds.indexOf(session.current_round)?<UiIcon name="check"/>:i+1}</span>{roundLabel(round)}</li>)}</ol></aside>
        <div className="min-w-0 space-y-5">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <CallRoom call={call} interviewType={session.interview_type} questionPrompt={question.prompt} busy={busy}/>
          <section className="interview-question space-y-5">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold capitalize text-primary bg-sky-50 px-3 py-1.5 rounded-lg">{roundLabel(session.current_round)}</p><span className="text-[11px] text-gray-500">Take a moment. You have time.</span></div>
            <h1 key={`prompt-${question.id}`} className="text-2xl sm:text-3xl font-semibold leading-relaxed tracking-tight page-enter">{question.prompt}</h1>
            <button type="button" disabled={busy} onClick={()=>call.speak(call.enabled)} className="flex items-center gap-2 text-sm text-primary"><UiIcon name="sound"/>Read question aloud</button>
            {question.type==='coding' && <CodeEditor key={`code-${question.id}`} question={question} sessionId={sessionId} disabled={busy} onChange={setCode}/>}
            <form onSubmit={e=>{e.preventDefault();submit();}} className="space-y-4 pt-2">
              <label className="block text-sm font-medium">{question.type==='coding'?'Explain your approach':'Your answer'}<textarea className="mt-3 min-h-52 w-full rounded-xl border border-gray-200 bg-gray-50/40 p-4 font-normal leading-relaxed text-sm" placeholder="Start with what you know. Add an example when it helps." required={call.status!=='listening'} maxLength={12000} value={answer} disabled={busy} onChange={e=>updateAnswer(e.target.value)}/></label>
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-gray-600">Review your typed or spoken answer before submitting.</span><span className="text-[11px] text-gray-500">{answer.length.toLocaleString()} / 12,000</span></div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5"><button type="button" disabled={busy} onClick={()=>submit(true)} className="px-2 py-2 text-xs sm:text-sm text-gray-600">Skip question</button><button disabled={busy || (!answer.trim() && call.status!=='listening')} className="spar-button text-sm">{busy?'Saving answer…':'Submit answer'}<UiIcon name="arrow"/></button></div>
            </form>
          </section>
          {last && session.mode==='practice' && !last.skipped && <aside className="interview-feedback" aria-live="polite"><strong className="text-sm">Feedback on your previous answer</strong><p className="mt-2 text-sm text-gray-700 leading-relaxed">{last.evaluation.feedback}</p><p className="mt-3 text-xs text-gray-600 leading-relaxed">Text structure indicator: {last.evaluation.communication_score}/100 (keyword and length cues). Technical correctness: {last.evaluation.correctness_score ?? 'not evaluated'}.</p></aside>}
          {last && session.mode==='practice' && !last.skipped && <InterviewAnalytics delivery={last.evaluation.delivery}/>}
          <p className="text-[11px] text-gray-500 leading-relaxed flex gap-2"><UiIcon name="shield"/>Dictation uses your browser’s speech service. Camera frames stay on this device. Review recognized words before submitting.</p>
        </div>
      </div>
    </main>
  </div>;
}
