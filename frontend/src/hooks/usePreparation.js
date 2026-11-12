import { useCallback, useEffect, useState } from 'react';
import { getPreparation, savePreparationCheck, saveQuestionBookmark } from '../api/auth';

export default function usePreparation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState([]);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setError('');
    getPreparation().then(result => { if (active) setData(result); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [revision]);

  async function check(key, completed) {
    setPending(items => [...items, key]);
    setStatus('');
    setError('');
    try {
      const result = await savePreparationCheck(key, completed);
      setStatus('Checklist progress saved.');
      setData(current => ({...current, checks: [...(current?.checks || []).filter(item => item.key !== key), result]}));
    } catch (failure) { setError(failure.message); }
    finally { setPending(items => items.filter(item => item !== key)); }
  }

  async function bookmark(reference, saved) {
    const key = reference.session_id + ':' + reference.question_id;
    setPending(items => [...items, key]);
    setStatus('');
    setError('');
    try {
      await saveQuestionBookmark(reference.session_id, reference.question_id, saved);
      setStatus(saved ? 'Question saved.' : 'Bookmark removed.');
      setData(current => ({
        ...current,
        bookmarks: [...(current?.bookmarks || []).filter(item =>
          item.session_id !== reference.session_id || item.question_id !== reference.question_id),
          ...(saved ? [reference] : [])],
      }));
    } catch (failure) { setError(failure.message); }
    finally { setPending(items => items.filter(item => item !== key)); }
  }
  const isChecked = key => Boolean(data?.checks.find(item => item.key === key)?.completed);
  return { data, setData, error, status, pending, reload, check, bookmark, isChecked };
}
