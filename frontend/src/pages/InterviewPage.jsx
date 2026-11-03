import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InterviewLayout from '../components/interview/InterviewLayout.jsx';
import HRRound from '../components/interview/HRRound.jsx';
import TechnicalRound from '../components/interview/TechnicalRound.jsx';
import { getToken } from '../api/auth';

export default function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/interview/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      } else if (response.status === 401 || response.status === 403) {
        navigate('/login');
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = (data) => {
    if (data.next_question) {
      setSession(prev => prev ? { ...prev, current_question: data.next_question, progress: data.progress, current_round: data.next_question.round || prev.current_round } : null);
    }
    if (data.round_complete) {
      fetchSession(); // Refresh to get updated session state
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Session Not Found</h2>
          <button onClick={() => navigate('/')} className="rounded-full bg-brand-violet px-6 py-2 text-white">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const renderRound = () => {
    switch (session.current_round) {
      case 'hr':
        return <HRRound session={session} onAnswerSubmit={handleAnswerSubmit} />;
      case 'technical':
        return <TechnicalRound session={session} onAnswerSubmit={handleAnswerSubmit} />;
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-400">Round {session.current_round} not implemented yet</p>
          </div>
        );
    }
  };

  return (
    <InterviewLayout session={session} onAnswerSubmit={handleAnswerSubmit}>
      {renderRound()}
    </InterviewLayout>
  );
}