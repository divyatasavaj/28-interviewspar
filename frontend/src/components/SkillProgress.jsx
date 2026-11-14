import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/auth';

function practiceLink(skill) {
  const params = {domain:skill.domain, level:skill.level};
  if (skill.topic === 'behavioral') params.persona = 'hr';
  else if (skill.method === 'Test pass rate') {
    params.track = 'coding';
    params.skill = skill.topic;
  } else params.topic = skill.topic;
  return '/interview/start?' + new URLSearchParams(params);
}

export default function SkillProgress() {
  const [skills, setSkills] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    apiRequest('/interview/skill-progress').then(result => {
      if (active) setSkills(result.skills);
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);

  return <section className="preparation-card" aria-labelledby="skill-progress-title">
    <h2 id="skill-progress-title">Progress by skill</h2>
    <p>Compare repeated questions at the same difficulty. Test pass rates and transcript structure are shown separately.</p>
    {error ? <p role="alert">{error} <button className="text-action" onClick={() => setRevision(value => value + 1)}>Retry</button></p>
      : !skills ? <p role="status">Loading skill progress…</p>
        : !skills.length && <p>Finish a focused practice session to see a result. Retry a question from its report to compare attempts.</p>}
    {!!skills?.length && <ul className="skill-progress-list">
      {[...skills].sort((a,b) => a.latest - b.latest).map(skill => <li key={skill.topic + skill.method}>
        <div><strong>{skill.label}</strong><small>{skill.method} · {skill.domain}</small></div>
        <p>{skill.previous == null ? <>{skill.latest}/100 · First comparable result</> : <>{skill.previous} → {skill.latest}/100 · {skill.comparable_attempts} comparable attempts</>}</p>
        <Link className="text-action" to={practiceLink(skill)}>Practice <span className="sr-only">{skill.label}</span></Link>
      </li>)}
    </ul>}
  </section>;
}
