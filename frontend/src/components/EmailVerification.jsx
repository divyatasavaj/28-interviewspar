import { useState } from 'react';
import { apiRequest } from '../api/auth';

export default function EmailVerification({ verified }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function send() {
    setBusy(true);
    setError('');
    try {
      setStatus((await apiRequest('/auth/verification-email', {method:'POST'})).message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  if (verified) return <p className="mt-2 text-sm">Email verified</p>;
  return <div className="mt-2 text-sm">
    <button type="button" className="text-action" disabled={busy || Boolean(status)} onClick={send}>{busy ? 'Sending…' : 'Send verification link'}</button>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
