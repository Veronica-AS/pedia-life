import { History, Monitor, Moon, Sun } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme, type ThemePref } from '../lib/theme';
import { readyTools } from '../tools/registry';
import { toolPath } from '../seo/seo';
import { PwaToast } from './PwaToast';

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand-600 dark:fill-brand-500" />
      <path d="M10 7h8l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="#fff" />
      <path d="M18 7v5h5" fill="none" stroke="#bcdaff" strokeWidth="1.5" />
      <path d="M12.5 19.5l2.5 2.5 4.5-5" fill="none" stroke="#1d5cf1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Layout() {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const ThemeIcon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  const themeLabel = pref === 'dark' ? t('themeDark') : pref === 'light' ? t('themeLight') : t('themeSystem');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 rounded-lg font-bold" aria-label={`PDF Libre, ${t('home')}`}>
            <Logo />
            <span className="text-lg">PDF Libre</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/historial" className="btn-icon" aria-label={lang === 'es' ? 'Historial local' : 'Local history'} title={lang === 'es' ? 'Historial local' : 'Local history'}>
              <History className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="btn-icon text-sm font-bold"
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              aria-label={`${t('language')}: ${lang === 'es' ? 'Español' : 'English'}. ${lang === 'es' ? 'Switch to English' : 'Cambiar a español'}`}
            >
              {lang === 'es' ? 'ES' : 'EN'}
            </button>
            <button type="button" className="btn-icon" onClick={() => setPref(NEXT_THEME[pref])} aria-label={themeLabel} title={themeLabel}>
              <ThemeIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <nav aria-label={t('allTools')}>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {readyTools().map((tool) => (
                <li key={tool.slug}>
                  <Link className="rounded hover:underline" to={toolPath(tool.slug)}>
                    {tool[lang].name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-6 muted">🔒 {t('privacy')}. {t('footerNote')}</p>
        </div>
      </footer>
      <PwaToast />
    </div>
  );
}
