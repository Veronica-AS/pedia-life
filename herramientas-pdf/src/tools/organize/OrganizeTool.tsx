import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PdfPreview } from '../../components/PdfPreview';
import { PdfThumb } from '../../components/PdfThumb';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { SortableItem, SortableList } from '../../components/Sortable';
import { useI18n } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { AppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks, pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { normRotation } from './rotation';

interface PageItem {
  id: string;
  index: number;
  rotation: number;
  deleted: boolean;
}

const initial = (n: number): PageItem[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, index: i, rotation: 0, deleted: false }));

export default function OrganizeTool({ preset }: ToolProps) {
  const { t } = useI18n();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [pages, setPages] = useState<PageItem[]>([]);
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();

  useEffect(() => {
    setPages(pdf ? initial(pdf.pages) : []);
    setResult(null);
  }, [pdf]);

  if (!pdf) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} onFiles={(f) => load(f[0])} onRejected={(n) => setError(new AppError('not-pdf', { fileName: n.join(', ') }))} />
        {loading && <p className="text-sm muted">{t('loadingFile')}</p>}
        {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={clear}>
        <PdfPreview bytes={result.bytes} />
      </ResultPanel>
    );
  }

  const update = (id: string, fn: (p: PageItem) => PageItem) => setPages((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  const rotate = (id: string, d: number) => update(id, (p) => ({ ...p, rotation: normRotation(p.rotation + d) }));
  const rotateAll = (d: number) => setPages((prev) => prev.map((p) => ({ ...p, rotation: normRotation(p.rotation + d) })));
  const move = (i: number, d: -1 | 1) =>
    setPages((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const kept = pages.filter((p) => !p.deleted);
  const changed = pages.some((p, i) => p.deleted || p.rotation || p.index !== i);

  const apply = async () => {
    const plan = kept.map((p) => ({ index: p.index, rotation: p.rotation }));
    const out = await task.run((onProgress) => pdfTasks.organize(pdf.bytes, plan, onProgress), { onCancel: cancelWorkerTasks });
    if (out) setResult({ name: `${baseName(pdf.name)}-organizado.pdf`, bytes: out, type: 'application/pdf' });
  };

  return (
    <div className="space-y-4">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      <p className="text-sm muted">{t('organizeHint')}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={preset?.focus === 'rotate' ? 'btn-primary' : 'btn-secondary'} onClick={() => rotateAll(-90)}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('rotateAllLeft')}
        </button>
        <button type="button" className={preset?.focus === 'rotate' ? 'btn-primary' : 'btn-secondary'} onClick={() => rotateAll(90)}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {t('rotateAllRight')}
        </button>
        <button type="button" className="btn-ghost" disabled={!changed} onClick={() => setPages(initial(pdf.pages))}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          {t('resetChanges')}
        </button>
      </div>

      <SortableList
        items={pages}
        onReorder={setPages}
        className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
        describe={(p) => t('page', { n: p.index + 1 })}
      >
        {pages.map((p, i) => (
          <SortableItem key={p.id} id={p.id} handleLabel={t('page', { n: p.index + 1 })} className={`card relative p-2 ${p.deleted ? 'opacity-50' : ''}`}>
            {(handle) => (
              <div data-testid="page-card">
                <div className="mb-1 flex items-center justify-between">
                  {handle}
                  <span className="text-xs font-semibold tabular-nums">{p.index + 1}</span>
                </div>
                <div className="relative">
                  <PdfThumb doc={pdf.doc} pageNumber={p.index + 1} rotation={p.rotation} alt={t('pageThumbLabel', { n: p.index + 1, deg: p.rotation })} width={150} />
                  {p.deleted && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">{t('deleted')}</span>
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                  <button type="button" className="btn-icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t('moveLeft')}: ${t('page', { n: p.index + 1 })}`}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon-sm" onClick={() => rotate(p.id, -90)} disabled={p.deleted} aria-label={`${t('rotateLeft')}: ${t('page', { n: p.index + 1 })}`}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon-sm" onClick={() => rotate(p.id, 90)} disabled={p.deleted} aria-label={`${t('rotateRight')}: ${t('page', { n: p.index + 1 })}`}>
                    <RotateCw className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`btn-icon-sm ${p.deleted ? '' : 'text-red-600 dark:text-red-400'}`}
                    onClick={() => update(p.id, (x) => ({ ...x, deleted: !x.deleted }))}
                    aria-label={`${p.deleted ? t('restorePage') : t('deletePage')}: ${t('page', { n: p.index + 1 })}`}
                    aria-pressed={p.deleted}
                  >
                    {p.deleted ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button type="button" className="btn-icon-sm" onClick={() => move(i, 1)} disabled={i === pages.length - 1} aria-label={`${t('moveRight')}: ${t('page', { n: p.index + 1 })}`}>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </SortableItem>
        ))}
      </SortableList>

      {kept.length === 0 && <ErrorMessage error={new AppError('no-pages')} />}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {task.running ? (
          <ProgressBar value={task.progress} onCancel={task.cancel} />
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8" disabled={!kept.length || !changed} onClick={apply}>
              {t('organizeAction')}
            </button>
            <span className="text-sm muted" aria-live="polite">
              {t('organizeSummary', { n: kept.length, total: pdf.pages })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
