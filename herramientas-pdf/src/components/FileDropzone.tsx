import { Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

export interface FileDropzoneProps {
  /** Extensiones admitidas, con punto: ['.pdf'] */
  accept: string[];
  /** Tipos MIME admitidos (complementa a las extensiones) */
  mimeTypes?: string[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onRejected?: (names: string[]) => void;
  /** Variante pequeña para "Añadir más" */
  compact?: boolean;
  /** Escuchar Ctrl+V en toda la página */
  listenPaste?: boolean;
  formatsLabel?: string;
}

export function matchesAccept(file: File, accept: string[], mimeTypes: string[] = []) {
  const name = file.name.toLowerCase();
  if (accept.some((ext) => name.endsWith(ext))) return true;
  if (file.type && mimeTypes.includes(file.type.toLowerCase())) return true;
  return false;
}

export function FileDropzone({
  accept,
  mimeTypes = [],
  multiple = false,
  onFiles,
  onRejected,
  compact = false,
  listenPaste = true,
  formatsLabel,
}: FileDropzoneProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hintId = useId();

  const handle = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      const ok = files.filter((f) => matchesAccept(f, accept, mimeTypes));
      const bad = files.filter((f) => !ok.includes(f));
      if (bad.length) onRejected?.(bad.map((f) => f.name || 'archivo'));
      if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
    },
    [accept, mimeTypes, multiple, onFiles, onRejected],
  );

  useEffect(() => {
    if (!listenPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const files = e.clipboardData?.files;
      if (files && files.length) {
        e.preventDefault();
        // Las imágenes pegadas no traen nombre útil: se les asigna uno
        const named = Array.from(files).map((f, i) =>
          f.name && f.name !== 'image.png'
            ? f
            : new File([f], `pegado-${Date.now()}-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }),
        );
        handle(named);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handle, listenPaste]);

  const formats = formatsLabel ?? accept.map((a) => a.replace('.', '').toUpperCase()).join(', ');
  const acceptAttr = [...accept, ...mimeTypes].join(',');

  const dragProps = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current++;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      handle(e.dataTransfer.files);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      accept={acceptAttr}
      multiple={multiple}
      data-testid="file-input"
      onChange={(e) => {
        handle(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (compact) {
    return (
      <div {...dragProps} className={dragging ? 'rounded-xl ring-2 ring-brand-500' : ''}>
        {input}
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => inputRef.current?.click()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addMore')}
        </button>
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors sm:py-14 ${
        dragging
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40'
          : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      {input}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Upload className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="text-lg font-semibold">
        {dragging ? t('dropActive') : multiple ? t('dropTitleMany') : t('dropTitleOne')}
      </p>
      <p className="my-2 text-sm muted">{t('dropOr')}</p>
      <button type="button" className="btn-primary px-6 text-base" onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
        {multiple ? t('chooseMany') : t('choose')}
      </button>
      <p id={hintId} className="mt-4 text-xs muted">
        {t('dropAccepted', { formats })}
        <span className="hidden sm:inline"> · {t('dropPaste')}</span>
      </p>
    </div>
  );
}
