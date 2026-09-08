import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Theme = 'light' | 'dark';
const THEME_KEY = 'fotosnaps_theme';
const ALERTS_KEY = 'fotosnaps_notification_badges';
const safeRead = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const PreferencesContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; badges: boolean; setBadges: (enabled: boolean) => void } | null>(null);
export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => safeRead(THEME_KEY) === 'dark' ? 'dark' : 'light');
  const [badges, setBadges] = useState(() => safeRead(ALERTS_KEY) !== 'false');
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem(ALERTS_KEY, String(badges)); } catch {} }, [badges]);
  return <PreferencesContext.Provider value={{ theme, setTheme, badges, setBadges }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error('PreferencesProvider belum terpasang.'); return value; }
