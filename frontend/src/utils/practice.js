export function questionPracticeLink(report, row, exact = false) {
  const query = new URLSearchParams({ domain: report.domain });
  if (report.experience_level) query.set('level', report.experience_level);
  if (row?.hands_on || report.coding_only) {
    query.set('track', 'coding');
    if (row?.skill_topic) query.set('skill', row.skill_topic);
  } else if (report.interview_type === 'hr') query.set('persona', 'hr');
  else if (row?.skill_topic || report.focus_topic) query.set('topic', row?.skill_topic || report.focus_topic);
  if (exact) {
    query.set('retry_session', report.session_id);
    query.set('retry_question', row.question_id);
  }
  return '/interview/start?' + query;
}

export function recommendedAnswer(report) {
  const answers = (report?.qa_pairs || []).filter(row => !row.skipped && row.evaluation);
  const technical = answers.filter(row => Number.isFinite(row.evaluation.correctness_score));
  const candidates = technical.length ? technical : answers.filter(row => Number.isFinite(row.evaluation.communication_score));
  const metric = technical.length ? 'correctness_score' : 'communication_score';
  return [...candidates].sort((a, b) => a.evaluation[metric] - b.evaluation[metric])[0] || answers[0];
}

export function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function formatPlanDate(value) {
  return new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric', year:'numeric'})
    .format(new Date(value + 'T12:00:00'));
}
