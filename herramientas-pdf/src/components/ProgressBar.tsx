import { useI18n } from '../i18n/I18nProvider';
import { percent } from '../lib/format';

export function ProgressBar({ value, label, onCancel }: { value: number; label?: string; onCancel?: () => void }) {
  const { t } = useI18n();
  const p = percent(value);
  return (
    <div className="card p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label ?? t('processing')}</span>
        <span className="tabular-nums muted">{p}%</span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label={label ?? t('processing')}
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-200 dark:bg-brand-400" style={{ width: `${p}%` }} />
      </div>
      {onCancel && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t('cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
