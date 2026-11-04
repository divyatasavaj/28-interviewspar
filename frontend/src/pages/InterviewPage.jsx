import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {apiRequest,answerInterview} from '../api/auth';
import {useInterviewCall} from '../hooks/useInterviewCall';
import CallRoom from '../components/interview/CallRoom';

export default function InterviewPage(){
  const {sessionId}=useParams(); const navigate=useNavigate();
  const [session,setSession]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const started=useRef(Date.now()),requestId=useRef(null),gate=useRef(false);
  const question=session?.current_question;
  const call=useInterviewCall(question,()=>{requestId.current=null;});
  useEffect(()=>{
    let alive=true; setSession(null);
    apiRequest(`/interview/${sessionId}/voice`,{method:'POST'}).then(s=>{if(alive)setSession(s);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[sessionId]);
  useEffect(()=>{started.current=Date.now();requestId.current=null;},[sessionId,question?.id]);
  function accept(next){setSession(next);requestId.current=null;if(next.status==='completed')navigate(`/interview/${sessionId}/report`,{replace:true});}
  async function submit(skipped=false){
    if(gate.current)return; gate.current=true; setBusy(true); setError('');
    try{
      const delivery=await call.finishAnswer();
      if(!skipped && !delivery?.transcript?.trim())throw new Error('No spoken answer was captured. Check your microphone and speak again.');
      requestId.current ||= crypto.randomUUID();
      accept(await answerInterview({session_id:sessionId,question_id:question.id,version:session.version,request_id:requestId.current,
        answer:skipped?'':delivery.transcript,skipped,delivery:skipped?null:delivery,
        latency_ms:Math.max(0,Math.min(86400000,Date.now()-started.current))}));
    }catch(e){setError(e.message);if(e.status===409){try{setSession(await apiRequest(`/interview/${sessionId}`));requestId.current=null;}catch(reloadError){setError(reloadError.message);}}}
    finally{gate.current=false;setBusy(false);}
  }
  async function finish(){
    if(gate.current)return;gate.current=true;setBusy(true);call.leave();
    try{accept(await apiRequest(`/interview/${sessionId}/complete`,{method:'POST'}));}
    catch(e){setError(e.message);}finally{gate.current=false;setBusy(false);}
  }
  if(!session)return <main className="call-loading"><Link to="/dashboard">← Dashboard</Link><p role="status">{error || 'Preparing your interview call…'}</p></main>;
  if(!question)return <main className="call-loading"><Link to={`/interview/${sessionId}/report`}>View completed interview report →</Link></main>;
  const last=session.answers?.at(-1);
  return <CallRoom call={call} questionPrompt={question.prompt} busy={busy} error={error}
    progress={session.progress} onSubmit={()=>submit()} onSkip={()=>submit(true)} onFinish={finish}
    feedback={session.mode==='practice' && last && !last.skipped ? last.evaluation : null}/>;
}
