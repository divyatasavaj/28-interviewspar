// STEP 10 — in-memory store of completed sessions for dashboards/reports (MVP: JSON store).
const completed = new Map();

export function completeSession(session) {
  if (!session) return null;
  const record = {
    ...session,
    endedAt: new Date().toISOString(),
    mistakeCount: session.mistakeJournal?.length || 0,
    calibrationCount: session.calibrationAnswers?.length || 0,
  };
  completed.set(session.id, record);
  return record;
}

export function listSessions() {
  return [...completed.values()]
    .map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      persona: s.persona,
      mode: s.mode,
      endedAt: s.endedAt,
      mistakeCount: s.mistakeCount,
      ability: s.ability || {},
      integrityFlags: s.integrityLog?.length || 0,
    }))
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
}

export function getSessionReport(id) {
  return completed.get(id) || null;
}
