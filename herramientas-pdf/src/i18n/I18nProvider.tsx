import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS, type StringKey } from './strings';
import type { Lang } from '../tools/registry';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  list: (key: StringKey) => readonly string[];
}

const Ctx = createContext<I18n | null>(null);

const STORAGE_KEY = 'pdflibre.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* almacenamiento bloqueado */
  }
  // Español primero: solo se usa inglés si el navegador lo pide explícitamente
  if (typeof navigator !== 'undefined' && /^en\b/i.test(navigator.language) && !navigator.languages?.some((l) => /^es\b/i.test(l))) {
    return 'en';
  }
  return 'es';
}

export function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => {
        const v = STRINGS[lang][key] ?? STRINGS.es[key];
        return interpolate(typeof v === 'string' ? v : String(v), vars);
      },
      list: (key) => {
        const v = STRINGS[lang][key];
        return Array.isArray(v) ? v : [];
      },
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n fuera de I18nProvider');
  return v;
}

/** Texto en línea con su traducción: L('Posición', 'Position') */
export function useL() {
  const { lang } = useI18n();
  return useCallback((es: string, en: string, vars?: Record<string, string | number>) => interpolate(lang === 'es' ? es : en, vars), [lang]);
}
