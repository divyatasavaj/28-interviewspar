import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, savePreparationPlan } from '../api/auth';
import DashboardNavbar from '../components/DashboardNavbar';
import LoadingCards from '../components/LoadingCards';
import usePreparation from '../hooks/usePreparation';
import { localDate, questionPracticeLink, formatPlanDate } from '../utils/practice';

function taskLink(task, plan) {
  if (task.track === 'resume') return '/resume-intelligence';
  if (task.track === 'review') return '/account?tab=reports';
  return '/interview/start?' + new URLSearchParams({
    domain: plan.domain, ...(task.track === 'hr' ? {persona: 'hr'} : {}),
    ...(task.track === 'coding' ? {track: 'coding'} : {}),
  });
}

export default function Preparation() {
  const preparation = usePreparation();
  const [domains, setDomains] = useState([]);
  const [domainError, setDomainError] = useState('');
  const [domainRevision, setDomainRevision] = useState(0);
  const [form, setForm] = useState({target_role: '', domain: 'Software Engineering', interview_date: '', sessions_per_week: 3});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const plan = preparation.data?.plan;

  useEffect(() => {
    if (plan) setForm({
      target_role: plan.target_role, domain: plan.domain,
      interview_date: plan.interview_date, sessions_per_week: plan.sessions_per_week,
    });
  }, [plan]);

  useEffect(() => {
    let active = true;
    setDomainError('');
    apiRequest('/interview/domains').then(result => { if (active) setDomains(result.domains); })
      .catch(error => { if (active) setDomainError(error.message); });
    return () => { active = false; };
  }, [domainRevision]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setMessage('');
    try {
      const result = await savePreparationPlan({...form, start_date: localDate()});
      preparation.setData(current => ({...current, plan: result}));
      setMessage('Preparation plan saved.');
      setEditing(false);
    } catch (error) { setSaveError(error.message); }
    finally { setSaving(false); }
  }

  const bookmarks = (preparation.data?.bookmarks || []).filter(item =>
    (filter === 'all' || (filter === 'coding' ? item.hands_on : !item.hands_on)) &&
    (item.question + ' ' + item.domain).toLowerCase().includes(search.toLowerCase()));
  const completed = (plan?.tasks || []).filter(task => preparation.isChecked(`plan:${plan.id}:${task.id}`)).length;
  const today = localDate();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 365);

  return <div>
    <DashboardNavbar />
    <main className="workspace-page preparation-page page-enter">
      <header className="page-heading"><div><h1>Your preparation</h1><p>Plan your practice and return to questions you want to revisit.</p></div></header>
      {preparation.status && <p role="status" className="save-confirmation">{preparation.status}</p>}
      {preparation.error && <div role="alert" className="inline-error">{preparation.error} <button onClick={preparation.reload}>Retry loading</button></div>}
      {!preparation.data ? !preparation.error && <LoadingCards label="Loading your preparation"/> : <>
        <section className="preparation-card" aria-labelledby="plan-title">
          <div className="section-actions"><h2 id="plan-title">Interview preparation plan</h2>
            {plan && <button className="spar-button secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Cancel editing' : 'Edit plan'}</button>}
          </div>
          {message && <p role="status" className="save-confirmation">{message}</p>}
          {(!plan || editing) && <form onSubmit={save} className="plan-form">
            <label>Target role<input required maxLength={120} value={form.target_role} onChange={event => setForm({...form, target_role:event.target.value})} placeholder="e.g. Backend developer"/></label>
            <label>Practice domain<select required value={form.domain} onChange={event => setForm({...form,domain:event.target.value})}>{domains.map(domain => <option key={domain}>{domain}</option>)}</select></label>
            <label>Interview date<input required type="date" min={today} max={localDate(maxDate)} value={form.interview_date} onChange={event => setForm({...form,interview_date:event.target.value})}/></label>
            <label>Sessions each week<select value={form.sessions_per_week} onChange={event => setForm({...form,sessions_per_week:Number(event.target.value)})}>{[1,2,3,4,5,6,7].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
            <p>Sessions take about 15–25 minutes. Mark each one complete after you finish.</p>
            {domainError && <p role="alert">{domainError} <button type="button" onClick={() => setDomainRevision(value => value + 1)}>Retry domains</button></p>}
            {saveError && <p role="alert" className="inline-error">{saveError}</p>}
            <button className="spar-button" disabled={saving || !domains.length}>{saving ? 'Saving…' : 'Save preparation plan'}</button>
          </form>}
          {plan && <>
            <p className="plan-summary">{plan.target_role} · Interview on {formatPlanDate(plan.interview_date)} · {completed}/{plan.tasks.length} sessions complete</p>
            <progress className="plan-progress" value={completed} max={plan.tasks.length || 1} aria-label="Preparation sessions completed"/>
            {plan.interview_date < today && <p>Your interview date has passed. Edit the plan to prepare for your next interview.</p>}
            <details className="plan-schedule" open>
              <summary>Practice schedule</summary>
              <ul>{plan.tasks.map(task => {
                const key = `plan:${plan.id}:${task.id}`;
                const done = preparation.isChecked(key);
                return <li key={task.id} data-completed={done}>
                  <label><input type="checkbox" checked={done} disabled={preparation.pending.includes(key)} onChange={event => preparation.check(key,event.target.checked)}/>
                    <span><strong>{task.title}</strong><small><time dateTime={task.date}>{formatPlanDate(task.date)}</time> · About {task.minutes} min{task.date < today && !done ? ' · To catch up' : ''}</small></span>
                  </label>
                  <Link className="text-action" to={taskLink(task,plan)}>Open session</Link>
                </li>;
              })}</ul>
            </details>
          </>}
        </section>
        <section id="saved-questions" className="preparation-card" aria-labelledby="saved-title">
          <h2 id="saved-title">Saved questions</h2>
          <p>Save questions from your feedback report to review or retry them here.</p>
          <div className="bookmark-filters">
            <label>Search questions<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Question or domain"/></label>
            <label>Track<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All tracks</option><option value="coding">Coding</option><option value="spoken">Spoken interviews</option></select></label>
          </div>
          {!bookmarks.length && <p>{preparation.data.bookmarks.length ? 'No saved questions match your filters.' : 'Your saved questions will appear here.'}</p>}
          <ul className="bookmark-list">{bookmarks.map(item => {
            const key = item.session_id + ':' + item.question_id;
            return <li key={key}>
              <span className="section-kicker">{item.domain} · {item.hands_on ? 'Coding' : 'Spoken'}</span>
              <h3>{item.question}</h3>
              <div className="section-actions">
                <Link className="text-action" to={`/interview/${item.session_id}/report#answer-${item.question_number}`}>Review answer</Link>
                <Link className="spar-button secondary" to={questionPracticeLink(item,item,true)}>Retry question</Link>
                <button disabled={preparation.pending.includes(key)} onClick={() => preparation.bookmark(item,false)}>Remove bookmark</button>
              </div>
            </li>;
          })}</ul>
        </section>
      </>}
    </main>
  </div>;
}
