import { useState, useEffect, useRef } from 'react';

export default function CodeEditor({ challenge, onSubmit, onClose }) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef(null);

  const starterCode = challenge.starter_code || {};
  const languages = Object.keys(starterCode).length > 0 ? Object.keys(starterCode) : ['javascript', 'python'];

  useEffect(() => {
    setCode(starterCode[language] || '');
  }, [language, starterCode]);

  const runCode = async () => {
    if (!code.trim()) return;
    setIsRunning(true);
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
      setOutput({ error: 'Failed to run code', execution_result: { status: 'error' } });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = () => {
    if (output?.execution_result?.status === 'success') {
      onSubmit(code, language);
    }
  };

  return (
    <div className="rounded-card border border-white/10 bg-gray-950 p-4 animate-slide-down">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium">{challenge.metadata?.title || 'Coding Challenge'}</h3>
          <p className="text-sm text-gray-400">{challenge.skills_tested?.join(', ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded bg-gray-800 px-2 py-1 text-sm border border-white/10"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
            ))}
          </select>
          <button onClick={runCode} disabled={isRunning || !code.trim()} className="rounded-full bg-brand-violet px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
            {isRunning ? 'Running...' : 'Run Tests'}
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Close Editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-96 overflow-hidden rounded border border-white/10">
          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full bg-gray-900 border-none p-4 text-sm font-mono text-white focus:outline-none resize-none"
            placeholder="Write your solution here..."
            spellCheck={false}
          />
        </div>

        <div className="h-96 overflow-hidden rounded border border-white/10 bg-gray-900 p-4 flex flex-col">
          <h4 className="mb-2 text-sm font-medium">Test Results</h4>
          
          <div className="flex-1 overflow-y-auto">
            {output && output.execution_result ? (
              <div className="space-y-2">
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
                        {test.passed ? '✓ Pass' : '✗ Fail'}
                      </span>
                    </div>
                    {!test.passed && test.error && (
                      <div className="text-red-400 mt-1">{test.error}</div>
                    )}
                    {!test.passed && test.actual !== undefined && (
                      <div className="text-gray-400 mt-1 font-mono text-[10px]">
                        Expected: {JSON.stringify(test.expected)}<br />
                        Got: {JSON.stringify(test.actual)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Click "Run Tests" to execute your code</p>
              </div>
            )}
          </div>

          {output && output.ai_review && (
            <div className="mt-4 p-3 rounded bg-brand-violet/10 border border-brand-violet/20">
              <h5 className="text-sm font-medium text-brand-violet mb-2">AI Code Review</h5>
              <p className="text-xs text-white/80 mb-2">{output.feedback}</p>
              {output.suggestions && output.suggestions.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-xs font-medium">Suggestions:</p>
                  {output.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-white/70 ml-2">• {s}</p>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 text-xs">
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
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!output?.execution_result?.status === 'success' || isRunning}
          className="rounded-full bg-brand-green px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Submit Solution
        </button>
      </div>
    </div>
  );
}