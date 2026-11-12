import { FileText } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatBytes } from '../lib/format';

/** Tarjeta con el archivo cargado y el botón para cambiarlo */
export function FileHeader({ name, pages, size, onChange }: { name: string; pages: number; size: number; onChange: () => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={name}>
          {name}
        </p>
        <p className="text-sm muted" data-testid="file-info">
          {t('pagesLong', { n: pages })} · {formatBytes(size, lang)}
        </p>
      </div>
      <button type="button" className="btn-ghost" onClick={onChange}>
        {t('startOver')}
      </button>
    </div>
  );
}
