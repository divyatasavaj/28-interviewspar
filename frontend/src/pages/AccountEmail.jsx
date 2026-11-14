import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { apiRequest, clearToken } from '../api/auth';

const titles = {
  'forgot-password': 'Reset your password',
  'reset-password': 'Choose a new password',
  'verify-email': 'Verify your email',
};

export default function AccountEmail() {
  const location = useLocation();
  const action = location.pathname.slice(1);
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = action === 'forgot-password';
  const reset = action === 'reset-password';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = request ? {email:value.trim()} : reset ? {token, password:value} : {token};
      const data = await apiRequest('/auth/' + action, {method:'POST', body:JSON.stringify(body)});
      if (reset) clearToken();
      setValue('');
      setStatus(data.message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout>
    <h1 className="text-3xl font-semibold mb-4">{titles[action] || 'Account email'}</h1>
    {status ? <p role="status">{status}</p> : request || token ? <form className="space-y-4" onSubmit={submit}>
      {request && <p>Enter the email address you use to sign in. We’ll send a link if it matches an account.</p>}
      {(request || reset) && <label className="block">{request ? 'Account email' : 'New password'}
        <input className="w-full rounded-xl border border-gray-200 px-4 py-3 mt-1" required
          type={request ? 'email' : 'password'} autoComplete={request ? 'email' : 'new-password'}
          minLength={reset ? 8 : undefined} value={value} onChange={event => setValue(event.target.value)} />
      </label>}
      {error && <p role="alert" className="inline-error">{error}</p>}
      <button className="spar-button" disabled={busy}>{busy ? 'Working…' : request ? 'Send reset link' : reset ? 'Update password' : 'Verify email'}</button>
    </form> : <p role="alert">Open the link from your email to continue.</p>}
    <div className="mt-5"><Link className="text-action" to={action === 'verify-email' ? '/account' : '/login'}>{action === 'verify-email' ? 'Go to profile' : 'Back to login'}</Link>
    {reset && !status && <Link className="text-action ml-4" to="/forgot-password">Request a new link</Link>}</div>
  </AuthLayout>;
}
