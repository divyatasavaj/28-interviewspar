import { useState } from 'react';
import { readTheme, saveTheme } from '../utils/theme.js';

export default function ThemePreference() {
  const [preference, setPreference] = useState(readTheme);
  return <section className="theme-preference">
    <h2>Appearance</h2>
    <label>Workspace theme
      <select value={preference} onChange={event => {
        setPreference(event.target.value);
        saveTheme(event.target.value);
      }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  </section>;
}
