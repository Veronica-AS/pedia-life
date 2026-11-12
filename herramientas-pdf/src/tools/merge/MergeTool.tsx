import { ArrowDown, ArrowUp, FileText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { SortableItem, SortableList } from '../../components/Sortable';
import { useI18n } from '../../i18n/I18nProvider';
import { fileToBytes, type OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { formatBytes } from '../../lib/format';
import { openPdf } from '../../lib/pdfjs';
import { renderToUrl } from '../../lib/thumbs';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks, pdfTasks } from '../../workers/client';
import type { ToolProps } from '../types';

interface Item {
  id: string;
  name: string;
  bytes: Uint8Array;
  pages: number;
  thumb?: string;
}

let seq = 0;

export default function MergeTool(_: ToolProps) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(0);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();
  const thumbsRef = useRef<string[]>([]);

  useEffect(() => () => thumbsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = async (files: File[]) => {
    setErrors([]);
    setLoading((n) => n + files.length);
    const newErrors: AppError[] = [];
    for (const file of files) {
      try {
        const bytes = await fileToBytes(file);
        await pdfTasks.validate(bytes, file.name);
        const doc = await openPdf(bytes, file.name);
        let thumb: string | undefined;
        try {
          thumb = (await renderToUrl(doc, 1, 120)).url;
          thumbsRef.current.push(thumb);
        } catch {
          /* sin miniatura */
        }
        const item: Item = { id: `f${++seq}`, name: file.name, bytes, pages: doc.numPages, thumb };
        await doc.destroy();
        setItems((prev) => [...prev, item]);
      } catch (err) {
        newErrors.push(toAppError(err, file.name));
      } finally {
        setLoading((n) => n - 1);
      }
    }
    setErrors(newErrors);
  };

  const move = (i: number, d: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const merge = async () => {
    const out = await task.run(
      (onProgress) => pdfTasks.merge(items.map((i) => ({ name: i.name, bytes: i.bytes })), onProgress),
      { onCancel: cancelWorkerTasks },
    );
    if (out) setResult({ name: 'documento-unido.pdf', bytes: out, type: 'application/pdf' });
  };

  const reset = () => {
    setItems([]);
    setResult(null);
    setErrors([]);
  };

  if (result) {
    return (
      <ResultPanel files={[result]} zipName="documento-unido.zip" onBack={() => setResult(null)} onReset={reset}>
        <PdfPreview bytes={result.bytes} />
      </ResultPanel>
    );
  }

  const totalPages = items.reduce((s, i) => s + i.pages, 0);
  const totalSize = items.reduce((s, i) => s + i.bytes.length, 0);
  const rejectedError = (names: string[]) =>
    setErrors([new AppError('not-pdf', { fileName: names.join(', ') })]);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} multiple onFiles={addFiles} onRejected={rejectedError} />
      ) : (
        <>
          <p className="text-sm muted">{t('mergeOrderHint')}</p>
          <SortableList items={items} onReorder={setItems} layout="list" className="space-y-2" describe={(it) => it.name}>
            {items.map((it, i) => (
              <SortableItem key={it.id} id={it.id} handleLabel={`${t('moveUp')}/${t('moveDown')}: ${it.name}`} className="card flex items-center gap-2 p-2 pr-1">
                {(handle) => (
                  <>
                    {handle}
                    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                      {it.thumb ? <img src={it.thumb} alt="" className="max-h-full max-w-full bg-white" /> : <FileText className="h-6 w-6 muted" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={it.name}>
                        <span className="mr-1 tabular-nums muted">{i + 1}.</span>
                        {it.name}
                      </p>
                      <p className="text-xs muted">
                        {t('pages', { n: it.pages })} · {formatBytes(it.bytes.length, lang)}
                      </p>
                    </div>
                    <button type="button" className="btn-icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t('moveUp')}: ${it.name}`}>
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-icon-sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`${t('moveDown')}: ${it.name}`}>
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-icon-sm" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} aria-label={`${t('remove')}: ${it.name}`}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </SortableItem>
            ))}
          </SortableList>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FileDropzone compact accept={['.pdf']} mimeTypes={['application/pdf']} multiple onFiles={addFiles} onRejected={rejectedError} />
            <p className="text-sm muted" data-testid="merge-total">
              {t('mergeTotal', { pages: totalPages, size: formatBytes(totalSize, lang) })}
            </p>
          </div>
        </>
      )}

      {loading > 0 && <p className="text-sm muted" aria-live="polite">{t('loadingFile')}</p>}
      {errors.map((e, i) => (
        <ErrorMessage key={i} error={e} onDismiss={() => setErrors((prev) => prev.filter((x) => x !== e))} />
      ))}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}

      {task.running ? (
        <ProgressBar value={task.progress} label={task.label ? `${t('processing')} ${task.label}` : undefined} onCancel={task.cancel} />
      ) : (
        items.length > 0 && (
          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            {items.length < 2 && <p className="mb-2 text-sm muted">{t('mergeNeedTwo')}</p>}
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={items.length < 2 || loading > 0} onClick={merge}>
              {t('mergeAction', { n: items.length })}
            </button>
          </div>
        )
      )}
    </div>
  );
}
