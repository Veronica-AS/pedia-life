import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

export default function NotFound() {
  const { lang, t } = useI18n();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">{lang === 'es' ? 'No encontramos esta página' : 'Page not found'}</h1>
      <p className="mt-2 muted">{lang === 'es' ? 'Puede que el enlace esté mal escrito o que la herramienta aún no esté disponible.' : 'The link may be wrong or the tool is not available yet.'}</p>
      <Link to="/" className="btn-primary mt-6">
        {t('allTools')}
      </Link>
    </div>
  );
}
