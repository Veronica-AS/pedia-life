import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { ERROR_TEXT, type AppError } from '../lib/errors';

export function ErrorMessage({ error, onDismiss }: { error: AppError; onDismiss?: () => void }) {
  const { t, lang } = useI18n();
  const text = ERROR_TEXT[lang][error.code] ?? ERROR_TEXT[lang].unknown;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [error]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{text.title}</p>
          {error.fileName && <p className="mt-1 break-all text-sm opacity-80">{t('errorFile', { name: error.fileName })}</p>}
          {error.detail && error.code !== 'unknown' && <p className="mt-1 text-sm">{error.detail}</p>}
          <p className="mt-2 text-sm">{text.fix}</p>
          {onDismiss && (
            <button type="button" className="btn-secondary mt-3" onClick={onDismiss}>
              {t('dismiss')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
