import { useState } from 'react';
import { apiRequest } from '../../api/auth';
import { readCodeDraft, writeCodeDraft } from '../../utils/codeDraft';

function SampleResults({ output, samples }) {
  if (!output) return null;
  if (output.status !== 'evaluated') return <p role="status">{output.message || 'Sample execution is unavailable.'}</p>;
  return <div role="status">
    <p>{output.passed} of {output.total} sample tests passed.</p>
    {samples.length > 0 && <ul>{output.results.map((result, index) => (
      <li key={index}>Sample {index + 1} · {result.passed ? 'Passed' : result.status === 'Accepted' ? 'Wrong return value' : result.status}</li>
    ))}</ul>}
  </div>;
}

export default function CodeEditor({ question, sessionId, onChange, onSubmit, onSkip, disabled = false }) {
  const [restored] = useState(() => readCodeDraft(sessionId, question.id));
  const [language, setLanguage] = useState(restored?.language || 'javascript');
  const [drafts, setDrafts] = useState(() => ({ ...question.starter_code, ...restored?.code }));
  const [panel, setPanel] = useState('editor');
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const code = drafts[language] || '';
  const samples = question.samples || [];
  const locked = running || disabled;
  const hasSolution = Boolean(code.trim()) && code !== question.starter_code?.[language];

  function change(value) {
    const updated = {...drafts, [language]:value};
    setDrafts(updated);
    writeCodeDraft(sessionId, question.id, language, updated);
    setOutput(null);
    onChange?.({ code: value, language });
  }

  function chooseLanguage(event) {
    const next = event.target.value;
    setLanguage(next);
    writeCodeDraft(sessionId, question.id, next, drafts);
    setOutput(null);
    onChange?.({ code: drafts[next] || '', language: next });
  }

  async function run() {
    setPanel('tests');
    setRunning(true);
    setOutput(null);
    try {
      setOutput(await apiRequest('/code/run', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, problem_id: question.problem_id, code, language }),
      }));
    } catch (error) {
      setOutput({ message: error.message });
    } finally {
      setRunning(false);
    }
  }

  return <section className="coding-editor" aria-label="Coding editor" data-panel={panel}>
    <h1 className="coding-exercise-title">{question.title}</h1>
    <nav className="coding-tabs" aria-label="Coding workspace">
      {['problem', 'editor', 'tests'].map(tab => <button key={tab} type="button" aria-pressed={panel === tab}
        onClick={() => setPanel(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
    </nav>
    <section className="coding-problem">
      <p>{question.prompt}</p>
      {samples.length > 0 && <details className="coding-samples" open>
        <summary>Sample tests</summary>
        <ol>{samples.map((sample, index) => <li key={index}>
          <code>solve({sample.args.map(arg => JSON.stringify(arg)).join(', ')})</code>
          <code>Expected return: {JSON.stringify(sample.expected)}</code>
        </li>)}</ol>
      </details>}
    </section>
    <div className="coding-solution">
      <label className="coding-language">Language
        <select aria-label="Code language" value={language} disabled={locked} onChange={chooseLanguage}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
      </label>
      <label htmlFor="solution-code">Your code</label>
      {restored && <span className="coding-draft-note">Draft restored from this tab</span>}
      <textarea id="solution-code" aria-label="Your code" maxLength={12000} spellCheck={false}
        autoCapitalize="off" autoComplete="off" disabled={locked} value={code} onChange={event => change(event.target.value)}/>
    </div>
    <section className="coding-results" aria-label="Sample results">
      <h2>Sample results</h2>
      {running ? <p role="status">Running samples…</p> : output ? <SampleResults output={output} samples={samples}/>
        : <p>Run samples to check the displayed examples.</p>}
    </section>
    <div className="coding-actions">
      <button type="button" disabled={locked || !hasSolution} onClick={run}>{running ? 'Running samples…' : 'Run samples'}</button>
      {onSkip && <button type="button" disabled={locked} onClick={onSkip}>Skip exercise</button>}
      {onSubmit && <button type="button" className="coding-submit" disabled={locked || !hasSolution}
        onClick={() => onSubmit({ code, language })}>{disabled ? 'Saving solution…' : 'Submit solution'}</button>}
    </div>
  </section>;
}
