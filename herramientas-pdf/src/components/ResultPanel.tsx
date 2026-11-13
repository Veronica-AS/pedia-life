import { CheckCircle2, Download, RotateCcw, Undo2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { downloadBlob, makeZip, type OutputFile } from '../lib/download';
import { formatBytes } from '../lib/format';

/**
 * Pantalla de resultado: resumen, vista previa y UN solo botón de descarga.
 * Varios archivos → se descargan juntos en un ZIP.
 */
export function ResultPanel({
  files,
  zipName,
  children,
  onBack,
  onReset,
  note,
}: {
  files: OutputFile[];
  zipName: string;
  children?: ReactNode;
  onBack?: () => void;
  onReset: () => void;
  note?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const total = files.reduce((s, f) => s + f.bytes.length, 0);
  const single = files.length === 1;
  const isPdf = single && files[0].type === 'application/pdf';

  const download = () => {
    if (single) downloadBlob(new Blob([files[0].bytes], { type: files[0].type }), files[0].name);
    else downloadBlob(new Blob([makeZip(files)], { type: 'application/zip' }), zipName);
  };

  return (
    <section className="space-y-4" aria-labelledby="result-title">
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="result-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold">
              {t('resultReady')}
            </h2>
            <p className="mt-1 break-all text-sm muted" data-testid="result-summary">
              {single
                ? t('resultSummary', { name: files[0].name, size: formatBytes(total, lang) })
                : t('resultSummary', { name: zipName, size: formatBytes(total, lang) })}
            </p>
          </div>
        </div>
        {note && <div className="mt-3">{note}</div>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8" onClick={download} data-testid="download">
            <Download className="h-5 w-5" aria-hidden="true" />
            {single ? (isPdf ? t('downloadPdf') : t('download')) : t('downloadZip', { n: files.length })}
          </button>
          {onBack && (
            <button type="button" className="btn-secondary" onClick={onBack}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              {t('backToEdit')}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('startOver')}
          </button>
        </div>
      </div>
      {children && (
        <div className="card p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">{t('previewTitle')}</h3>
          {children}
        </div>
      )}
    </section>
  );
}
