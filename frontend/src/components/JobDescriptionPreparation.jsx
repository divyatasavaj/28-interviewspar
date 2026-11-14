import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, savePreparationPlan } from '../api/auth';
import { localDate } from '../utils/practice';

const topicLink = (id, topic) => '/interview/start?' + new URLSearchParams({domain: topic.domain, topic: id});

export default function JobDescriptionPreparation({ plan, domains, onSaved }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState({});
  const [draft, setDraft] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [uncovered, setUncovered] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState({target_role: '', domain: 'Software Engineering', interview_date: '', sessions_per_week: 3});
  const savedJobPlan = Boolean(plan?.topic_ids?.length);
  const selected = draft?.topic_ids || (savedJobPlan ? plan.topic_ids : []);

  useEffect(() => {
    let active = true;
    apiRequest('/preparation/topics').then(result => { if (active) { setTopics(result.topics); setError(''); } })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);

  function editSaved() {
    setDraft(structuredClone(plan));
    setForm({target_role: plan.target_role, domain: plan.domain, interview_date: plan.interview_date, sessions_per_week: plan.sessions_per_week});
    setOpen(true); setError(''); setStatus(''); setSuggestions([]); setUncovered([]);
  }

  async function generate(event) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      const result = await apiRequest('/preparation/job-description', {method: 'POST', body: JSON.stringify({
        ...form, start_date: localDate(), job_description: description,
      })});
      setDraft(result.plan); setSuggestions(result.suggestions); setUncovered(result.uncovered_skills);
      setStatus('Draft ready. Review the topics and edit your sessions before saving.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function toggleTopic(id) {
    setDraft(current => {
      const removing = current.topic_ids.includes(id);
      return {...current, topic_ids: removing ? current.topic_ids.filter(key => key !== id) : [...current.topic_ids, id],
        tasks: removing ? current.tasks.filter(task => task.topic !== id) : [...current.tasks, {
          id: crypto.randomUUID(), date: current.start_date, title: `Practice ${topics[id].label}`,
          track: 'technical', topic: id, minutes: 25,
        }]};
    });
  }

  function updateTask(id, updates) {
    setDraft(current => ({...current, tasks: current.tasks.map(task => task.id === id ? {...task, ...updates} : task)}));
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('');
    try {
      const result = await savePreparationPlan({...draft, ...form});
      onSaved(result); setDraft(null); setOpen(false); setDescription('');
      setStatus('Job preparation plan saved. Open a session from your schedule to start practicing.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <section className="preparation-card job-preparation" aria-labelledby="job-preparation-title">
    <div className="section-actions">
      <div><span className="section-kicker">Prepare for a specific opportunity</span><h2 id="job-preparation-title">Job-description preparation</h2></div>
      {!open && <button className="spar-button secondary" onClick={() => { setOpen(true); setStatus(''); }}>Paste a job description</button>}
      {savedJobPlan && !open && <button className="spar-button secondary" onClick={editSaved}>Edit job plan</button>}
      {open && <button disabled={busy} onClick={() => { setOpen(false); setDraft(null); setError(''); setStatus(''); }}>Cancel changes</button>}
    </div>
    <p>Turn the role’s requirements into focused topics, practice questions, and a schedule you can change.</p>
    {error && <p role="alert" className="inline-error">{error} {!Object.keys(topics).length && <button onClick={() => setRevision(value => value + 1)}>Retry topics</button>}</p>}
    {status && <p role="status" className="save-confirmation">{status}</p>}
    {open && <form onSubmit={generate} className="plan-form">
      <label>Role you’re preparing for<input required maxLength={120} value={form.target_role} onChange={event => setForm({...form, target_role:event.target.value})} placeholder="e.g. Frontend engineer" disabled={busy}/></label>
      <label>Job practice domain<select value={form.domain} onChange={event => setForm({...form, domain:event.target.value})} disabled={busy}>{domains.map(domain => <option key={domain}>{domain}</option>)}</select></label>
      <label>Target interview date<input required type="date" min={draft?.start_date || localDate()} value={form.interview_date} onChange={event => setForm({...form, interview_date:event.target.value})} disabled={busy}/></label>
      <label>Suggested sessions per week<select value={form.sessions_per_week} onChange={event => setForm({...form, sessions_per_week:Number(event.target.value)})} disabled={busy}>{[1,2,3,4,5,6,7].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="job-description-field">Job description<textarea required minLength={40} maxLength={20000} rows={6} value={description} onChange={event => setDescription(event.target.value)} placeholder="Paste the responsibilities, required skills, and preferred qualifications…" disabled={busy} aria-describedby="job-description-note"/></label>
      <p id="job-description-note">Your pasted text is used to match our skill catalog and is not stored or sent to an AI provider. Only the plan you save is kept in your account. Suggestions are practice material, not a prediction of the employer’s questions.</p>
      <button className="spar-button" disabled={busy || !domains.length || !Object.keys(topics).length}>{busy ? 'Working…' : draft ? 'Generate a new draft' : 'Suggest topics and plan'}</button>
      {draft && <p>Generating again replaces the unsaved draft. Changes to weekly frequency apply when you generate; individual sessions can be edited below.</p>}
    </form>}
    {(draft || !!selected.length) && <div className="job-topics">
      <h3>{draft ? 'Choose what to practice' : 'Your job preparation topics'}</h3>
      {draft && <p>Required skills are suggested first. Topics group related skills; review the questions for your role. Remove a topic to remove its sessions, or add another topic.</p>}
      <div className="job-topic-grid">{(draft ? [...selected, ...Object.keys(topics).filter(id => !selected.includes(id))] : selected).map(id => {
        const topic = topics[id];
        if (!topic) return null;
        const match = suggestions.find(item => item.id === id);
        return <article className="job-topic" key={id} data-selected={selected.includes(id)}>
          {draft ? <label><input type="checkbox" checked={selected.includes(id)} onChange={() => toggleTopic(id)} disabled={busy}/><strong>{topic.label}</strong></label> : <h4>{topic.label}</h4>}
          {match && <p>{match.priority === 'required' ? 'Required' : match.priority === 'preferred' ? 'Preferred' : 'Mentioned'}: {match.skills.join(', ')}</p>}
          {selected.includes(id) && <details><summary>Example questions</summary><ol>{topic.questions.map(question => <li key={question}>{question}</li>)}</ol><Link className="text-action" to={topicLink(id, topic)}>Practice this topic</Link></details>}
        </article>;
      })}</div>
    </div>}
    {!!uncovered.length && open && <p>Not covered by our current practice topics: {uncovered.join(', ')}. Include these in your own study notes.</p>}
    {draft && <form onSubmit={save} className="job-schedule-editor">
      <h3>Edit your schedule</h3>
      <p>Adjust titles, dates, duration, and topics. You can also add or remove sessions. Saving replaces your current preparation plan.</p>
      <div className="job-task-list">{draft.tasks.map((task, index) => <fieldset key={task.id} disabled={busy}>
        <legend>Session {index + 1}</legend>
        <label>Session title<input required maxLength={160} value={task.title} onChange={event => updateTask(task.id, {title:event.target.value})}/></label>
        <label>Date<input required type="date" min={draft.start_date} max={form.interview_date} value={task.date} onChange={event => updateTask(task.id, {date:event.target.value})}/></label>
        <label>Topic<select value={task.topic} onChange={event => updateTask(task.id, {topic:event.target.value})}>{selected.map(id => <option key={id} value={id}>{topics[id]?.label || id}</option>)}</select></label>
        <label>Minutes<input required type="number" min={5} max={120} value={task.minutes} onChange={event => updateTask(task.id, {minutes:Number(event.target.value)})}/></label>
        <button type="button" onClick={() => setDraft(current => ({...current, tasks:current.tasks.filter(item => item.id !== task.id)}))}>Remove session {index + 1}</button>
      </fieldset>)}</div>
      {!draft.tasks.length && <p>Select a topic and add at least one session to save your plan.</p>}
      <div className="section-actions">
        <button type="button" className="spar-button secondary" disabled={busy || !selected.length} onClick={() => setDraft(current => ({...current, tasks:[...current.tasks, {
          id:crypto.randomUUID(), date:current.start_date, title:`Practice ${topics[selected[0]]?.label || selected[0]}`, track:'technical', topic:selected[0], minutes:25,
        }]}))}>Add session</button>
        <button className="spar-button" disabled={busy || !draft.tasks.length || !selected.length || !form.target_role.trim() || !form.interview_date}>{busy ? 'Saving…' : 'Save job preparation plan'}</button>
      </div>
    </form>}
  </section>;
}
