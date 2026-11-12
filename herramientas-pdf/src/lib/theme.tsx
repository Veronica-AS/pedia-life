import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'pdflibre.theme';

const Ctx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({ pref: 'system', setPref: () => {} });

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignorado */
  }
  return 'system';
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#ffffff');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(read);
  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [pref]);
  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* ignorado */
    }
  };
  return <Ctx.Provider value={{ pref, setPref }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
