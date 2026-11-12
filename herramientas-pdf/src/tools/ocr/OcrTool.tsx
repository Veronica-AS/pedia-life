import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionBar } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { OptionGroup } from '../../components/OptionGroup';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import { downloadBlob, fileToBytes, type OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { ACCEPTED_IMAGE_EXT, prepareImage } from '../../lib/images';
import { canvasToBlob, openPdf, releaseCanvas, renderPage, type PDFDocumentProxy } from '../../lib/pdfjs';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { defaultPageSize } from '../images-to-pdf/layout';
import type { ToolProps } from '../types';
import { createOcrEngine, LOW_CONFIDENCE, type OcrLang } from './ocrEngine';
import type { OcrLine } from './textLayer';

/** Resolución para reconocer: 250 ppp es un buen equilibrio entre precisión y velocidad */
const OCR_DPI = 250;

interface Source {
  kind: 'pdf' | 'images';
  name: string;
  pdfBytes?: Uint8Array;
  doc?: PDFDocumentProxy;
  pages: number;
  images?: { name: string; bytes: Uint8Array; kind: 'jpg' | 'png'; width: number; height: number }[];
}

interface PageResult {
  /** null = la página ya tenía texto y no se reconoció */
  lines: OcrLine[] | null;
  imageUrl: string | null;
  /** Tamaño en píxeles de la imagen reconocida */
  w: number;
  h: number;
}

export default function OcrTool(_: ToolProps) {
  const L = useL();
  const [src, setSrc] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [lang, setLang] = useState<OcrLang>('spa');
  const [includeText, setIncludeText] = useState(false);
  const [pages, setPages] = useState<PageResult[] | null>(null);
  const [view, setView] = useState(0);
  const [result, setResult] = useState<OutputFile | null>(null);
  const [stageLabel, setStageLabel] = useState('');
  const task = useTask();
  const build = useTask();
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => () => void src?.doc?.destroy(), [src]);

  const reset = () => {
    setSrc(null);
    setPages(null);
    setResult(null);
    setView(0);
  };

  const onFiles = async (files: File[]) => {
    setError(null);
    setLoading(true);
    try {
      const pdfFile = files.find((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
      if (pdfFile) {
        const bytes = await fileToBytes(pdfFile);
        await pdfTasks.validate(bytes, pdfFile.name);
        const doc = await openPdf(bytes, pdfFile.name);
        setSrc({ kind: 'pdf', name: pdfFile.name, pdfBytes: bytes, doc, pages: doc.numPages });
      } else {
        const images: NonNullable<Source['images']> = [];
        for (const f of files) {
          const { image, previewUrl } = await prepareImage(f);
          URL.revokeObjectURL(previewUrl);
          images.push(image);
        }
        setSrc({ kind: 'images', name: files[0].name, pages: images.length, images });
      }
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!src) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={['.pdf', ...ACCEPTED_IMAGE_EXT]}
          mimeTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']}
          multiple
          onFiles={onFiles}
          onRejected={(n) => setError(new AppError('unsupported-file', { fileName: n.join(', ') }))}
          formatsLabel="PDF, JPG, PNG, HEIC, WEBP"
        />
        <p className="text-xs muted">
          {L(
            'Un PDF escaneado, o una o varias fotos de documentos. La primera vez se descarga el motor de OCR (unos 10 MB) desde este mismo sitio; después funciona sin internet.',
            'A scanned PDF, or one or more document photos. The first time, the OCR engine (about 10 MB) is downloaded from this site; then it works offline.',
          )}
        </p>
        {loading && <p className="text-sm muted">{L('Leyendo archivo…', 'Reading file…')}</p>}
        {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  if (result) {
    return (
      <ResultPanel
        files={[result]}
        zipName=""
        onBack={() => setResult(null)}
        onReset={reset}
        note={<p className="text-sm muted">{L('Prueba a buscar o seleccionar texto en tu lector de PDF: ahora es posible.', 'Try searching or selecting text in your PDF reader: it now works.')}</p>}
      >
        <PdfPreview bytes={result.bytes} maxPages={24} />
      </ResultPanel>
    );
  }

  const recognize = async () => {
    const out = await task.run(async (onProgress, signal) => {
      setStageLabel(L('Preparando el motor de OCR…', 'Preparing OCR engine…'));
      const engine = await createOcrEngine(lang, (p) => {
        setStageLabel(L('Descargando el motor y el idioma (solo la primera vez)…', 'Downloading engine and language (first time only)…'));
        onProgress(p.progress * 0.05);
      });
      const res: PageResult[] = [];
      try {
        for (let i = 0; i < src.pages; i++) {
          if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
          setStageLabel(L('Reconociendo página {n} de {t}…', 'Recognizing page {n} of {t}…', { n: i + 1, t: src.pages }));
          const base = 0.05 + (0.95 * i) / src.pages;
          const step = (p: number) => onProgress(base + (0.95 * p) / src.pages);
          let blob: Blob;
          let w: number;
          let h: number;
          if (src.kind === 'pdf') {
            const page = await src.doc!.getPage(i + 1);
            if (!includeText) {
              const tc = await page.getTextContent();
              const chars = tc.items.reduce((s, it) => s + ('str' in it ? it.str.trim().length : 0), 0);
              if (chars > 20) {
                res.push({ lines: null, imageUrl: null, w: 0, h: 0 });
                continue;
              }
            }
            const { canvas } = await renderPage(page, OCR_DPI / 72);
            w = canvas.width;
            h = canvas.height;
            blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
            releaseCanvas(canvas);
            page.cleanup();
          } else {
            const im = src.images![i];
            blob = new Blob([im.bytes], { type: im.kind === 'jpg' ? 'image/jpeg' : 'image/png' });
            w = im.width;
            h = im.height;
          }
          const ocr = await engine.recognize(blob, w, h, step);
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          res.push({ lines: ocr.lines, imageUrl: url, w, h });
        }
      } finally {
        await engine.terminate();
      }
      return res;
    }, {});
    if (out) {
      setPages(out);
      setView(Math.max(0, out.findIndex((p) => p.lines)));
    }
  };

  const recognizedCount = pages?.filter((p) => p.lines).length ?? 0;
  const allText = () =>
    (pages ?? [])
      .map((p) => (p.lines ? p.lines.map((l) => l.text).join('\n') : ''))
      .join('\n\n')
      .trim();

  const exportPdf = async () => {
    if (!pages) return;
    const out = await build.run(async (onProgress) => {
      if (src.kind === 'pdf') return pdfTasks.addOcr(src.pdfBytes!, pages.map((p) => (p.lines ? { lines: p.lines } : null)), onProgress);
      return pdfTasks.imagesOcr(
        src.images!.map((im, i) => ({ bytes: im.bytes, kind: im.kind, ocr: { lines: pages[i].lines ?? [] } })),
        { pageSize: defaultPageSize(navigator.language), orientation: 'auto', margin: 'none' },
        onProgress,
      );
    });
    if (out) setResult({ name: `${baseName(src.name)}-buscable.pdf`, bytes: out, type: 'application/pdf' });
  };

  const updateLine = (pi: number, li: number, text: string) =>
    setPages((prev) => prev && prev.map((p, i) => (i === pi && p.lines ? { ...p, lines: p.lines.map((l, k) => (k === li ? { ...l, text, confidence: 100 } : l)) } : p)));

  const current = pages?.[view];
  const lowCount = current?.lines?.filter((l) => l.confidence < LOW_CONFIDENCE).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-3 p-3">
        <FileText className="h-5 w-5 text-brand-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{src.kind === 'pdf' ? src.name : L('{n} imagen(es)', '{n} image(s)', { n: src.pages })}</p>
          <p className="text-sm muted" data-testid="file-info">
            {L('{n} página(s)', '{n} page(s)', { n: src.pages })}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={reset}>
          {L('Empezar de nuevo', 'Start over')}
        </button>
      </div>

      {!pages && (
        <>
          <OptionGroup<OcrLang>
            label={L('Idioma del documento', 'Document language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'spa', label: L('Español', 'Spanish') },
              { value: 'eng', label: L('Inglés', 'English') },
              { value: 'spa+eng', label: L('Español + inglés', 'Spanish + English') },
            ]}
          />
          {src.kind === 'pdf' && (
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={includeText} onChange={(e) => setIncludeText(e.target.checked)} />
              <span>
                {L('Reconocer también las páginas que ya tienen texto', 'Also recognize pages that already have text')}
                <span className="block text-sm muted">{L('Normalmente no hace falta: se saltan para no duplicar el texto.', 'Usually not needed: they are skipped to avoid duplicate text.')}</span>
              </span>
            </label>
          )}
          {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
          {task.running ? (
            <ProgressBar value={task.progress} label={stageLabel} onCancel={task.cancel} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" onClick={recognize}>
              {L('Reconocer texto', 'Recognize text')}
            </button>
          )}
        </>
      )}

      {pages && (
        <section className="card p-4" aria-labelledby="review-title">
          <h2 id="review-title" className="font-semibold">
            {L('Revisa y corrige el texto', 'Review and correct the text')}
          </h2>
          <p className="mt-1 text-sm muted">
            {recognizedCount === 0
              ? L('Todas las páginas ya tenían texto: no fue necesario reconocer nada.', 'All pages already had text: nothing to recognize.')
              : L('Cada fila muestra un fragmento del original y el texto reconocido. Las filas en amarillo son dudosas.', 'Each row shows a piece of the original and the recognized text. Yellow rows are uncertain.')}
          </p>
          {pages.length > 1 && (
            <div className="my-3 flex items-center justify-between">
              <button type="button" className="btn-icon" disabled={view === 0} onClick={() => setView(view - 1)} aria-label={L('Página anterior', 'Previous page')}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="text-sm tabular-nums">{L('Página {n} de {t}', 'Page {n} of {t}', { n: view + 1, t: pages.length })}</span>
              <button type="button" className="btn-icon" disabled={view === pages.length - 1} onClick={() => setView(view + 1)} aria-label={L('Página siguiente', 'Next page')}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          {current && !current.lines && <p className="py-4 text-sm muted">{L('Esta página ya tenía texto y se dejó tal cual.', 'This page already had text and was left as is.')}</p>}
          {current?.lines && (
            <>
              {lowCount > 0 && (
                <p className="mb-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {L('{n} línea(s) para revisar en esta página', '{n} line(s) to review on this page', { n: lowCount })}
                </p>
              )}
              {current.lines.length === 0 && <p className="py-4 text-sm muted">{L('No se encontró texto en esta página.', 'No text found on this page.')}</p>}
              <ol className="space-y-2" data-testid="ocr-lines">
                {current.lines.map((l, li) => {
                  const cw = l.x1 - l.x0;
                  const ch = l.y1 - l.y0;
                  const low = l.confidence < LOW_CONFIDENCE;
                  return (
                    <li key={li} className={`rounded-lg border p-2 ${low ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                      {current.imageUrl && cw > 0 && ch > 0 && (
                        <div
                          className="mb-1 max-w-full rounded bg-white"
                          aria-hidden="true"
                          style={{
                            height: 34,
                            aspectRatio: `${cw * current.w} / ${ch * current.h}`,
                            backgroundImage: `url(${current.imageUrl})`,
                            backgroundSize: `${100 / cw}% ${100 / ch}%`,
                            backgroundPosition: `${cw < 1 ? (l.x0 / (1 - cw)) * 100 : 0}% ${ch < 1 ? (l.y0 / (1 - ch)) * 100 : 0}%`,
                          }}
                        />
                      )}
                      <label className="sr-only" htmlFor={`l-${view}-${li}`}>
                        {L('Línea {n}', 'Line {n}', { n: li + 1 })}
                      </label>
                      <input id={`l-${view}-${li}`} className="input min-h-[40px] py-1 text-sm" value={l.text} onChange={(e) => updateLine(view, li, e.target.value)} spellCheck lang={lang === 'eng' ? 'en' : 'es'} />
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      )}

      {build.error && <ErrorMessage error={build.error} onDismiss={() => build.setError(null)} />}
      {pages && (
        <ActionBar>
          {build.running ? (
            <ProgressBar value={build.progress} />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8" onClick={exportPdf}>
                {L('Crear PDF buscable', 'Create searchable PDF')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => downloadBlob(new Blob(['﻿', allText().replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }), `${baseName(src.name)}.txt`)}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {L('Solo el texto (.txt)', 'Text only (.txt)')}
              </button>
            </div>
          )}
        </ActionBar>
      )}
    </div>
  );
}
