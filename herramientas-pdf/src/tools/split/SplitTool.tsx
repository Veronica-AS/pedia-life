import { Check, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { OptionGroup } from '../../components/OptionGroup';
import { PdfPreview } from '../../components/PdfPreview';
import { PdfThumb } from '../../components/PdfThumb';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useI18n } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { AppError, ERROR_TEXT } from '../../lib/errors';
import { baseName, formatBytes } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks, pdfTasks } from '../../workers/client';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { chunkPages, describeGroup, parseRanges, rangeToIndices } from './ranges';
import { FileHeader } from '../FileHeader';

type Mode = 'ranges' | 'every' | 'extract';

export default function SplitTool(_: ToolProps) {
  const { t, lang } = useI18n();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [mode, setMode] = useState<Mode>('ranges');
  const [rangeText, setRangeText] = useState('');
  const [every, setEvery] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const task = useTask();

  useEffect(() => {
    if (!pdf) return;
    const n = pdf.pages;
    const half = Math.ceil(n / 2);
    setRangeText(n > 1 ? `1-${half}${half + 1 <= n ? `, ${half + 1}${half + 1 < n ? `-${n}` : ''}` : ''}` : '1');
    setSelected(new Set());
    setEvery(1);
    setResult(null);
  }, [pdf]);

  const plan = useMemo((): { groups: number[][]; error: AppError | null } => {
    if (!pdf) return { groups: [], error: null };
    try {
      if (mode === 'ranges') return { groups: parseRanges(rangeText, pdf.pages).map(rangeToIndices), error: null };
      if (mode === 'every') return { groups: chunkPages(pdf.pages, every || 1), error: null };
      const sel = [...selected].sort((a, b) => a - b);
      return { groups: sel.length ? [sel] : [], error: null };
    } catch (err) {
      return { groups: [], error: err as AppError };
    }
  }, [pdf, mode, rangeText, every, selected]);

  const reset = () => {
    clear();
    setResult(null);
  };

  if (!pdf) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} onFiles={(f) => load(f[0])} onRejected={(n) => setError(new AppError('not-pdf', { fileName: n.join(', ') }))} />
        {loading && <p className="text-sm muted">{t('loadingFile')}</p>}
        {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  const base = baseName(pdf.name);

  if (result) {
    const current = result[Math.min(previewIdx, result.length - 1)];
    return (
      <ResultPanel files={result} zipName={`${base}-dividido.zip`} onBack={() => setResult(null)} onReset={reset}>
        {result.length > 1 && (
          <ul className="mb-4 max-h-64 space-y-1 overflow-auto" aria-label={t('previewTitle')}>
            {result.map((f, i) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() => setPreviewIdx(i)}
                  aria-current={i === previewIdx}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === previewIdx ? 'bg-brand-50 font-semibold dark:bg-brand-950/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="muted">{formatBytes(f.bytes.length, lang)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <PdfPreview key={current.name} bytes={current.bytes} maxPages={60} />
      </ResultPanel>
    );
  }

  const run = async () => {
    const groups = plan.groups;
    const out = await task.run((onProgress) => pdfTasks.split(pdf.bytes, groups, onProgress), { onCancel: cancelWorkerTasks });
    if (!out) return;
    setPreviewIdx(0);
    setResult(
      out.map((bytes, i) => {
        const g = groups[i];
        const label = g.length === 1 ? `pagina-${g[0] + 1}` : `paginas-${describeGroup(g).replace(/, /g, '_')}`;
        return { name: `${base}-${label}.pdf`, bytes, type: 'application/pdf' };
      }),
    );
  };

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={reset} />

      <OptionGroup<Mode>
        label={t('splitMode')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'ranges', label: t('splitRanges') },
          { value: 'every', label: t('splitEvery') },
          { value: 'extract', label: t('splitExtract') },
        ]}
      />

      {mode === 'ranges' && (
        <div>
          <label htmlFor="ranges" className="label">
            {t('splitRangesLabel')}
          </label>
          <input
            id="ranges"
            className="input"
            inputMode="text"
            autoComplete="off"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            aria-describedby="ranges-hint"
            aria-invalid={!!plan.error}
          />
          <p id="ranges-hint" className={`mt-1 text-sm ${plan.error ? 'text-red-700 dark:text-red-400' : 'muted'}`} role={plan.error ? 'alert' : undefined}>
            {plan.error ? `${ERROR_TEXT[lang]['invalid-range'].title}. ${plan.error.detail ?? ''}` : t('splitRangesHint')}
          </p>
        </div>
      )}

      {mode === 'every' && (
        <div>
          <label htmlFor="every" className="label">
            {t('splitEveryLabel')}
          </label>
          <input
            id="every"
            type="number"
            min={1}
            max={pdf.pages}
            className="input max-w-[10rem]"
            value={every}
            onChange={(e) => setEvery(Math.max(1, Math.min(pdf.pages, parseInt(e.target.value, 10) || 1)))}
          />
          <p className="mt-1 text-sm muted">{t('splitEveryHint', { n: every })}</p>
        </div>
      )}

      {mode === 'extract' && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm muted">{t('splitExtractHint')}</p>
            <button type="button" className="btn-ghost" onClick={() => setSelected(new Set(Array.from({ length: pdf.pages }, (_, i) => i)))}>
              {t('splitSelectAll')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>
              {t('splitSelectNone')}
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: pdf.pages }, (_, i) => {
              const on = selected.has(i);
              return (
                <li key={i}>
                  <label className={`relative block cursor-pointer rounded-xl border-2 p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${on ? 'border-brand-600 dark:border-brand-400' : 'border-transparent'}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(i)} aria-label={t('page', { n: i + 1 })} />
                    <PdfThumb doc={pdf.doc} pageNumber={i + 1} alt="" width={120} />
                    <span className="mt-1 block text-center text-xs tabular-nums">{i + 1}</span>
                    {on && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm muted" aria-live="polite">
            {t('splitSelected', { n: selected.size })}
          </p>
        </div>
      )}

      {plan.groups.length > 0 && mode !== 'extract' && (
        <div>
          <p className="label" aria-live="polite">
            {t('splitWillCreate', { n: plan.groups.length })}
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {plan.groups.slice(0, 24).map((g, i) => (
              <li key={i} className="text-center">
                <PdfThumb doc={pdf.doc} pageNumber={g[0] + 1} alt="" width={110} />
                <span className="mt-1 block text-xs muted">{t('splitFile', { i: i + 1, pages: describeGroup(g) })}</span>
              </li>
            ))}
          </ul>
          {plan.groups.length > 24 && <p className="mt-2 text-sm muted">+{plan.groups.length - 24}</p>}
        </div>
      )}

      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {task.running ? (
        <ProgressBar value={task.progress} onCancel={task.cancel} />
      ) : (
        <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!plan.groups.length} onClick={run}>
          {t('splitAction')}
        </button>
      )}
    </div>
  );
}
