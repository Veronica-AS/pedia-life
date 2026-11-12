import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export function PrivacyBadge({ long = false }: { long?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
      role="note"
    >
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <div>
        <p className="font-semibold">{t('privacy')}</p>
        {long && <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200/80">{t('privacyLong')}</p>}
      </div>
    </div>
  );
}
