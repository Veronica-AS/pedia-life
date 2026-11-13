import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Faq } from '../components/Faq';
import { ToolIcon } from '../components/icons';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { useI18n } from '../i18n/I18nProvider';
import { useMeta } from '../lib/useMeta';
import { HOME_SEO, toolPath } from '../seo/seo';
import { CATEGORIES, COMMON_FAQ, TOOLS, searchTools, type CategoryId, type ToolDef } from '../tools/registry';

export default function Home() {
  const { t, list, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  useMeta(HOME_SEO.title, HOME_SEO.description);

  const shown = useMemo(() => {
    // Las URL alternativas (p. ej. /jpg-a-pdf) solo aparecen al buscar
    const base = query.trim() ? TOOLS : TOOLS.filter((x) => !x.alias);
    const found = searchTools(query, lang, base);
    const filtered = cat === 'all' ? found : found.filter((x) => x.category === cat);
    return filtered;
  }, [query, cat, lang]);

  return (
    <div>
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{lang === 'es' ? HOME_SEO.h1 : t('appTagline')}</h1>
        <div className="mx-auto mt-4 max-w-xl text-left">
          <PrivacyBadge long />
        </div>
        <form role="search" className="relative mt-5" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="tool-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 muted" aria-hidden="true" />
          <input
            id="tool-search"
            type="search"
            className="input h-14 rounded-2xl pl-12 text-base shadow-sm"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </form>
        <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {list('benefits').map((b) => (
            <li key={b} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm dark:bg-slate-900">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="tools-title">
        <h2 id="tools-title" className="sr-only">
          {t('allTools')}
        </h2>
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label={t('allTools')}>
          {[{ id: 'all' as const, es: t('all'), en: t('all') }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`btn shrink-0 rounded-full px-4 ${cat === c.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {c[lang]}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="py-8 text-center muted" role="status">
            {t('noResults', { q: query })}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-live="polite">
              {shown
                .filter((x) => x.status === 'ready')
                .map((tool) => (
                  <li key={tool.slug}>
                    <ToolCard tool={tool} />
                  </li>
                ))}
            </ul>
            {shown.some((x) => x.status !== 'ready') && (
              <div className="mt-8">
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  {t('soon')}
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                    {shown.filter((x) => x.status !== 'ready').length}
                  </span>
                </h3>
                <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  {shown
                    .filter((x) => x.status !== 'ready')
                    .map((tool) => (
                      <li key={tool.slug} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-2 dark:border-slate-700" aria-disabled="true">
                        <ToolIcon name={tool.icon} className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{tool[lang].name}</span>
                          <span className="block truncate text-xs muted">{tool[lang].short}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-12" aria-labelledby="how-title">
        <h2 id="how-title" className="mb-4 text-xl font-bold">
          {t('howTitle')}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {list('howSteps').map((s, i) => (
            <li key={s} className="card flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
              <span className="font-medium">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <Faq title={t('faqTitle')} items={COMMON_FAQ[lang]} />
    </div>
  );
}

export function ToolCard({ tool }: { tool: ToolDef }) {
  const { t, lang } = useI18n();
  const text = tool[lang];
  const inner = (
    <>
      <span
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${tool.status === 'ready' ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
      >
        <ToolIcon name={tool.icon} className="h-6 w-6" />
      </span>
      <span className="block font-semibold leading-tight">{text.name}</span>
      <span className="mt-1 block text-sm leading-snug muted">{text.short}</span>
      {tool.status !== 'ready' && (
        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{t('soon')}</span>
      )}
    </>
  );
  if (tool.status !== 'ready') {
    return (
      <div className="card h-full p-4 opacity-75" aria-disabled="true">
        {inner}
      </div>
    );
  }
  return (
    <Link to={toolPath(tool.slug)} className="card block h-full p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
      {inner}
    </Link>
  );
}
