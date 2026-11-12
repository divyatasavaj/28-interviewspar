import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, getMe, startInterview } from '../api/auth';
import DashboardNavbar from '../components/DashboardNavbar';
import UiIcon from '../components/UiIcon';

const experienceLevels = {
  intern: 'Student / new graduate',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Staff / lead',
};

export default function StartInterviewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedDomain = params.get('domain');
  const requestedTopic = params.get('topic');
  const requestedCodingTopic = params.get('skill');
  const [codingTopics, setCodingTopics] = useState({});
  const requestedLevel = params.get('level');
  const [topics, setTopics] = useState({});
  const [domains, setDomains] = useState([]);
  const [codingDomains, setCodingDomains] = useState([]);
  const [codingRunnerConfigured, setCodingRunnerConfigured] = useState(false);
  const [settings, setSettings] = useState({name:'', domain:'Software Engineering', experience_level:'mid',
    persona:params.get('persona') === 'hr' ? 'hr' : 'technical',mode:'practice',save_consent:false,allow_ai:false,
    coding_practice:params.get('coding') === '1',coding_only:params.get('track') === 'coding',focus_topic:'',coding_topic:''});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let alive=true;
    Promise.all([getMe(),apiRequest('/interview/domains')]).then(([user,data]) => {
      if(alive) {
        const practiceTopics=data.practice_topics || {};
        const topic=Object.hasOwn(practiceTopics,requestedTopic) ? requestedTopic : '';
        const availableDomains=params.get('track') === 'coding' ? data.coding_domains || [] : data.domains;
        const suggestedDomain=requestedDomain || practiceTopics[topic]?.domain;
        const domain=availableDomains.includes(suggestedDomain) ? suggestedDomain : undefined;
        const level=Object.hasOwn(experienceLevels,requestedLevel) ? requestedLevel : user.experience_level;
        setSettings(s=>({...s,name:user.name,domain:domain || s.domain,focus_topic:topic,
          experience_level:Object.hasOwn(experienceLevels,level) ? level : s.experience_level}));
        setTopics(practiceTopics);
        setCodingTopics(data.coding_topics || {});
        if (domain && data.coding_topics?.[domain]?.includes(requestedCodingTopic)) {
          setSettings(s=>({...s,coding_topic:requestedCodingTopic}));
        }
        setDomains(data.domains);
        setCodingDomains(data.coding_domains || []);
        setCodingRunnerConfigured(data.coding_runner_configured);
      }
    }).catch(e=>{if(alive)setError(e.message);});
    return ()=>{alive=false;};
  },[params,requestedDomain,requestedTopic,requestedLevel,requestedCodingTopic]);
  const update=(key,value)=>setSettings(s=>({...s,[key]:value}));
  const canCode = settings.persona === 'technical' && codingDomains.includes(settings.domain);
  const hasCoding = canCode && (settings.coding_only || (settings.coding_practice && !settings.focus_topic));
  const canFocus = settings.persona === 'technical' && !hasCoding && !['HR','Product Management'].includes(settings.domain);
  const eligibleCodingTopics = codingTopics[settings.domain] || [];
  const codingTopic = settings.coding_only && eligibleCodingTopics.includes(settings.coding_topic) ? settings.coding_topic : '';
  const domainChoices = settings.coding_only ? codingDomains : domains;
  function selectTrack(value) {
    setSettings(current=>({...current,persona:value === 'hr' ? 'hr' : 'technical',coding_only:value === 'coding',
      domain:value === 'coding' && !codingDomains.includes(current.domain) ? 'Software Engineering' : current.domain}));
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const session=await startInterview({...settings,coding_practice:hasCoding,coding_topic:codingTopic || null,focus_topic:canFocus ? settings.focus_topic || null : null,response_mode:'voice'}); navigate(`/interview/${session.id}`); }
    catch(e){setError(e.message);} finally{setBusy(false);}
  }
  const field='mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900';
  return <div className="min-h-screen bg-[#f8f5ef] text-gray-900">
    <DashboardNavbar name={settings.name}/>
    <main className="workspace-page setup-page page-enter">
      <Link to="/dashboard" className="text-sm text-primary">← Dashboard</Link>
      <p className="section-kicker mt-7">Set up your practice</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Set up your interview.</h1>
      <p className="mt-3 mb-8 text-sm text-gray-600 max-w-xl leading-relaxed">Choose your focus and when you’d like feedback. You can start with what you know; a resume is optional.</p>
      <div className="setup-layout">
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
        <fieldset className="form-section"><legend>Interview details</legend><p className="form-help">Choose the role and experience you want to practice.</p><div className="form-field-grid">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Your name<input className={field} autoComplete="name" required maxLength={120} value={settings.name} onChange={e=>update('name',e.target.value)}/></label>
        <label className="block text-sm font-medium">Target domain<select id="interview-domain" className={field} value={settings.domain} onChange={e=>update('domain',e.target.value)}>{domainChoices.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="block text-sm font-medium">Experience level<select id="interview-experience" className={field} value={settings.experience_level} onChange={e=>update('experience_level',e.target.value)}>
          {Object.entries(experienceLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="block text-sm font-medium">Interview track<select id="interview-track" className={field} value={settings.coding_only ? 'coding' : settings.persona} onChange={e=>selectTrack(e.target.value)}><option value="technical">Technical + behavioral</option><option value="hr">HR + behavioral</option><option value="coding">Coding only</option></select></label>
        </div>
        {canFocus && <label className="mt-4 block text-sm font-medium">Practice focus<select id="practice-topic" className={field} value={settings.focus_topic} onChange={e=>update('focus_topic',e.target.value)}>
          <option value="">Full technical interview</option>
          {Object.entries(topics).map(([key,topic])=><option key={key} value={key}>{topic.label} · short session</option>)}
        </select></label>}
        {settings.coding_only && <label className="mt-4 block text-sm font-medium">Coding focus
          <select className={field} value={codingTopic} onChange={event=>update('coding_topic',event.target.value)}>
            <option value="">Mixed skills</option>
            {eligibleCodingTopics.map(id=><option value={id} key={id}>{topics[id]?.label || id}</option>)}
          </select>
        </label>}
        {settings.coding_only && !codingTopic && <p className="mt-4 text-sm text-gray-600">Solve {['intern','junior'].includes(settings.experience_level) ? 'two' : 'three'} exercises, then go straight to your report.</p>}
        {canCode && !settings.coding_only && !settings.focus_topic && <label className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-gray-600">
          <input id="coding-practice" className="mt-1 size-4 shrink-0" type="checkbox" checked={hasCoding} onChange={e=>update('coding_practice',e.target.checked)}/>
          <span><strong className="mb-1 block text-sm text-gray-900">Start with a hands-on coding round</strong>
          Write JavaScript or Python for {['intern','junior'].includes(settings.experience_level) ? 'two' : 'three'} exercises, then continue to spoken questions. Run samples in the editor and get hidden-test results on submission.</span>
        </label>}
        </fieldset><fieldset className="form-section"><legend>Feedback & privacy</legend><label className="block text-sm font-medium">When would you like feedback?<select id="interview-feedback-mode" className={field} value={settings.mode} onChange={e=>update('mode',e.target.value)}><option value="practice">During practice — after each answer</option><option value="assessment">In the final report — when I finish</option></select></label>
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input id="interview-save-consent" className="mt-1 size-4 shrink-0" type="checkbox" required checked={settings.save_consent} onChange={e=>update('save_consent',e.target.checked)}/><span><strong className="block text-sm text-gray-900 mb-1">Save my interview for review</strong>{settings.coding_only ? 'Save my code and coding observations.' : hasCoding ? 'Save my spoken answers, submitted code, delivery observations, and coding camera and tab observations.' : 'Save my spoken answers and delivery observations.'} I can delete the interview from its report.</span></label>
          <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input id="interview-ai-consent" className="mt-1 size-4 shrink-0" type="checkbox" checked={settings.allow_ai} onChange={e=>update('allow_ai',e.target.checked)}/><span><strong className="block text-sm text-gray-900 mb-1">Add AI assessment · Optional</strong>Send questions and my answers{hasCoding ? ', including submitted code,' : ''} to the configured AI provider. Questions may include details extracted from my resume.</span></label>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">Without AI assessment, feedback highlights keyword and length cues. Technical correctness is only scored when an evaluator is available.</p>
        {hasCoding && <p className="text-xs leading-relaxed text-gray-600">Code and test inputs are sent to the configured isolated runner. During coding, the interview samples face presence if your camera is on and tracks tab visibility. Camera frames stay on your device.</p>}
        {hasCoding && !codingRunnerConfigured && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">The test runner needs configuration. You can write and save code, but this session cannot score test cases.</p>}
        </fieldset><button disabled={busy || !domainChoices.length || !domainChoices.includes(settings.domain) || !settings.save_consent} className="spar-button w-full">{busy?'Starting…':'Start interview'}<UiIcon name="arrow"/></button>
      </form>
      <aside className="setup-aside">
        <UiIcon name="spark" className="text-primary"/><p className="section-kicker mt-5">What to expect</p>
        <h2>{settings.coding_only ? 'Coding practice' : canFocus && settings.focus_topic ? topics[settings.focus_topic]?.label : 'Interview practice'}</h2><p className="text-sm text-gray-600 leading-relaxed">{settings.coding_only ? 'Use the editor to run samples and submit your solutions.' : 'Use Chrome or Edge to hear questions and answer aloud.'}</p>
        <div className="bg-white/70 border border-white p-4 rounded-xl text-xs text-gray-600 leading-relaxed">Each submitted answer is saved. You can return later, or finish early and review your report.</div>
        <p className="flex gap-2 text-xs text-gray-600 mt-5"><UiIcon name="shield"/>
          {settings.coding_only ? 'Preview your camera in the next step. Draft code stays in this browser tab until you submit or end the session.'
            : 'Check your camera and microphone before joining. Camera frames stay on your device.'}
        </p>
      </aside>
      </div>
    </main>
  </div>;
}
