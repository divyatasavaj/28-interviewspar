import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CodeEditor from './CodeEditor.jsx';
import { getToken } from "../../api/auth";

export default function TechnicalRound({ session, onAnswerSubmit }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeChallenge, setCodeChallenge] = useState(null);
  const [phase, setPhase] = useState('theory');
  const { sessionId } = useParams();

  useEffect(() => {
    if (session?.current_question) {
      setCurrentQuestion(session.current_question);
      setPhase(session.progress?.phase || 'theory');
      
      if (session.current_question.type === 'coding_challenge') {
        setShowCodeEditor(true);
        setCodeChallenge(session.current_question);
      }
    }
  }, [session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() && !showCodeEditor) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      let endpoint, body;
      if (session.phase === 'adaptive') {
        endpoint = '/api/interview/message';
        const history = [
          ...session.history,
          { role: 'user', content: answer.trim() }
        ];
        body = { sessionId, history };
      } else {
        endpoint = '/api/interview/message';
        const history = [
          ...session.history,
          { role: 'user', content: answer.trim() }
        ];
        body = { sessionId, history };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.retry_message || data.error) {
        setRetryCount(prev => prev + 1);
      } else {
        setRetryCount(0);
        setAnswer('');
        
        if (data.reply) {
          // Parse the AI's reply to determine question type
          let questionType = 'technical_theory';
          if (data.reply.toLowerCase().includes('code') || data.reply.toLowerCase().includes('implement') || data.reply.toLowerCase().includes('function')) {
            questionType = 'coding_challenge';
          } else if (data.reply.toLowerCase().includes('design') || data.reply.toLowerCase().includes('architecture') || data.reply.toLowerCase().includes('system')) {
            questionType = 'system_design';
          }
          
          setCurrentQuestion({ 
            prompt: data.reply, 
            type: questionType,
            difficulty: 'medium'
          });
          
          if (questionType === 'coding_challenge') {
            setShowCodeEditor(true);
            setCodeChallenge({ 
              id: `challenge-${Date.now()}`,
              prompt: data.reply,
              type: 'coding_challenge'
            });
          }
        }
        
        if (data.next_question) {
          setCurrentQuestion(data.next_question);
          setPhase(data.progress?.phase || 'theory');
        }
        onAnswerSubmit?.(data);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (code, language) => {
    if (!codeChallenge) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/code/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          problemId: 'custom-challenge',
          language,
          code
        })
      });

      const data = await response.json();
      
      if (data.execution_result?.status === 'success') {
        await handleAnswerSubmit(
          `Code executed successfully. ${data.execution_result.passed}/${data.execution_result.total} tests passed.\n\nAI Review: ${data.feedback}`,
          code
        );
      } else {
        await handleAnswerSubmit(
          `Code execution failed: ${data.execution_result?.error_message || 'Unknown error'}`,
          code
        );
      }
    } catch (error) {
      console.error('Code evaluation failed:', error);
      await handleAnswerSubmit(`Code evaluation error: ${error.message}`, code);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'technical_theory': return '🧠';
      case 'system_design': return '🏗️';
      case 'coding_challenge': return '💻';
      case 'domain_specific': return '📚';
      default: return '❓';
    }
  };

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-green/20 flex items-center justify-center">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-3xl font-bold mb-4">Technical Round Complete!</h2>
        <p className="text-gray-400">Great job! Generating your report...</p>
      </div>
    );
  }

  const questionType = currentQuestion.type || 'technical_theory';
  const isCoding = questionType === 'coding_challenge';

  return (
    <div className="max-w-4xl mx-auto">
      {showCodeEditor && codeChallenge && (
        <CodeEditor
          challenge={codeChallenge}
          onSubmit={handleCodeSubmit}
          onClose={() => { setShowCodeEditor(false); setCodeChallenge(null); }}
        />
      )}

      {!showCodeEditor && (
        <div className="mb-6 p-4 rounded-lg bg-gray-950 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{getQuestionIcon(questionType)}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-500">{questionType.replace('_', ' ').toUpperCase()}</p>
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-800 text-gray-300">
                  {currentQuestion.difficulty?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
              <p className="text-lg font-medium">{currentQuestion.prompt}</p>
            </div>
          </div>
          
          {retryCount > 0 && (
            <div className="mb-4 p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
              ⚠️ Retry {retryCount}/2 - Please provide a detailed technical answer
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Explain your answer with technical details..."
              rows={8}
              className="w-full rounded bg-gray-900 border border-white/10 p-4 text-white focus:outline-none focus:border-brand-violet resize-none font-mono text-sm"
              disabled={isSubmitting}
            />
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAnswer('')}
                className="rounded-full bg-white/10 px-6 py-2 text-sm font-medium hover:bg-white/20"
                disabled={isSubmitting}
              >
                Clear
              </button>
              <button
                type="submit"
                className="rounded-full bg-brand-violet px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isSubmitting || !answer.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <p>💡 Tip: Provide detailed technical explanations. Include trade-offs, complexity analysis, and examples where relevant.</p>
        {phase === 'coding' && <p>🔧 Coding phase: Write clean, efficient code with proper error handling.</p>}
      </div>
    </div>
  );
}

// Import handleAnswerSubmit for code submission
function handleAnswerSubmit(answer, code) {
  // This will be called from parent
  window.dispatchEvent(new CustomEvent('codeAnswerSubmit', { detail: { answer, code } }));
}