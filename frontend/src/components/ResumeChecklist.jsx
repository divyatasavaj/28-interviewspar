import { Link } from 'react-router-dom';
import usePreparation from '../hooks/usePreparation';

export default function ResumeChecklist({ assessment, findings, practiceLink }) {
  const preparation = usePreparation();
  const tasks = (assessment.recommendations || []).slice(0, 6);
  if (!tasks.length) return null;
  const keyFor = task => `resume:${assessment.assessment_id}:${task.recommendation_id}`;
  const completed = tasks.filter(task => preparation.isChecked(keyFor(task))).length;
  return <section className="preparation-card" aria-labelledby="resume-checklist-title">
    <div className="section-actions"><h2 id="resume-checklist-title">Your preparation checklist</h2><span>{completed}/{tasks.length} complete</span></div>
    <p>Track the actions you’ve taken for this assessment. Update and reassess your resume to refresh the evidence.</p>
    {preparation.status && <p role="status" className="save-confirmation">{preparation.status}</p>}
      {preparation.error && <p role="alert" className="inline-error">{preparation.error} <button onClick={preparation.reload}>Retry</button></p>}
    {!preparation.data && !preparation.error && <p role="status">Loading checklist progress…</p>}
    <ul className="resume-checklist">{tasks.map(task => {
      const key = keyFor(task);
      const related = findings.find(finding => task.related_requirement_ids?.includes(finding.requirement_id));
      const href = related && practiceLink(related);
      return <li key={key}>
        <label><input type="checkbox" checked={preparation.isChecked(key)} disabled={!preparation.data || preparation.pending.includes(key)} onChange={event => preparation.check(key,event.target.checked)}/>
          <span><strong>{task.title}</strong><small>{task.action}</small></span></label>
        <Link className="text-action" to={href || '/account?tab=resume'}>{href ? 'Practice this skill' : 'Update resume'}</Link>
      </li>;
    })}</ul>
  </section>;
}
