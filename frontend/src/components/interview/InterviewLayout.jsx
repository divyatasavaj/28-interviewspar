import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ValidationToast from './ValidationToast.jsx';
import ProgressIndicator from './ProgressIndicator.jsx';

export default function InterviewLayout({ children, session, onAnswerSubmit, onCodeSubmit }) {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [currentRound, setCurrentRound] = useState('hr');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0, phase: 'theory' });
  const [validationErrors, setValidationErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeChallenge, setCodeChallenge] = useState(null);
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  useEffect(() => {
    if (session) {
      setCurrentRound(session.current_round || 'hr');
      setCurrentQuestion(session.current_question);
      setProgress(session.progress || { current: 0, total: 0, percentage: 0 });
    }
  }, [session]);

  const handleAnswerSubmit = async (answer, code = null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      const response = await fetch(`/api/interview/v2/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          answer,
          code
        })
      });

      const data = await response.json();

      if (data.retry_message) {
        setValidationErrors([{ type: 'retry', message: data.retry_message }]);
      } else if (data.evaluation?.validation_results) {
        const errors = data.evaluation.validation_results
          .filter(v => !v.is_valid)
          .map(v => ({ type: v.rule_type, message: v.message, suggestions: v.suggestions }));
        setValidationErrors(errors);
      }

      if (data.should_advance && data.next_question) {
        setCurrentQuestion(data.next_question);
        setProgress(data.progress);
        setCurrentRound(data.next_question.round || currentRound);

        if (data.next_question.type === 'coding_challenge') {
          setShowCodeEditor(true);
          setCodeChallenge(data.next_question);
        } else {
          setShowCodeEditor(false);
        }
      }

      if (data.round_complete) {
        if (currentRound === 'hr') {
          setCurrentRound('technical');
        } else if (currentRound === 'technical') {
          navigate(`/interview/${sessionId}/report`);
        }
      }

      onAnswerSubmit?.(data);
    } catch (error) {
      setValidationErrors([{ type: 'error', message: 'Failed to submit answer. Please try again.' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (code, language) => {
    if (!codeChallenge) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/interview/v2/code/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          challenge_id: codeChallenge.id,
          code,
          language
        })
      });

      const data = await response.json();

      if (data.execution_result?.status === 'success') {
        await handleAnswerSubmit(
          `Code executed successfully. ${data.passed}/${data.total} tests passed.\n\nAI Review: ${data.feedback}`,
          code
        );
      } else {
        setValidationErrors([{
          type: 'code_error',
          message: data.execution_result?.error_message || 'Code execution failed',
          suggestions: ['Check syntax errors', 'Verify logic matches requirements']
        }]);
      }
    } catch (error) {
      setValidationErrors([{ type: 'error', message: 'Code evaluation failed' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-white/10 bg-gray-950 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">InterviewSpar</h1>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-brand-violet/20 text-brand-violet">
              {currentRound.toUpperCase()}
            </span>
            {codeChallenge && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-brand-green/20 text-brand-green">
                CODING CHALLENGE
              </span>
            )}
          </div>

          <ProgressIndicator
            current={progress.current}
            total={progress.total}
            percentage={progress.percentage}
            phase={progress.phase}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <ValidationToast errors={validationErrors} onDismiss={(type) => {
          setValidationErrors(validationErrors.filter(e => e.type !== type));
        }} />

        {showCodeEditor && codeChallenge && (
          <CodeEditorPanel
            challenge={codeChallenge}
            language={codeLanguage}
            onLanguageChange={setCodeLanguage}
            onSubmit={handleCodeSubmit}
            isSubmitting={isSubmitting}
            onClose={() => { setShowCodeEditor(false); setCodeChallenge(null); }}
          />
        )}

        <div className="space-y-4">
          {children}
        </div>
      </main>
    </div>
  );
}

function CodeEditorPanel({ challenge, language, onLanguageChange, onSubmit, isSubmitting, onClose }) {
  const [code, setCode] = useState(challenge.starter_code?.[language] || '');
  const [output, setOutput] = useState(null);

  const starterCode = challenge.starter_code || {};
  const languages = Object.keys(starterCode).length > 0 ? Object.keys(starterCode) : ['javascript', 'python'];

  useEffect(() => {
    setCode(starterCode[language] || '');
  }, [language, starterCode]);

  const runCode = async () => {
    try {
      const response = await fetch(`/api/interview/v2/code/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          challenge_id: challenge.id,
          code,
          language
        })
      });
      const data = await response.json();
      setOutput(data);
    } catch (error) {
      setOutput({ error: 'Failed to run code' });
    }
  };

  return (
    <div className="rounded-card border border-white/10 bg-gray-950 p-4 animate-slide-down">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">{challenge.metadata?.title || 'Coding Challenge'}</h3>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="rounded bg-gray-800 px-2 py-1 text-sm border border-white/10"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button onClick={runCode} disabled={isSubmitting} className="rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
            Run Tests
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-96 overflow-hidden rounded border border-white/10">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full bg-gray-900 border-none p-4 text-sm font-mono text-white focus:outline-none resize-none"
            placeholder="Write your solution here..."
            spellCheck={false}
          />
        </div>

        <div className="h-96 overflow-hidden rounded border border-white/10 bg-gray-900 p-4">
          <h4 className="mb-2 text-sm font-medium">Test Results</h4>
          {output && output.execution_result ? (
            <div className="space-y-2 max-h-[calc(100%-2rem)] overflow-y-auto">
              <div className={`flex items-center gap-2 px-3 py-2 rounded ${
                output.execution_result.status === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${output.execution_result.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm capitalize">{output.execution_result.status.replace('_', ' ')}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {output.execution_result.passed}/{output.execution_result.total} passed · {output.execution_result.execution_time_ms?.toFixed(0)}ms
                </span>
              </div>

              {output.execution_result.test_results && output.execution_result.test_results.map((test, i) => (
                <div key={i} className="text-xs p-2 rounded bg-gray-800/50">
                  <div className="flex justify-between">
                    <span>{test.description || `Test ${test.testCase}`}</span>
                    <span className={test.passed ? 'text-green-400' : 'text-red-400'}>
                      {test.passed ? '✓' : '✗'}
                    </span>
                  </div>
                  {!test.passed && test.error && (
                    <div className="text-red-400 mt-1">{test.error}</div>
                  )}
                  {!test.passed && test.actual !== undefined && (
                    <div className="text-gray-400 mt-1">
                      Expected: {JSON.stringify(test.expected)}<br />
                      Got: {JSON.stringify(test.actual)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Click "Run Tests" to execute your code</p>
          )}

          {output && output.ai_review && (
            <div className="mt-4 p-3 rounded bg-brand-violet/10 border border-brand-violet/20">
              <h5 className="text-sm font-medium text-brand-violet mb-2">AI Code Review</h5>
              <p className="text-xs text-white/80 mb-2">{output.feedback}</p>
              {output.suggestions && output.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Suggestions:</p>
                  {output.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-white/70 ml-2">• {s}</p>
                  ))}
                </div>
              )}
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div className="text-center p-2 rounded bg-white/5">
                  <div className="font-bold text-brand-green">{output.correctness_score?.toFixed(0) || 0}%</div>
                  <div className="text-gray-500">Correctness</div>
                </div>
                <div className="text-center p-2 rounded bg-white/5">
                  <div className="font-bold text-brand-violet">{output.complexity_score?.toFixed(0) || 0}%</div>
                  <div className="text-gray-500">Complexity</div>
                </div>
                <div className="text-center p-2 rounded bg-white/5">
                  <div className="font-bold text-brand-blue">{output.style_score?.toFixed(0) || 0}%</div>
                  <div className="text-gray-500">Style</div>
                </div>
                <div className="text-center p-2 rounded bg-white/5">
                  <div className="font-bold text-brand-orange">{output.edge_case_score?.toFixed(0) || 0}%</div>
                  <div className="text-gray-500">Edge Cases</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => onSubmit(code, language)}
            disabled={isSubmitting || !output?.execution_result?.status === 'success'}
            className="mt-4 w-full rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Solution'}
          </button>
        </div>
      </div>
    </div>
  );
}
