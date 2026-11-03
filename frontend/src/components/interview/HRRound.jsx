import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import HumanAvatar from "../HumanAvatar.jsx";
import { getToken } from "../../api/auth";

export default function HRRound({ session, onAnswerSubmit }) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const { sessionId } = useParams();

  useEffect(() => {
    if (session?.current_question) {
      setCurrentQuestion(session.current_question);
      setShowWelcome(false);
    }
  }, [session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Determine which endpoint to use based on session phase
      let endpoint, body;
      if (session.phase === 'screening') {
        endpoint = '/api/interview/screening';
        body = { sessionId, question: session.screeningQuestions[session.screeningAnswers.length], answer: answer.trim() };
      } else if (session.phase === 'calibration') {
        endpoint = '/api/interview/calibration';
        body = { sessionId, question: session.calibrationQuestions[session.calibrationAnswers.length], answer: answer.trim() };
      } else {
        // Adaptive phase - use message endpoint with history
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

        // Handle different response formats
        if (session.phase === 'adaptive') {
          // For adaptive phase, the AI's reply is the next question
          if (data.reply) {
            setCurrentQuestion({ prompt: data.reply, type: 'behavioral' });
          }
        } else {
          // For screening/calibration, just advance locally
          onAnswerSubmit?.(data);
        }

        if (data.next_question) {
          setCurrentQuestion(data.next_question);
        }
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'basic_info': return '👤';
      case 'behavioral': return '💬';
      default: return '❓';
    }
  };

  if (showWelcome) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <HumanAvatar
          seed="hr-welcome"
          size={96}
          status="idle"
          persona="hr"
          ariaLabel="AI HR Interviewer"
          className="mx-auto mb-6"
        />
        <h2 className="text-3xl font-bold mb-4">Welcome to Your Interview</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Let's start with some basic information. I'll ask you a few questions to get to know you better.
          Please answer in English and provide complete responses.
        </p>
        <button
          onClick={() => setShowWelcome(false)}
          className="rounded-full bg-brand-violet px-8 py-3 text-lg font-semibold text-white hover:bg-brand-violet/90 transition-colors"
        >
          Begin Interview
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <HumanAvatar
          seed="hr-complete"
          size={96}
          status="idle"
          persona="hr"
          ariaLabel="AI HR Interviewer"
          className="mx-auto mb-6"
        />
        <h2 className="text-3xl font-bold mb-4">HR Round Complete!</h2>
        <p className="text-gray-400">Moving to technical round...</p>
      </div>
    );
  }

  const questionType = currentQuestion.type || 'basic_info';
  const isBasicInfo = questionType === 'basic_info';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 p-4 rounded-lg bg-gray-950 border border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{getQuestionIcon(questionType)}</span>
          <div>
            <p className="text-sm text-gray-500">{questionType.replace('_', ' ').toUpperCase()}</p>
            <p className="text-lg font-medium">{currentQuestion.prompt}</p>
          </div>
        </div>

        {retryCount > 0 && (
          <div className="mb-4 p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
            ⚠️ Retry {retryCount}/2 - Please provide a proper answer in English
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isBasicInfo ? "Enter your response..." : "Describe your experience..."}
            rows={isBasicInfo ? 3 : 6}
            className="w-full rounded bg-gray-900 border border-white/10 p-4 text-white focus:outline-none focus:border-brand-violet resize-none"
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

      <div className="text-sm text-gray-500 text-center">
        <p>💡 Tip: Answer in complete sentences. For name questions, provide your full name.</p>
        <p>For experience questions, include company, role, and duration.</p>
      </div>
    </div>
  );
}
