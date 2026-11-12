import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '../i18n/I18nProvider';

/** Avisa cuando la app ya funciona sin conexión o hay una versión nueva */
export function PwaToast() {
  const { t } = useI18n();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!offlineReady && !needRefresh) return null;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
      <span className="flex-1">{needRefresh ? t('updateAvailable') : t('offlineReady')}</span>
      {needRefresh && (
        <button type="button" className="btn rounded-lg bg-brand-500 px-3 text-white" onClick={() => updateServiceWorker(true)}>
          {t('update')}
        </button>
      )}
      <button type="button" className="btn rounded-lg px-3" onClick={close}>
        {t('close')}
      </button>
    </div>
  );
}
