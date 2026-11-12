const prefix = 'interviewspar-code-draft:';
const keyFor = sessionId => `${prefix}${sessionId}`;
const languages = ['javascript', 'python'];

export function readCodeDraft(sessionId, questionId) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(keyFor(sessionId)));
    if (draft?.questionId !== questionId || !languages.includes(draft.language)) return null;
    const code = Object.fromEntries(languages.filter(language => typeof draft.code?.[language] === 'string')
      .map(language => [language, draft.code[language].slice(0, 12000)]));
    return {language: draft.language, code};
  } catch {
    return null;
  }
}

export function writeCodeDraft(sessionId, questionId, language, code) {
  try {
    sessionStorage.setItem(keyFor(sessionId), JSON.stringify({questionId, language, code}));
  } catch {
    // Editing remains available when browser storage is restricted.
  }
}

export function clearCodeDraft(sessionId) {
  try {
    sessionStorage.removeItem(keyFor(sessionId));
  } catch {
    // Browser storage is optional.
  }
}

export function clearAllCodeDrafts() {
  try {
    Object.keys(sessionStorage).filter(key => key.startsWith(prefix))
      .forEach(key => sessionStorage.removeItem(key));
  } catch {
    // Browser storage is optional.
  }
}
