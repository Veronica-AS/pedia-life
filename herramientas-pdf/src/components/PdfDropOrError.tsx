import { ErrorMessage } from './ErrorMessage';
import { FileDropzone } from './FileDropzone';
import { useI18n } from '../i18n/I18nProvider';
import { AppError } from '../lib/errors';

/** Zona para soltar un PDF con su estado de carga y error (patrón común de las herramientas) */
export function PdfDrop({
  onFile,
  loading,
  error,
  setError,
}: {
  onFile: (f: File) => void;
  loading: boolean;
  error: AppError | null;
  setError: (e: AppError | null) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} onFiles={(f) => onFile(f[0])} onRejected={(n) => setError(new AppError('not-pdf', { fileName: n.join(', ') }))} />
      {loading && <p className="text-sm muted">{t('loadingFile')}</p>}
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
    </div>
  );
}

/** Barra inferior fija en celular con la acción principal */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      {children}
    </div>
  );
}
