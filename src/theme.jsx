import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'kvce.theme';
const ThemeCtx = createContext({ theme: 'light', toggle() {} });
export const useTheme = () => useContext(ThemeCtx);

/** First visit follows the operating-system setting; afterwards the user's choice is remembered. */
function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

/** Colours for chart axes / grid / tooltip that SVG attributes can't take from CSS variables. */
export function useChartTheme() {
  const { theme } = useTheme();
  return theme === 'dark'
    ? {
        grid: '#24334a',
        axis: '#8d99aa',
        tooltipBg: '#162130',
        tooltipBorder: '#2a3748',
        tooltipText: '#e6ebf2',
        cursor: 'rgba(255,255,255,0.05)',
      }
    : {
        grid: '#eef2f7',
        axis: '#64748b',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e2e8f0',
        tooltipText: '#1f2937',
        cursor: 'rgba(43,75,147,0.06)',
      };
}
