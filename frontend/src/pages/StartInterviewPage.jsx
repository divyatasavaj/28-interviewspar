import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, getMe, startInterview } from '../api/auth';
import DashboardNavbar from '../components/DashboardNavbar';

export default function StartInterviewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [domains, setDomains] = useState([]);
  const [settings, setSettings] = useState({name:'', domain:'Software Engineering', experience:'',
    persona:params.get('persona') === 'hr' ? 'hr' : 'technical',mode:'practice',save_consent:false,allow_ai:false});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let alive=true;
    Promise.all([getMe(),apiRequest('/interview/domains')]).then(([user,data]) => {
      if(alive) { setSettings(s=>({...s,name:user.name})); setDomains(data.domains); }
    }).catch(e=>{if(alive)setError(e.message);});
    return ()=>{alive=false;};
  },[]);
  const update=(key,value)=>setSettings(s=>({...s,[key]:value}));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const session=await startInterview(settings); navigate(`/interview/${session.id}`); }
    catch(e){setError(e.message);} finally{setBusy(false);}
  }
  const field='mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 focus:ring-2 focus:ring-purple-300';
  return <div className="min-h-screen bg-[#fbfaff] text-gray-900">
    <DashboardNavbar name={settings.name}/>
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-28">
      <Link to="/dashboard" className="text-sm text-purple-700">← Dashboard</Link>
      <h1 className="mt-5 text-3xl font-bold">Prepare for your next interview</h1>
      <p className="mt-3 text-gray-600">Screening, calibration, HR, role-specific questions, and a final reflection. Your progress is saved after each answer.</p>
      <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Name<input className={field} required maxLength={120} value={settings.name} onChange={e=>update('name',e.target.value)}/></label>
        <label className="block text-sm font-medium">Target domain<select className={field} value={settings.domain} onChange={e=>update('domain',e.target.value)}>{domains.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="block text-sm font-medium">Experience<input className={field} maxLength={200} placeholder="For example: student, 2 years" value={settings.experience} onChange={e=>update('experience',e.target.value)}/></label>
        <label className="block text-sm font-medium">Interview track<select className={field} value={settings.persona} onChange={e=>update('persona',e.target.value)}><option value="technical">Technical + behavioral</option><option value="hr">HR + behavioral</option></select></label>
        <label className="block text-sm font-medium">Mode<select className={field} value={settings.mode} onChange={e=>update('mode',e.target.value)}><option value="practice">Practice — feedback after each answer</option><option value="assessment">Assessment — feedback in the final report</option></select></label>
        <label className="flex items-start gap-3 text-sm text-gray-600"><input className="mt-1" type="checkbox" required checked={settings.save_consent} onChange={e=>update('save_consent',e.target.checked)}/>I consent to saving my answers and code for interview history and reports. I can delete this interview from its report.</label>
        <label className="flex items-start gap-3 text-sm text-gray-600"><input className="mt-1" type="checkbox" checked={settings.allow_ai} onChange={e=>update('allow_ai',e.target.checked)}/>Enable AI assessment by sending interview questions and my answers to the configured AI provider. My resume document stays on the server; questions may include details extracted from it.</label>
        <p className="text-xs text-gray-500">Without AI assessment, feedback highlights keyword and length cues in your answers. Technical correctness is only scored when an evaluator is available.</p>
        <button disabled={busy || !domains.length || !settings.save_consent} className="w-full rounded-xl bg-purple-700 p-3 font-semibold text-white disabled:opacity-50">{busy?'Starting…':'Start interview'}</button>
      </form>
    </main>
  </div>;
}
