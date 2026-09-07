import { createContext, useContext, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'opencai_theme';
export const THEME_OPTIONS = ['light', 'dark', 'device'];

const ThemeContext = createContext(null);

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'device' && prefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || 'device',
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme !== 'device') return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('device');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
