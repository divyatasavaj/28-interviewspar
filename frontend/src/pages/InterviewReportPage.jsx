import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {apiRequest,getInterviewFeedback} from '../api/auth';
export default function InterviewReportPage(){
  const params=useParams(),[query]=useSearchParams();const sessionId=params.sessionId || query.get('session_id');
  const [report,setReport]=useState(null),[error,setError]=useState(''),[deleting,setDeleting]=useState(false);
  const navigate=useNavigate();
  useEffect(()=>{let alive=true;if(!sessionId){setError('No interview selected.');return;}getInterviewFeedback(sessionId).then(r=>{if(alive)setReport(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[sessionId]);
  async function remove(){setDeleting(true);try{await apiRequest(`/interview/${sessionId}`,{method:'DELETE'});navigate('/dashboard');}catch(e){setError(e.message);}finally{setDeleting(false);}}
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 bg-white px-5 py-10 text-gray-900">
    <nav className="print:hidden"><Link to="/dashboard" className="text-purple-700">← Dashboard</Link></nav>
    {error && <p role="alert" className="bg-red-50 p-4 text-red-700">{error}</p>}
    {!report ? <p>{error?'Report unavailable.':'Loading report…'}</p> : <>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-purple-700">InterviewSpar practice report</p><h1 className="mt-2 text-3xl font-bold">Your interview feedback</h1></div><button onClick={()=>window.print()} className="rounded-xl bg-purple-700 px-5 py-3 text-white print:hidden">Print / Save PDF</button></div>
      <section className="rounded-2xl bg-purple-50 p-6"><h2 className="text-lg font-semibold">{report.score_label}</h2><p className="my-3 text-4xl font-bold">{report.overall_score === null?'Not scored':`${report.overall_score}/100`}</p><p className="text-sm text-gray-600">{report.score_note}</p><p className="mt-3 text-sm">Answered {report.answered} of {report.total}; skipped {report.skipped}. {report.status==='active' && <Link className="text-purple-700 underline" to={`/interview/${sessionId}`}>Continue interview</Link>}</p></section>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Round</th><th>Communication</th><th>Technical correctness</th><th>Answered</th></tr></thead><tbody>{Object.entries(report.round_scores).map(([round,row])=><tr className="border-b" key={round}><td className="p-3 capitalize">{round}</td><td>{row.communication_score ?? 'Not scored'}</td><td>{row.correctness_score ?? 'Not evaluated'}</td><td>{row.answered}/{row.total}</td></tr>)}</tbody></table></div>
      <section className="space-y-5"><h2 className="text-xl font-bold">Question-by-question review</h2>{report.qa_pairs.map((row,i)=><article key={row.question_id} className="break-inside-avoid rounded-2xl border border-gray-200 p-5"><h3 className="font-semibold">{i+1}. {row.question}</h3><p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{row.skipped?'Skipped':row.answer}</p>{row.code && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{row.code}</pre>}{!row.skipped && <><p className="mt-4 text-sm text-purple-800">{row.evaluation.feedback}</p><p className="mt-2 text-xs text-gray-500">Evaluation: {row.evaluation.source}. {row.evaluation.code_result?.message}</p>{row.evaluation.mistake_tag?.label && <p className="mt-1 text-xs text-gray-500">Coaching signal: {row.evaluation.mistake_tag.label} ({row.evaluation.mistake_tag.source}). This is an experimental signal.</p>}</>}</article>)}</section>
      <footer className="flex flex-wrap items-center gap-4 border-t pt-6 print:hidden"><Link to="/interview/start" className="rounded-xl bg-purple-700 px-5 py-3 text-white">Practice again</Link><button disabled={deleting} onClick={remove} className="text-sm text-red-700 underline">{deleting?'Deleting…':'Delete this interview and its answers'}</button></footer>
    </>}
  </main>;
}
