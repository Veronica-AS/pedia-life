import { ArrowDown, ArrowUp, Camera, ImagePlus, RotateCw, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionBar } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { OptionGroup } from '../../components/OptionGroup';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import { fileToBytes, type OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { decodeImageFile } from '../../lib/images';
import { canvasToBlob } from '../../lib/pdfjs';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { defaultPageSize, type PageSizeId } from '../images-to-pdf/layout';
import { createOcrEngine } from '../ocr/ocrEngine';
import type { ToolProps } from '../types';
import { CameraCapture } from './CameraCapture';
import { CornerEditor } from './CornerEditor';
import { FULL_QUAD, type Filter, type Quad } from './cv';
import { scanWorker } from './scanClient';

/** Tamaño máximo de la foto de origen que se conserva (ahorra memoria en celulares) */
const MAX_SOURCE = 2600;

interface ScanPage {
  id: string;
  source: Blob;
  sourceUrl: string;
  w: number;
  h: number;
  quad: Quad;
  autoDetected: boolean;
  filter: Filter;
  rotation: number;
  result?: { bytes: Uint8Array; kind: 'jpg' | 'png'; url: string; w: number; h: number };
}

let seq = 0;

async function bitmapToRgba(bmp: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  c.width = c.height = 0;
  return data;
}

export default function ScanTool(_: ToolProps) {
  const L = useL();
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeId>(() => defaultPageSize(typeof navigator !== 'undefined' ? navigator.language : 'es'));
  const [ocr, setOcr] = useState(false);
  const [result, setResult] = useState<OutputFile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const task = useTask();
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const track = (u: string) => (urls.current.push(u), u);

  /** Aplica recorte, perspectiva, filtro y rotación a una página */
  const processPage = async (p: ScanPage): Promise<ScanPage> => {
    const bmp = await createImageBitmap(p.source);
    const rgba = await bitmapToRgba(bmp, p.w, p.h);
    bmp.close();
    const out = await scanWorker().process(rgba, p.w, p.h, p.quad, p.filter, p.rotation);
    const c = document.createElement('canvas');
    c.width = out.w;
    c.height = out.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.w, out.h), 0, 0);
    // Blanco y negro se guarda en PNG (más nítido y ligero); el resto en JPEG
    const kind = p.filter === 'bw' ? 'png' : 'jpg';
    const blob = await canvasToBlob(c, kind === 'png' ? 'image/png' : 'image/jpeg', 0.88);
    c.width = c.height = 0;
    return { ...p, result: { bytes: await fileToBytes(blob), kind, url: track(URL.createObjectURL(blob)), w: out.w, h: out.h } };
  };

  const update = async (id: string, patch: Partial<ScanPage>) => {
    const p = pages.find((x) => x.id === id);
    if (!p) return;
    const next = { ...p, ...patch };
    setPages((prev) => prev.map((x) => (x.id === id ? next : x)));
    setBusy((b) => b + 1);
    try {
      const done = await processPage(next);
      setPages((prev) => prev.map((x) => (x.id === id ? { ...done, quad: x.quad, filter: x.filter, rotation: x.rotation } : x)));
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusy((b) => b - 1);
    }
  };

  const addImages = async (blobs: (Blob | File)[]) => {
    setError(null);
    setBusy((b) => b + 1);
    try {
      for (const blob of blobs) {
        const file = blob instanceof File ? blob : new File([blob], 'camara.jpg', { type: 'image/jpeg' });
        const bmp = await decodeImageFile(file);
        const k = Math.min(1, MAX_SOURCE / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * k);
        const h = Math.round(bmp.height * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const source = await canvasToBlob(c, 'image/jpeg', 0.92);
        // Detección sobre una copia pequeña (rápida)
        const sk = Math.min(1, 480 / Math.max(w, h));
        const sw = Math.round(w * sk);
        const sh = Math.round(h * sk);
        const small = await bitmapToRgba(c, sw, sh);
        c.width = c.height = 0;
        const detected = await scanWorker().detect(small, sw, sh);
        const page: ScanPage = {
          id: `s${++seq}`,
          source,
          sourceUrl: track(URL.createObjectURL(source)),
          w,
          h,
          quad: detected ?? FULL_QUAD,
          autoDetected: !!detected,
          filter: 'color',
          rotation: 0,
        };
        const done = await processPage(page);
        setPages((prev) => [...prev, done]);
        setCurrent(done.id);
      }
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusy((b) => b - 1);
    }
  };

  const reset = () => {
    setPages([]);
    setResult(null);
    setCurrent(null);
  };

  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={reset}>
        <PdfPreview bytes={result.bytes} />
      </ResultPanel>
    );
  }

  const createPdf = async () => {
    const ready = pages.filter((p) => p.result);
    const out = await task.run(async (onProgress) => {
      const images = ready.map((p) => ({ name: p.id, bytes: p.result!.bytes, kind: p.result!.kind, width: p.result!.w, height: p.result!.h }));
      const layout = { pageSize, orientation: 'auto' as const, margin: 'none' as const };
      if (!ocr) return pdfTasks.imagesToPdf(images, layout, onProgress);
      const engine = await createOcrEngine('spa');
      try {
        const withText = [];
        for (let i = 0; i < ready.length; i++) {
          const r = ready[i].result!;
          const blob = new Blob([r.bytes], { type: r.kind === 'png' ? 'image/png' : 'image/jpeg' });
          const page = await engine.recognize(blob, r.w, r.h, (f) => onProgress(((i + f) / ready.length) * 0.9));
          withText.push({ bytes: r.bytes, kind: r.kind, ocr: page });
        }
        return pdfTasks.imagesOcr(withText, layout, (f) => onProgress(0.9 + f * 0.1));
      } finally {
        await engine.terminate();
      }
    });
    if (out) setResult({ name: `escaneo-${new Date().toISOString().slice(0, 10)}.pdf`, bytes: out, type: 'application/pdf' });
  };

  const cur = pages.find((p) => p.id === current) ?? null;
  const move = (i: number, d: -1 | 1) =>
    setPages((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const n = [...prev];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-5">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) addImages(files);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-primary py-4 text-base" onClick={() => setCamera(true)}>
          <Camera className="h-5 w-5" aria-hidden="true" />
          {pages.length ? L('Escanear otra página', 'Scan another page') : L('Abrir la cámara', 'Open camera')}
        </button>
        <button type="button" className="btn-secondary py-4 text-base" onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          {L('Elegir fotos', 'Choose photos')}
        </button>
      </div>
      {pages.length === 0 && (
        <p className="text-sm muted">
          {L(
            'Consejo: coloca el documento sobre una superficie oscura y con buena luz. Detectamos los bordes automáticamente y puedes ajustarlos.',
            'Tip: place the document on a dark surface with good light. Edges are detected automatically and you can adjust them.',
          )}
        </p>
      )}
      <CameraCapture open={camera} onClose={() => setCamera(false)} onCapture={(b) => addImages([b])} count={pages.length} />
      {busy > 0 && <ProgressBar value={0.5} label={L('Procesando la foto…', 'Processing photo…')} />}
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}

      {cur && (
        <section className="card space-y-4 p-4" aria-labelledby="edit-title">
          <h2 id="edit-title" className="font-semibold">
            {L('Página {n}: ajusta los bordes', 'Page {n}: adjust the edges', { n: pages.indexOf(cur) + 1 })}
          </h2>
          {!cur.autoDetected && (
            <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
              {L('No encontramos los bordes con claridad: arrastra las esquinas azules hasta las del documento.', 'Edges were not clear: drag the blue corners to the document corners.')}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <CornerEditor src={cur.sourceUrl} aspect={cur.w / cur.h} quad={cur.quad} onChange={(quad) => setPages((prev) => prev.map((x) => (x.id === cur.id ? { ...x, quad } : x)))} />
            <div className="flex flex-col">
              <p className="mb-1 text-sm font-semibold">{L('Resultado', 'Result')}</p>
              {cur.result && <img src={cur.result.url} alt={L('Página escaneada', 'Scanned page')} className="max-h-[70vh] w-auto self-start rounded-lg border bg-white shadow" data-testid="scan-result" />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => update(cur.id, { quad: cur.quad })} disabled={busy > 0}>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              {L('Aplicar recorte', 'Apply crop')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => update(cur.id, { rotation: (cur.rotation + 90) % 360 })} disabled={busy > 0}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              {L('Girar', 'Rotate')}
            </button>
          </div>
          <OptionGroup<Filter>
            label={L('Mejora', 'Enhancement')}
            value={cur.filter}
            columns={4}
            onChange={(filter) => update(cur.id, { filter })}
            options={[
              { value: 'color', label: L('Color mejorado', 'Enhanced color') },
              { value: 'gray', label: L('Grises', 'Grayscale') },
              { value: 'bw', label: L('Blanco y negro', 'Black & white'), description: L('Ideal para texto', 'Best for text') },
              { value: 'original', label: L('Original', 'Original') },
            ]}
          />
        </section>
      )}

      {pages.length > 0 && (
        <section aria-labelledby="pages-title">
          <h2 id="pages-title" className="label">
            {L('Páginas ({n})', 'Pages ({n})', { n: pages.length })}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" data-testid="scan-pages">
            {pages.map((p, i) => (
              <li key={p.id} className={`card p-1 ${p.id === current ? 'ring-2 ring-brand-500' : ''}`}>
                <button type="button" className="block w-full" onClick={() => setCurrent(p.id)} aria-label={L('Editar página {n}', 'Edit page {n}', { n: i + 1 })} aria-current={p.id === current}>
                  <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {p.result && <img src={p.result.url} alt="" className="max-h-full max-w-full bg-white" />}
                  </div>
                </button>
                <div className="mt-1 flex justify-center">
                  <button type="button" className="btn-icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={L('Mover antes la página {n}', 'Move page {n} earlier', { n: i + 1 })}>
                    <ArrowUp className="h-4 w-4 -rotate-90" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon-sm text-red-600" onClick={() => setPages((prev) => prev.filter((x) => x.id !== p.id))} aria-label={L('Eliminar página {n}', 'Delete page {n}', { n: i + 1 })}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon-sm" disabled={i === pages.length - 1} onClick={() => move(i, 1)} aria-label={L('Mover después la página {n}', 'Move page {n} later', { n: i + 1 })}>
                    <ArrowDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pages.length > 0 && (
        <>
          <OptionGroup<PageSizeId>
            label={L('Tamaño de página del PDF', 'PDF page size')}
            value={pageSize}
            onChange={setPageSize}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: L('Carta', 'Letter') },
              { value: 'fit', label: L('Como la foto', 'Same as photo') },
            ]}
          />
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={ocr} onChange={(e) => setOcr(e.target.checked)} />
            <span>
              {L('Hacer el texto buscable (OCR en español)', 'Make text searchable (OCR)')}
              <span className="block text-sm muted">{L('Tarda unos segundos más por página.', 'Takes a few more seconds per page.')}</span>
            </span>
          </label>
          {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
          <ActionBar>
            {task.running ? (
              <ProgressBar value={task.progress} />
            ) : (
              <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={busy > 0 || !pages.some((p) => p.result)} onClick={createPdf}>
                {L('Crear PDF con {n} página(s)', 'Create PDF with {n} page(s)', { n: pages.length })}
              </button>
            )}
          </ActionBar>
        </>
      )}
    </div>
  );
}
