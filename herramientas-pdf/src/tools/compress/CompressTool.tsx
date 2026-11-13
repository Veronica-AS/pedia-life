import { AlertTriangle, Download, Info } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PageViewer } from '../../components/PageViewer';
import { PdfThumb } from '../../components/PdfThumb';
import { ProgressBar } from '../../components/ProgressBar';
import { usePdfDoc } from '../../components/usePdfDoc';
import { useI18n } from '../../i18n/I18nProvider';
import { downloadBlob } from '../../lib/download';
import { AppError, ERROR_TEXT, toAppError } from '../../lib/errors';
import { baseName, formatBytes } from '../../lib/format';
import type { PDFDocumentProxy } from '../../lib/pdfjs';
import { pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { LEVELS, type CompressStats, type LevelId } from './levels';

type Choice = LevelId | 'max';

interface LevelResult {
  bytes: Uint8Array;
  stats: CompressStats;
}

type Entry = { state: 'pending'; progress: number } | { state: 'done'; result: LevelResult } | { state: 'error'; error: AppError };

/** A partir de este tamaño solo se calcula el nivel elegido (ahorra memoria en celulares) */
const PRECOMPUTE_LIMIT = 60 * 1024 * 1024;

export default function CompressTool(_: ToolProps) {
  const { t, lang } = useI18n();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [choice, setChoice] = useState<Choice>('recommended');
  const [entries, setEntries] = useState<Partial<Record<Choice, Entry>>>({});
  const gen = useRef(0);
  const abortMax = useRef<AbortController | null>(null);
  /** Niveles ya iniciados para el archivo actual (evita calcular dos veces el mismo) */
  const started = useRef(new Set<Choice>());

  const compute = useCallback(
    async (level: Choice, bytes: Uint8Array, g: number) => {
      if (started.current.has(level)) return;
      started.current.add(level);
      const update = (e: Entry) => gen.current === g && setEntries((prev) => ({ ...prev, [level]: e }));
      update({ state: 'pending', progress: 0 });
      // Los avisos de progreso del Worker pueden llegar después del resultado: se ignoran
      let finished = false;
      const onProgress = (p: number) => !finished && update({ state: 'pending', progress: p });
      try {
        let result: LevelResult;
        if (level === 'max') {
          abortMax.current?.abort();
          const ctrl = new AbortController();
          abortMax.current = ctrl;
          const { rasterizePdf } = await import('./rasterize');
          const out = await rasterizePdf(bytes, onProgress, ctrl.signal);
          const smaller = out.length < bytes.length;
          result = {
            bytes: smaller ? out : bytes,
            stats: { images: 0, recompressed: 0, originalSize: bytes.length, finalSize: smaller ? out.length : bytes.length },
          };
        } else {
          result = await pdfTasks.compress(bytes, LEVELS[level], onProgress);
        }
        finished = true;
        update({ state: 'done', result });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          started.current.delete(level);
          return;
        }
        finished = true;
        console.error(err);
        update({ state: 'error', error: toAppError(err) });
      }
    },
    [],
  );

  // Al cargar un archivo: calcula el nivel recomendado y luego los demás en segundo plano
  useEffect(() => {
    const g = ++gen.current;
    started.current = new Set();
    setEntries({});
    setChoice('recommended');
    if (!pdf) return;
    (async () => {
      const order: LevelId[] = pdf.bytes.length > PRECOMPUTE_LIMIT ? ['recommended'] : ['recommended', 'light', 'strong'];
      for (const level of order) {
        if (gen.current !== g) return;
        await compute(level, pdf.bytes, g);
      }
    })();
    return () => {
      abortMax.current?.abort();
    };
  }, [pdf, compute]);

  const select = (c: Choice) => {
    setChoice(c);
    if (pdf) compute(c, pdf.bytes, gen.current);
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

  const original = pdf.bytes.length;
  const current = entries[choice];
  const done = current?.state === 'done' ? current.result : null;
  const gain = done ? 1 - done.stats.finalSize / original : 0;
  const noGain = !!done && done.stats.finalSize >= original;

  const levelLabel = (c: Choice) => {
    const e = entries[c];
    if (!e) return null;
    if (e.state === 'pending') return <span className="mt-1 text-xs muted" data-testid={`size-${c}`}>{t('calculating')}</span>;
    if (e.state === 'error') return <span className="mt-1 text-xs text-red-700 dark:text-red-400" data-testid={`size-${c}`}>{ERROR_TEXT[lang][e.error.code].title}</span>;
    const size = e.result.stats.finalSize;
    const p = Math.round((1 - size / original) * 100);
    return (
      <span className="mt-1 text-xs font-semibold tabular-nums" data-testid={`size-${c}`}>
        {size < original ? `${formatBytes(size, lang)} (${t('saved', { p })})` : t('noGain')}
      </span>
    );
  };

  const options: { value: Choice; label: string; desc: string }[] = [
    { value: 'light', label: t('levelLight'), desc: t('levelLightDesc') },
    { value: 'recommended', label: t('levelRecommended'), desc: t('levelRecommendedDesc') },
    { value: 'strong', label: t('levelStrong'), desc: t('levelStrongDesc') },
    { value: 'max', label: t('levelMax'), desc: t('levelMaxDesc') },
  ];

  const fileName = `${baseName(pdf.name)}-comprimido.pdf`;

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={original} onChange={clear} />

      <fieldset>
        <legend className="label">{t('compressLevel')}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const checked = o.value === choice;
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer flex-col rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
                  checked ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/50' : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <input type="radio" name="level" className="sr-only" checked={checked} onChange={() => select(o.value)} />
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{o.label}</span>
                  {levelLabel(o.value)}
                </span>
                <span className="mt-0.5 text-sm muted">{o.desc}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {choice === 'max' && (
        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="note">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t('maxWarning')}
        </p>
      )}

      {current?.state === 'pending' && <ProgressBar value={current.progress} label={t('calculating')} />}
      {current?.state === 'error' && <ErrorMessage error={current.error} />}

      {done && (
        <>
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm muted">{t('sizeBefore')}</p>
                <p className="text-xl font-bold tabular-nums">{formatBytes(original, lang)}</p>
              </div>
              <div>
                <p className="text-sm muted">{t('sizeAfter')}</p>
                <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400" data-testid="size-after">
                  {formatBytes(done.stats.finalSize, lang)}
                  {!noGain && <span className="ml-2 text-base">{t('saved', { p: Math.round(gain * 100) })}</span>}
                </p>
              </div>
            </div>
            {choice !== 'max' && done.stats.images > 0 && (
              <p className="mt-2 text-center text-xs muted">{t('imagesInfo', { r: done.stats.recompressed, t: done.stats.images })}</p>
            )}
            {noGain && (
              <p className="mt-3 flex gap-2 text-sm muted" role="note">
                <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
                {t('noGainExplain')}
              </p>
            )}
            <button
              type="button"
              className="btn-primary mt-4 w-full py-3 text-base"
              data-testid="download"
              onClick={() => downloadBlob(new Blob([done.bytes], { type: 'application/pdf' }), noGain ? pdf.name : fileName)}
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {t('downloadPdf')} · {formatBytes(done.stats.finalSize, lang)}
            </button>
          </div>
          <Compare originalDoc={pdf.doc} resultBytes={done.bytes} pages={pdf.pages} />
        </>
      )}
    </div>
  );
}

/** Comparación lado a lado del original y el resultado */
function Compare({ originalDoc, resultBytes, pages }: { originalDoc: PDFDocumentProxy; resultBytes: Uint8Array; pages: number }) {
  const { t } = useI18n();
  const { doc } = usePdfDoc(resultBytes);
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState<{ which: 'o' | 'c'; page: number } | null>(null);
  return (
    <section className="card p-4" aria-labelledby="compare-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="compare-title" className="font-semibold">
          {t('compareTitle')}
        </h2>
        {pages > 1 && (
          <label className="flex items-center gap-2 text-sm">
            {t('page', { n: '' }).trim()}
            <select className="input w-auto py-1" value={page} onChange={(e) => setPage(+e.target.value)}>
              {Array.from({ length: pages }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="mb-3 text-sm muted">{t('compareHint')}</p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['o', originalDoc, t('original')],
            ['c', doc, t('compressed')],
          ] as const
        ).map(([key, d, label]) => (
          <button key={key} type="button" className="rounded-xl text-left" disabled={!d} onClick={() => setViewer({ which: key, page })}>
            <span className="mb-1 block text-center text-sm font-semibold">{label}</span>
            <PdfThumb key={`${key}-${page}-${d ? 1 : 0}`} doc={d} pageNumber={page} alt={`${label}, ${t('page', { n: page })}`} width={420} className="aspect-[3/4]" />
          </button>
        ))}
      </div>
      {viewer && (viewer.which === 'o' ? originalDoc : doc) && (
        <PageViewer
          doc={(viewer.which === 'o' ? originalDoc : doc)!}
          page={viewer.page}
          title={`${viewer.which === 'o' ? t('original') : t('compressed')} · ${t('page', { n: viewer.page })}`}
          onPageChange={(p) => setViewer({ ...viewer, page: p })}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
