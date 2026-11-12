import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { Modal } from '../../components/Modal';
import { OptionGroup } from '../../components/OptionGroup';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useI18n } from '../../i18n/I18nProvider';
import { AppError, ERROR_TEXT } from '../../lib/errors';
import { baseName, formatBytes } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { FileHeader } from '../FileHeader';
import { parseRanges, rangeToIndices } from '../split/ranges';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { pdfToImages, type ImageFormat, type PdfToImagesResult } from './pdfToImages';

type Dpi = '72' | '150' | '300';

export default function PdfToImagesTool({ preset }: ToolProps) {
  const { t, lang } = useI18n();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [format, setFormat] = useState<ImageFormat>(preset?.format === 'png' ? 'png' : 'jpg');
  const [dpi, setDpi] = useState<Dpi>('150');
  const [quality, setQuality] = useState(90);
  const [which, setWhich] = useState<'all' | 'some'>('all');
  const [rangeText, setRangeText] = useState('1');
  const [result, setResult] = useState<PdfToImagesResult | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const task = useTask();

  useEffect(() => {
    setResult(null);
    setWhich('all');
    setRangeText(pdf && pdf.pages > 1 ? `1-${Math.min(3, pdf.pages)}` : '1');
  }, [pdf]);

  // URLs de vista previa de las imágenes generadas
  useEffect(() => {
    if (!result) return;
    const list = result.files.map((f) => URL.createObjectURL(new Blob([f.bytes], { type: f.type })));
    setUrls(list);
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, [result]);

  const pagesSel = useMemo((): { pages: number[]; error: AppError | null } => {
    if (!pdf || which === 'all') return { pages: [], error: null };
    try {
      const set = new Set(parseRanges(rangeText, pdf.pages).flatMap(rangeToIndices));
      return { pages: [...set].sort((a, b) => a - b), error: null };
    } catch (err) {
      return { pages: [], error: err as AppError };
    }
  }, [pdf, which, rangeText]);

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
    return (
      <ResultPanel
        files={result.files}
        zipName={`${base}-imagenes.zip`}
        onBack={() => setResult(null)}
        onReset={clear}
        note={result.reducedPages.length > 0 && <p className="text-sm text-amber-800 dark:text-amber-300">{t('reducedNote', { pages: result.reducedPages.join(', ') })}</p>}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="result-preview">
          {result.files.map((f, i) => (
            <li key={f.name}>
              <button type="button" className="block w-full text-left" onClick={() => setZoom(i)} aria-label={t('enlarge', { n: f.page })}>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {urls[i] && <img src={urls[i]} alt="" loading="lazy" className="max-h-full max-w-full bg-white shadow" />}
                </div>
                <span className="mt-1 block truncate text-xs font-medium">{f.name}</span>
                <span className="block text-xs muted tabular-nums">{t('imageSize', { w: f.width, h: f.height, size: formatBytes(f.bytes.length, lang) })}</span>
              </button>
            </li>
          ))}
        </ul>
        <Modal open={zoom != null} onClose={() => setZoom(null)} title={zoom != null ? result.files[zoom].name : ''}>
          {zoom != null && urls[zoom] && (
            <div className="bg-slate-100 p-2 dark:bg-slate-950">
              <img src={urls[zoom]} alt={result.files[zoom].name} className="mx-auto max-w-full bg-white" />
            </div>
          )}
        </Modal>
      </ResultPanel>
    );
  }

  const convert = async () => {
    const out = await task.run((onProgress, signal) =>
      pdfToImages(pdf.bytes, base, { format, dpi: +dpi, quality: quality / 100, pages: pagesSel.pages }, (p, label) => onProgress(p, label ? t('page', { n: label }) : undefined), signal),
    );
    if (out) setResult(out);
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      <OptionGroup<ImageFormat>
        label={t('format')}
        value={format}
        columns={2}
        onChange={setFormat}
        options={[
          { value: 'jpg', label: 'JPG' },
          { value: 'png', label: 'PNG' },
        ]}
      />
      <OptionGroup<Dpi>
        label={t('resolution')}
        value={dpi}
        onChange={setDpi}
        options={[
          { value: '72', label: t('dpiScreen') },
          { value: '150', label: t('dpiStandard') },
          { value: '300', label: t('dpiPrint') },
        ]}
      />
      {format === 'jpg' && (
        <div>
          <label htmlFor="quality" className="label">
            {t('jpegQuality')}: <span className="tabular-nums">{quality}%</span>
          </label>
          <input id="quality" type="range" min={50} max={100} step={5} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-brand-600" />
        </div>
      )}
      {pdf.pages > 1 && (
        <div className="space-y-2">
          <OptionGroup<'all' | 'some'>
            label={t('whichPages')}
            value={which}
            columns={2}
            onChange={setWhich}
            options={[
              { value: 'all', label: `${t('allPages')} (${pdf.pages})` },
              { value: 'some', label: t('somePages') },
            ]}
          />
          {which === 'some' && (
            <div>
              <label htmlFor="pages" className="sr-only">
                {t('pagesInput')}
              </label>
              <input id="pages" className="input" value={rangeText} onChange={(e) => setRangeText(e.target.value)} aria-invalid={!!pagesSel.error} aria-describedby="pages-hint" />
              <p id="pages-hint" className={`mt-1 text-sm ${pagesSel.error ? 'text-red-700 dark:text-red-400' : 'muted'}`}>
                {pagesSel.error ? `${ERROR_TEXT[lang]['invalid-range'].title}. ${pagesSel.error.detail ?? ''}` : t('splitRangesHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {task.running ? (
        <ProgressBar value={task.progress} label={task.label} onCancel={task.cancel} />
      ) : (
        <button
          type="button"
          className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8"
          disabled={which === 'some' && (!!pagesSel.error || !pagesSel.pages.length)}
          onClick={convert}
        >
          {t('convertAction', { fmt: format.toUpperCase() })}
        </button>
      )}
    </div>
  );
}
