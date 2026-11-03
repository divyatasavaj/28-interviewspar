import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getToken } from '../api/auth';

export default function InterviewReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [sessionId]);

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/interview/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      if (response.ok) {
        const session = await response.json();
        // Transform session data into report format
        const mistakeJournal = session.mistakeJournal || [];
        const totalQuestions = mistakeJournal.length + (session.calibrationAnswers?.length || 0);
        const goodAnswers = mistakeJournal.filter(m => m.label === 'good-answer').length;
        const overallScore = totalQuestions > 0 ? Math.round((goodAnswers / totalQuestions) * 100) : 0;
        
        const strengths = [];
        const weaknesses = [];
        
        if (session.ability) {
          Object.entries(session.ability).forEach(([topic, score]) => {
            if (score >= 0.7) strengths.push(`Strong ${topic} (${Math.round(score * 100)}%)`);
            else if (score < 0.4) weaknesses.push(`Weak ${topic} (${Math.round(score * 100)}%)`);
          });
        }
        
        mistakeJournal.forEach(m => {
          if (m.label !== 'good-answer' && !weaknesses.includes(m.label)) {
            weaknesses.push(m.label.replace(/-/g, ' '));
          }
        });
        
        setReport({
          overall_score: overallScore,
          strengths: strengths.length ? strengths : ['Completed the interview'],
          weaknesses: weaknesses.length ? weaknesses : ['No major issues detected'],
          round_scores: {
            'Screening': session.initialFitScore || 70,
            'Calibration': 75,
            'Technical': Math.round((session.ability?.['Data Structures & Algorithms'] || 0.5) * 100),
            'Communication': Math.round((session.ability?.Communication || 0.5) * 100),
            'Cultural Fit': Math.round((session.ability?.['Cultural Alignment'] || 0.5) * 100)
          },
          violations_summary: session.integrityLog?.reduce((acc, log) => {
            acc[log.event] = (acc[log.event] || 0) + 1;
            return acc;
          }, {}) || {}
        });
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Generating report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Report Not Available</h2>
          <Link to="/" className="rounded-full bg-brand-violet px-6 py-2 text-white">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-white/10 bg-gray-950">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-2xl font-bold">Interview Report</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Overall Score</h2>
            <Link to="/" className="rounded-full bg-brand-violet px-4 py-2 text-white hover:bg-brand-violet/90">
              New Interview
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="gray"
                  strokeWidth="8"
                  className="text-gray-800"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeDasharray={`${(report.overall_score / 100) * 352}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  className={scoreColor(report.overall_score)}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-bold ${scoreColor(report.overall_score)}`}>
                  {report.overall_score.toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Performance Summary</h3>
              <p className="text-gray-400 mt-1">
                {report.overall_score >= 80 ? 'Excellent! You demonstrated strong technical and communication skills.' :
                 report.overall_score >= 60 ? 'Good effort! There are areas to improve for future interviews.' :
                 'Keep practicing! Focus on the areas highlighted below.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-white/10 bg-gray-950 p-6">
            <h3 className="font-semibold mb-4 text-brand-green">Strengths</h3>
            <ul className="space-y-2">
              {report.strengths?.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-brand-green mt-0.5">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-gray-950 p-6">
            <h3 className="font-semibold mb-4 text-red-400">Areas for Improvement</h3>
            <ul className="space-y-2">
              {report.weaknesses?.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {report.round_scores && (
          <div className="rounded-xl border border-white/10 bg-gray-950 p-6 mb-8">
            <h3 className="font-semibold mb-4">Round Scores</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(report.round_scores).map(([round, score]) => (
                <div key={round} className="text-center p-4 rounded-lg bg-gray-900">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{round}</p>
                  <p className={`text-2xl font-bold ${scoreColor(score)}`}>{score.toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.violations_summary && Object.keys(report.violations_summary).length > 0 && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-6 mb-8">
            <h3 className="font-semibold mb-2 text-yellow-400">Violations Detected</h3>
            <ul className="space-y-1">
              {Object.entries(report.violations_summary).map(([type, count]) => (
                <li key={type} className="text-sm text-yellow-300">
                  {type.replace(/_/g, ' ')}: {count}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}