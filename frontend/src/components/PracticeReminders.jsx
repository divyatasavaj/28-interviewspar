import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/auth';

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PracticeReminders({ hasPlan }) {
  const [state, setState] = useState(null);
  const [settings, setSettings] = useState({enabled:false, days:[0,2,4], time:'18:00',
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest('/preparation/reminders').then(data => {
      if (!active) return;
      setState(data);
      setError('');
      if (data.settings) setSettings(data.settings);
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await apiRequest('/preparation/reminders', {method:'PUT', body:JSON.stringify(settings)});
      setSettings(result);
      setStatus(result.enabled ? 'Reminder schedule saved.' : 'Practice reminders are off.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const canEnable = state?.email_available && state?.email_verified && hasPlan;
  return <section className="preparation-card" aria-labelledby="reminder-title">
    <h2 id="reminder-title">Practice reminders</h2>
    <p>Choose when to get a reminder by email. Reminders stop after your interview date.</p>
    {!state && !error && <p role="status">Loading reminder settings…</p>}
    {error && <p role="alert">{error} {!state && <button className="text-action" onClick={() => setRevision(value => value + 1)}>Retry</button>}</p>}
    {state && <>
      {!state.email_available ? <p>Email delivery is currently unavailable.</p>
        : !state.email_verified ? <p><Link className="text-action" to="/account">Verify your email</Link> to receive reminders.</p>
        : !hasPlan && <p>Save a preparation plan to enable reminders.</p>}
      <form className="reminder-form" onSubmit={save}>
        <label className="reminder-option"><input type="checkbox" checked={settings.enabled} disabled={busy || (!canEnable && !settings.enabled)}
          onChange={event => setSettings({...settings, enabled:event.target.checked})}/> Email me practice reminders</label>
        {settings.enabled && <fieldset disabled={busy}>
          <legend>Reminder days</legend>
          <div className="reminder-days">{dayNames.map((day, index) => <label key={day}><input type="checkbox" checked={settings.days.includes(index)}
            onChange={event => setSettings({...settings, days:event.target.checked ? [...settings.days,index] : settings.days.filter(value => value !== index)})}/>{day}</label>)}</div>
          <label className="reminder-time">Time<input type="time" required value={settings.time} onChange={event => setSettings({...settings, time:event.target.value})}/></label>
          <p>Time zone: {settings.timezone} <button type="button" className="text-action" onClick={() => setSettings({...settings, timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'})}>Use device time zone</button></p>
        </fieldset>}
        <button className="spar-button secondary" disabled={busy || (settings.enabled && (!canEnable || !settings.days.length))}>{busy ? 'Saving…' : 'Save reminders'}</button>
      </form>
      {status && <p role="status">{status}</p>}
    </>}
  </section>;
}
