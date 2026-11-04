import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, getMe, startInterview } from '../api/auth';
import DashboardNavbar from '../components/DashboardNavbar';
import UiIcon from '../components/UiIcon';

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
  const field='mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900';
  const rounds = ['Screening', 'Calibration', 'HR', ...(settings.persona==='technical'?['Technical', ...(['HR','Product Management','System Design'].includes(settings.domain)?[]:['Coding'])]:[]), 'Behavioral', 'Reflection'];
  return <div className="min-h-screen bg-[#f8f5ef] text-gray-900">
    <DashboardNavbar name={settings.name}/>
    <main className="mx-auto max-w-6xl px-5 sm:px-8 pb-16 pt-28 page-enter">
      <Link to="/dashboard" className="text-sm text-primary">← Dashboard</Link>
      <p className="section-kicker mt-7">Set up your practice</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Make this session yours.</h1>
      <p className="mt-3 mb-8 text-sm text-gray-600 max-w-xl leading-relaxed">Choose your focus and when you’d like feedback. You can start with what you know; a resume is optional.</p>
      <div className="setup-layout">
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="font-semibold text-lg">A little about your next step</h2>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Your name<input className={field} autoComplete="name" required maxLength={120} value={settings.name} onChange={e=>update('name',e.target.value)}/></label>
        <label className="block text-sm font-medium">Target domain<select className={field} value={settings.domain} onChange={e=>update('domain',e.target.value)}>{domains.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="block text-sm font-medium">Experience<input className={field} maxLength={200} placeholder="For example: student, or 2 years in frontend development" value={settings.experience} onChange={e=>update('experience',e.target.value)}/></label>
        <label className="block text-sm font-medium">Interview track<select className={field} value={settings.persona} onChange={e=>update('persona',e.target.value)}><option value="technical">Technical + behavioral</option><option value="hr">HR + behavioral</option></select></label>
        <label className="block text-sm font-medium">When would you like feedback?<select className={field} value={settings.mode} onChange={e=>update('mode',e.target.value)}><option value="practice">During practice — after each answer</option><option value="assessment">In the final report — when I finish</option></select></label>
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input className="mt-1 size-4 shrink-0" type="checkbox" required checked={settings.save_consent} onChange={e=>update('save_consent',e.target.checked)}/><span><strong className="block text-sm text-gray-900 mb-1">Save my interview for review</strong>I consent to saving my answers and code in my history. I can delete this interview from its report.</span></label>
          <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input className="mt-1 size-4 shrink-0" type="checkbox" checked={settings.allow_ai} onChange={e=>update('allow_ai',e.target.checked)}/><span><strong className="block text-sm text-gray-900 mb-1">Add AI assessment · Optional</strong>Send questions and my answers to the configured AI provider. My resume stays on the server; questions may include details extracted from it.</span></label>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">Without AI assessment, feedback highlights keyword and length cues. Technical correctness is only scored when an evaluator is available.</p>
        <button disabled={busy || !domains.length || !settings.save_consent} className="spar-button w-full">{busy?'Starting…':'Start interview'}<UiIcon name="arrow"/></button>
      </form>
      <aside className="setup-aside">
        <UiIcon name="spark" className="text-primary"/><p className="section-kicker mt-5">What to expect</p>
        <h2>One question.<br/>One step forward.</h2><p className="text-sm text-gray-600 leading-relaxed">Your {settings.persona==='hr'?'HR':'technical'} practice moves through these rounds.</p>
        <ol className="setup-rounds">{rounds.map((round,i)=><li key={round}><span>{i+1}</span>{round}</li>)}</ol>
        <div className="bg-white/70 border border-white p-4 rounded-xl text-xs text-gray-600 leading-relaxed">Each submitted answer is saved. You can return later, or finish early and review your report.</div>
        <p className="flex gap-2 text-xs text-gray-600 mt-5"><UiIcon name="shield"/>Typed answers are always available. Speech is optional.</p>
      </aside>
      </div>
    </main>
  </div>;
}
