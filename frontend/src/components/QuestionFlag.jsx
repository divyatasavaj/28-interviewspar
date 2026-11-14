import { useState } from 'react';
import { apiRequest } from '../api/auth';

export default function QuestionFlag({ sessionId, row }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('unclear-question');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest(`/interview/${sessionId}/question-flags`, {
        method:'POST', body:JSON.stringify({question_id:row.question_id, reason, note}),
      });
      setStatus(data.message);
      setOpen(false);
      setNote('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="question-flag print:hidden">
    {!open && <button className="text-action" onClick={() => { setOpen(true); setStatus(''); }}>Report an issue</button>}
    {status && <p role="status">{status}</p>}
    {open && <form className="plan-form" onSubmit={submit}>
      <label>Issue<select value={reason} onChange={event => setReason(event.target.value)} disabled={busy}>
        <option value="unclear-question">Unclear question</option>
        {(row.hands_on || row.code) && <option value="incorrect-test">Incorrect test case</option>}
        {!row.skipped && <option value="questionable-feedback">Questionable feedback</option>}
      </select></label>
      <label>Details (optional)<textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
        disabled={busy} placeholder="What should we review?"/></label>
      {error && <p role="alert">{error}</p>}
      <div className="section-actions"><button className="spar-button" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
        <button type="button" className="text-action" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>Cancel</button></div>
    </form>}
  </div>;
}
