import { ChevronRight } from 'lucide-react';
import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Faq } from '../components/Faq';
import { PrivacyBadge } from '../components/PrivacyBadge';
import { useI18n } from '../i18n/I18nProvider';
import { useMeta } from '../lib/useMeta';
import { TOOL_COMPONENTS } from '../tools/components';
import { COMMON_FAQ, findTool, readyTools } from '../tools/registry';
import NotFound from './NotFound';
import { ToolCard } from './Home';

export default function ToolPage() {
  const { slug = '' } = useParams();
  const tool = findTool(slug);
  const { t, lang } = useI18n();
  useMeta(tool ? (lang === 'es' ? tool.es.title : tool.en.title) : 'PDF Libre', tool ? tool[lang].description : '');
  if (!tool || !tool.component) return <NotFound />;
  const text = tool[lang];
  const Component = TOOL_COMPONENTS[tool.component];
  const related = readyTools().filter((x) => !x.alias && x.slug !== tool.slug && x.component !== tool.component).slice(0, 4);

  return (
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex items-center gap-1 muted">
          <li>
            <Link to="/" className="rounded hover:underline">
              {t('home')}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li aria-current="page" className="font-medium text-slate-900 dark:text-slate-100">
            {text.name}
          </li>
        </ol>
      </nav>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{text.h1}</h1>
      <p className="mt-2 muted">{text.intro}</p>
      <div className="mt-4">
        <PrivacyBadge />
      </div>
      <div className="mt-6">
        <Suspense fallback={<div className="h-56 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" aria-busy="true" />}>
          <Component key={tool.slug} tool={tool} preset={tool.preset} />
        </Suspense>
      </div>
      <Faq title={t('faqTitle')} items={[...text.faq, ...COMMON_FAQ[lang]]} />
      <section className="mt-12" aria-labelledby="related-title">
        <h2 id="related-title" className="mb-4 text-xl font-bold">
          {t('relatedTools')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {related.map((r) => (
            <li key={r.slug}>
              <ToolCard tool={r} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
