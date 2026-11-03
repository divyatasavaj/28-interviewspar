import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getToken } from "../api/auth";

export default function StartInterviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedDomain, setSelectedDomain] = useState('Software Engineering');
  const [selectedPersona, setSelectedPersona] = useState(searchParams.get('persona') || 'tech');
  const [selectedMode, setSelectedMode] = useState('practice');
  const [name, setName] = useState('');
  const [experience, setExperience] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const domains = [
    'Software Engineering',
    'Data Science',
    'Frontend',
    'Backend',
    'DevOps',
    'Mobile',
    'Product Management',
    'HR',
    'System Design',
    'QA',
    'Security',
    'ML Engineering'
  ];

  const handleStart = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name: name.trim(),
          domain: selectedDomain,
          experience: experience.trim(),
          persona: selectedPersona,
          mode: selectedMode
        })
      });
      if (response.ok) {
        const data = await response.json();
        navigate(`/interview/${data.sessionId}`);
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to start interview');
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
      setError('Network error. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-white/10 bg-gray-950">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-2xl font-bold">Start New Interview</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Interview Setup</h2>
            <p className="text-gray-400 mb-6">Configure your practice session settings.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded bg-gray-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-brand-violet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full rounded bg-gray-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-brand-violet"
              >
                {domains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Experience Level</label>
              <input
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g., 2 years, fresher, 5+ years"
                className="w-full rounded bg-gray-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-brand-violet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Interview Type</label>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="w-full rounded bg-gray-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-brand-violet"
              >
                <option value="tech">Technical</option>
                <option value="hr">HR / Behavioral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="w-full rounded bg-gray-800 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-brand-violet"
              >
                <option value="practice">Practice (with hints)</option>
                <option value="assessment">Assessment (strict)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full rounded-full bg-brand-violet px-8 py-3 text-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting...' : 'Start Interview'}
          </button>
        </div>
      </main>
    </div>
  );
}