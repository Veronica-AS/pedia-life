import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/** Diálogo modal nativo (<dialog>): atrapa el foco y se cierra con Escape */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-label={title}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/70 sm:m-auto sm:h-[92vh] sm:w-[min(96vw,1100px)] sm:rounded-2xl"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 sm:rounded-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
            <h2 className="truncate font-semibold">{title}</h2>
            <button type="button" className="btn-icon" onClick={onClose} aria-label={t('close')}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}
