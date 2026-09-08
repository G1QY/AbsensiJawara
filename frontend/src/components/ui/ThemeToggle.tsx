import { usePreferences } from '../../lib/PreferencesContext';
export default function ThemeToggle() {
  const { theme, setTheme } = usePreferences();
  return <button type="button" className="ui-icon" title={theme === 'dark' ? 'Ubah ke tema terang' : 'Ubah ke tema gelap'} aria-label={theme === 'dark' ? 'Ubah ke tema terang' : 'Ubah ke tema gelap'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.5 14A8.5 8.5 0 0110 3.5 8.5 8.5 0 1020.5 14Z" /></svg>}
  </button>;
}
