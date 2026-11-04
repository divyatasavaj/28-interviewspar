import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {apiRequest,getInterviewFeedback} from '../api/auth';
import Brand from '../components/Brand';
import UiIcon from '../components/UiIcon';
import InterviewAnalytics from '../components/InterviewAnalytics';
export default function InterviewReportPage(){
  const params=useParams(),[query]=useSearchParams();const sessionId=params.sessionId || query.get('session_id');
  const [report,setReport]=useState(null),[error,setError]=useState(''),[deleting,setDeleting]=useState(false);
  const navigate=useNavigate();
  const printDetails=useRef([]);
  useEffect(()=>{
    const before=()=>{printDetails.current=[...document.querySelectorAll('.measurement-details:not([open])')];printDetails.current.forEach(detail=>{detail.open=true;});};
    const after=()=>{printDetails.current.forEach(detail=>{detail.open=false;});printDetails.current=[];};
    window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
    return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);};
  },[]);
  useEffect(()=>{let alive=true;if(!sessionId){setError('No interview selected.');return;}getInterviewFeedback(sessionId).then(r=>{if(alive)setReport(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[sessionId]);
  async function remove(){setDeleting(true);try{await apiRequest(`/interview/${sessionId}`,{method:'DELETE'});navigate('/dashboard');}catch(e){setError(e.message);}finally{setDeleting(false);}}
  const scored=Number.isFinite(report?.overall_score);
  const roundLabel=round=>round==='final'?'Reflection':round==='hr'?'HR':round;
  return <main className="report-page mx-auto min-h-screen max-w-6xl space-y-7 px-5 sm:px-8 py-8 sm:py-10 text-gray-900 page-enter">
    <nav className="flex items-center justify-between gap-4 print:hidden"><Brand to="/dashboard"/><Link to="/dashboard" className="text-primary text-sm">← Dashboard</Link></nav>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!report ? <p role="status">{error?'Report unavailable.':'Loading report…'}</p> : <>
      <div className="flex flex-wrap items-start justify-between gap-5 pt-4"><div><p className="section-kicker">Your practice, in perspective</p><h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Your interview feedback</h1><p className="mt-3 text-sm text-gray-600">Find one thing to take into your next answer.</p></div><button onClick={()=>window.print()} className="spar-button secondary print:hidden"><UiIcon name="download"/>Print / Save PDF</button></div>
      <p className="text-sm text-gray-600">Answered {report.answered} of {report.total}; skipped {report.skipped}. {report.status==='active' && <Link className="text-primary underline" to={`/interview/${sessionId}`}>Continue interview</Link>}</p>
      <nav className="page-tabs print:hidden" aria-label="Report sections"><a href="#report-overview">Overview</a>{report.delivery_summary && <a href="#report-delivery">Speaking & presence</a>}<a href="#report-rounds">Round details</a><a href="#report-answers">Your answers</a></nav><div id="report-overview" className="report-grid">
        <section className="report-score"><div className="report-score-ring" style={{'--score':scored?Math.max(0,Math.min(100,report.overall_score)):0}} aria-hidden="true"><div><strong>{scored?report.overall_score:'—'}</strong><small>{scored?'out of 100':'Not scored'}</small></div></div><div className="min-w-0"><h2 className="text-lg font-semibold leading-snug">{report.score_label}</h2><p className="sr-only print:not-sr-only print:mt-2 print:font-semibold">{scored?`${report.overall_score}/100`:'Not scored'}</p><p className="mt-3 text-xs text-gray-600 leading-relaxed">{report.score_note}</p></div></section>
        <aside className="report-next"><p className="section-kicker">Try this next</p><h2>One example.<br/>A little more clarity.</h2><p className="text-sm text-gray-600 leading-relaxed">Choose an answer to revisit. Explain the situation, your own decision, and what you observed afterward.</p></aside>
      </div>
      <div id="report-delivery"><InterviewAnalytics delivery={report.delivery_summary} summary/></div>
      <section id="report-rounds" className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-7"><h2 className="text-xl font-bold mb-5">Round by round</h2><div className="overflow-x-auto"><table className="report-table"><thead><tr><th scope="col">Round</th><th scope="col">Text structure / 100</th><th scope="col">Technical correctness / 100</th><th scope="col">Answered</th></tr></thead><tbody>{Object.entries(report.round_scores).map(([round,row])=><tr key={round}><th scope="row" className="capitalize font-medium bg-transparent! text-gray-900!">{roundLabel(round)}</th><td>{Number.isFinite(row.communication_score) && <span className="report-bar" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,row.communication_score))}%`}}/></span>}{row.communication_score ?? 'Not scored'}</td><td>{row.correctness_score ?? 'Not evaluated'}</td><td>{row.answered}/{row.total}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-gray-500">Text structure describes keyword and length cues. It does not measure hiring readiness or verify technical ability.</p></section>
      <section id="report-answers" className="space-y-5"><div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-xl font-bold">Question-by-question review</h2><span className="text-xs text-gray-500">Your answers, in context</span></div>{report.qa_pairs.length===0 && <p className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">No answers were submitted in this session. Start a new interview whenever you’re ready.</p>}{report.qa_pairs.map((row,i)=><article key={row.question_id} className="report-qa break-inside-avoid rounded-2xl border border-gray-100 bg-white p-5 sm:p-7"><p className="section-kicker mb-3">Question {String(i+1).padStart(2,'0')}</p><h3 className="font-semibold leading-relaxed">{row.question}</h3><div className="report-answer-text"><span>Your answer</span><p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{row.skipped?'Skipped':row.answer}</p></div>{row.code && <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-xs">{row.code}</pre>}{!row.skipped && <div className="mt-5 rounded-xl bg-sky-50 p-4"><p className="text-sm text-sky-900 leading-relaxed">{row.evaluation.feedback}</p><p className="mt-3 text-xs text-gray-600">Evaluation: {row.evaluation.source}. {row.evaluation.code_result?.message}</p>{row.evaluation.mistake_tag?.label && <p className="mt-2 text-xs text-gray-600">Coaching signal: {row.evaluation.mistake_tag.label} ({row.evaluation.mistake_tag.source}). This is an experimental signal.</p>}</div>}{!row.skipped && <InterviewAnalytics delivery={row.evaluation.delivery}/>}</article>)}</section>
      <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-gray-200 pt-7 print:hidden"><Link to="/interview/start" className="spar-button">Practice again<UiIcon name="arrow"/></Link><button disabled={deleting} onClick={remove} className="text-xs text-red-700 underline">{deleting?'Deleting…':'Delete this interview and its answers'}</button></footer>
    </>}
  </main>;
}
