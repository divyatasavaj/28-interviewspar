const storageKey = 'interviewspar-theme';
const options = ['system', 'light', 'dark'];

export function readTheme() {
  try {
    const preference = localStorage.getItem(storageKey);
    return options.includes(preference) ? preference : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(preference = readTheme()) {
  const dark = preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function saveTheme(preference) {
  if (!options.includes(preference)) return;
  try { localStorage.setItem(storageKey, preference); } catch { /* Apply for this visit. */ }
  applyTheme(preference);
}

export function initializeTheme() {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyTheme();
  });
}
