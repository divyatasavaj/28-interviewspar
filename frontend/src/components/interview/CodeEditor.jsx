import { useState } from 'react';
import { apiRequest } from '../../api/auth';

export default function CodeEditor({question,sessionId,onChange,disabled=false}) {
  const [language,setLanguage]=useState('javascript');
  const [code,setCode]=useState(question.starter_code?.javascript || '');
  const [output,setOutput]=useState(null);
  const [running,setRunning]=useState(false);
  function change(value,lang=language){setCode(value);setOutput(null);onChange({code:value,language:lang});}
  async function run(){
    setRunning(true);setOutput(null);
    try {setOutput(await apiRequest('/code/run',{method:'POST',body:JSON.stringify({session_id:sessionId,problem_id:question.problem_id,code,language})}));}
    catch(e){setOutput({message:e.message});}finally{setRunning(false);}
  }
  return <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
    <label className="block text-sm font-medium">Code language <select className="ml-3 rounded border p-2" value={language} disabled={running || disabled} onChange={e=>{setLanguage(e.target.value);change(question.starter_code?.[e.target.value] || '',e.target.value);}}><option value="javascript">JavaScript</option><option value="python">Python</option></select></label>
    <label className="block text-sm font-medium">Your code<textarea aria-label="Your code" className="mt-2 min-h-64 w-full rounded-xl bg-gray-950 p-4 font-mono text-sm text-gray-100" spellCheck={false} disabled={running || disabled} value={code} onChange={e=>change(e.target.value)} /></label>
    <button type="button" disabled={running || disabled || !code.trim()} onClick={run} className="rounded-lg border border-sky-300 px-4 py-2 text-sm text-sky-800 disabled:opacity-50">{running?'Running isolated tests…':'Run tests'}</button>
    {output && <div role="status" className="rounded-lg bg-white p-3 text-sm">{output.status==='evaluated'?`${output.passed}/${output.total} tests passed. Submitting your answer reruns the tests.`:output.message || 'Execution unavailable.'}</div>}
  </section>;
}
