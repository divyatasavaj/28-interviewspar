import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest, getInterviewFeedback } from '../api/auth';
import Brand from '../components/Brand';
import UiIcon from '../components/UiIcon';
import InterviewAnalytics from '../components/InterviewAnalytics';

function roundLabel(round) {
  if (round === 'final') return 'Reflection';
  if (round === 'hr') return 'HR';
  return round;
}

function AnswerReview({ row, index }) {
  const evaluation = row.evaluation;
  return <details id={`answer-${index + 1}`} className="report-qa">
    <summary>
      <span className="report-question-number">{index + 1}</span>
      <span><span className="block text-xs capitalize text-gray-600">{roundLabel(row.round)}{row.skipped && ' · Skipped'}</span>{row.question}</span>
    </summary>
    <div className="report-qa-body">
      {row.skipped ? <p className="text-sm text-gray-600">You skipped this question.</p> : <>
        <div className="report-answer-text report-transcript">
          <span>Your answer</span>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{row.answer}</p>
        </div>
        {row.code && <pre className="report-transcript mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-xs">{row.code}</pre>}
        <div className="report-answer-feedback">
          <p className="text-sm leading-relaxed">{evaluation.feedback}</p>
          <p className="mt-2 text-xs text-gray-600">Evaluation method · {evaluation.source}{evaluation.code_result?.message && ` · ${evaluation.code_result.message}`}</p>
          {evaluation.mistake_tag?.label && <p className="report-answer-detail mt-2 text-xs text-gray-600">Experimental coaching signal · {evaluation.mistake_tag.label} ({evaluation.mistake_tag.source})</p>}
        </div>
        {evaluation.delivery && <div className="report-answer-detail"><InterviewAnalytics delivery={evaluation.delivery}/></div>}
      </>}
    </div>
  </details>;
}

export default function InterviewReportPage() {
  const params = useParams();
  const [query] = useSearchParams();
  const sessionId = params.sessionId || query.get('session_id');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [printFull, setPrintFull] = useState(false);
  const navigate = useNavigate();
  const page = useRef(null);

  useEffect(() => {
    let opened = null;
    const restore = () => {
      opened?.forEach(detail => { detail.open = false; });
      opened = null;
    };
    const before = () => {
      if (opened || !page.current) return;
      const selector = printFull ? 'details:not([open])' : '.report-qa:not([open])';
      opened = [...page.current.querySelectorAll(selector)];
      opened.forEach(detail => { detail.open = true; });
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', restore);
      restore();
    };
  }, [printFull]);

  useEffect(() => {
    let alive = true;
    setReport(null);
    setError('');
    if (!sessionId) {
      setError('No interview selected.');
      return;
    }
    getInterviewFeedback(sessionId).then(result => {
      if (alive) setReport(result);
    }).catch(failure => {
      if (alive) setError(failure.message);
    });
    return () => { alive = false; };
  }, [sessionId]);

  async function remove() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/interview/${sessionId}`, { method: 'DELETE' });
      navigate('/dashboard');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setDeleting(false);
    }
  }

  const scored = Number.isFinite(report?.overall_score);
  const practiceAnswer = report?.qa_pairs.reduce((lowest, row) => {
    if (row.skipped || !Number.isFinite(row.evaluation?.communication_score)) return lowest;
    return !lowest || row.evaluation.communication_score < lowest.evaluation.communication_score ? row : lowest;
  }, null);
  const practiceIndex = report?.qa_pairs.indexOf(practiceAnswer) + 1;
  const practiceId = `answer-${practiceIndex}`;

  return <main ref={page} className={`report-page mx-auto min-h-screen max-w-6xl px-5 py-8 text-gray-900 page-enter sm:px-8 sm:py-10 ${printFull ? 'report-print-full' : ''}`}>
    <nav className="flex items-center justify-between gap-4 print:hidden"><Brand to="/dashboard"/><Link to="/dashboard" className="text-sm text-primary">← Dashboard</Link></nav>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!report ? <p role="status">{error ? 'Report unavailable.' : 'Loading report…'}</p> : <>
      <header className="report-heading flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your interview feedback</h1>
          <p className="mt-2 text-sm text-gray-600">Answered {report.answered} of {report.total} · {report.skipped} skipped
            {report.status === 'active' && <Link className="ml-3 text-primary underline print:hidden" to={`/interview/${sessionId}`}>Resume interview</Link>}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="spar-button secondary"><UiIcon name="download"/>Print / Save PDF</button>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={printFull} onChange={event => setPrintFull(event.target.checked)}/>
            Include full transcripts and delivery details
          </label>
        </div>
      </header>
      <nav className="page-tabs print:hidden" aria-label="Report sections">
        <a href="#report-overview">Overview</a>
        {report.delivery_summary && <a href="#report-delivery">Speaking & presence</a>}
        <a href="#report-rounds">Round details</a>
        <a href="#report-answers">Your answers</a>
      </nav>

      <div id="report-overview" className="report-grid">
        <section className="report-next">
          <h2>What to practice next</h2>
          {practiceAnswer ? <>
            <p className="mb-2 text-xs font-semibold text-primary">Question {practiceIndex} · {roundLabel(practiceAnswer.round)}</p>
            <p className="text-sm leading-relaxed text-gray-700">{practiceAnswer.evaluation.feedback}</p>
            <a className="mt-3 inline-block text-sm font-semibold text-primary underline print:hidden" href={`#${practiceId}`}
              onClick={() => { const answer = document.getElementById(practiceId); if (answer) answer.open = true; }}>
              Review question {practiceIndex}
            </a>
          </> : <p className="text-sm leading-relaxed text-gray-700">Submit a spoken answer in your next interview to get feedback here.</p>}
        </section>
        <section className="report-score">
          <div className="report-score-ring" style={{ '--score': scored ? report.overall_score : 0 }} aria-hidden="true">
            <div><strong>{scored ? report.overall_score : '—'}</strong><small>{scored ? 'out of 100' : 'Not scored'}</small></div>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{report.score_label}</h2>
            <p className="sr-only print:not-sr-only print:font-semibold">{scored ? `${report.overall_score}/100` : 'Not scored'}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{report.score_note}</p>
          </div>
        </section>
      </div>

      {report.delivery_summary && <div id="report-delivery"><InterviewAnalytics delivery={report.delivery_summary} summary/></div>}
      <section id="report-rounds" className="report-rounds rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <h2 className="mb-4 text-xl font-bold">Round by round</h2>
        <div className="overflow-x-auto"><table className="report-table">
          <thead><tr><th scope="col">Round</th><th scope="col">Text structure / 100</th><th scope="col">Technical correctness / 100</th><th scope="col">Answered</th></tr></thead>
          <tbody>{Object.entries(report.round_scores).map(([round, row]) => <tr key={round}>
            <th scope="row" className="capitalize font-medium bg-transparent! text-gray-900!">{roundLabel(round)}</th>
            <td>{row.communication_score ?? 'Not scored'}</td>
            <td>{row.correctness_score ?? 'Not evaluated'}</td>
            <td>{row.answered}/{row.total}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section id="report-answers">
        <h2 className="mb-4 text-xl font-bold">Question-by-question review</h2>
        {report.qa_pairs.length === 0 && <p className="text-sm text-gray-600">No answers were submitted in this session.</p>}
        {report.qa_pairs.map((row, index) => <AnswerReview key={row.question_id} row={row} index={index}/>)}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-gray-200 pt-7 print:hidden">
        <Link to="/interview/start" className="spar-button">Practice again<UiIcon name="arrow"/></Link>
        <button type="button" disabled={deleting} onClick={remove} className="text-xs text-red-700 underline">
          {deleting ? 'Deleting…' : 'Delete this interview and its answers'}
        </button>
      </footer>
    </>}
  </main>;
}
