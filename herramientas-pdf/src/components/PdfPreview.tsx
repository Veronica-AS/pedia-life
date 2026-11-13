import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { PdfThumb } from './PdfThumb';
import { PageViewer } from './PageViewer';
import { usePdfDoc } from './usePdfDoc';
import { ErrorMessage } from './ErrorMessage';

/** Vista previa del PDF resultante: todas sus páginas en miniatura, ampliables */
export function PdfPreview({ bytes, maxPages, password }: { bytes: Uint8Array; maxPages?: number; password?: string }) {
  const { t } = useI18n();
  const { doc, error } = usePdfDoc(bytes, undefined, password);
  const [open, setOpen] = useState<number | null>(null);
  if (error) return <ErrorMessage error={error} />;
  if (!doc) return <p className="muted text-sm">{t('loadingPreview')}</p>;
  const count = maxPages ? Math.min(maxPages, doc.numPages) : doc.numPages;
  return (
    <div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" data-testid="result-preview">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button type="button" className="block w-full rounded-lg text-left" onClick={() => setOpen(i + 1)} aria-label={t('enlarge', { n: i + 1 })}>
              <PdfThumb doc={doc} pageNumber={i + 1} alt="" width={140} />
              <span className="mt-1 block text-center text-xs muted tabular-nums">{i + 1}</span>
            </button>
          </li>
        ))}
      </ul>
      {count < doc.numPages && <p className="mt-2 text-sm muted">+{doc.numPages - count}</p>}
      <PageViewer doc={doc} page={open} onPageChange={setOpen} onClose={() => setOpen(null)} />
    </div>
  );
}
