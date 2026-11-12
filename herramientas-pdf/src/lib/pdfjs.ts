/**
 * pdf.js se carga bajo demanda (solo cuando una herramienta lo necesita).
 * Se usa la versión "legacy" para que funcione en iPhone/Safari más antiguos.
 * El análisis del PDF ocurre en el Worker propio de pdf.js.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { AppError, toAppError } from './errors';
import { assertPdfBytes } from './pdfCheck';

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;

export function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as Promise<PdfJs>,
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      return lib;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

const assetBase = () => `${import.meta.env.BASE_URL}pdfjs/`;

/** Abre un PDF con pdf.js. Se pasa una copia porque pdf.js transfiere (vacía) el buffer al Worker. */
export async function openPdf(bytes: Uint8Array, fileName?: string): Promise<PDFDocumentProxy> {
  assertPdfBytes(bytes, fileName);
  const pdfjs = await getPdfJs();
  try {
    const task = pdfjs.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      cMapUrl: `${assetBase()}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase()}standard_fonts/`,
      // Si el PDF pide contraseña, falla de inmediato en lugar de quedarse esperando
    });
    task.onPassword = () => {
      task.destroy();
    };
    const doc = await task.promise;
    return doc;
  } catch (err) {
    throw toAppError(err, fileName);
  }
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Área máxima de canvas segura (iOS limita a ~16,7 megapíxeles) */
export const maxCanvasArea = () => (isIOS() ? 16_777_216 : 50_000_000);
const MAX_DIM = 16_384;

export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** Escala realmente usada (puede ser menor que la pedida si la página es enorme) */
  scale: number;
  reduced: boolean;
}

/**
 * Dibuja una página en un canvas. scale = 1 equivale a 72 ppp.
 * Si el resultado excede el límite del navegador, se reduce la escala.
 */
export async function renderPage(
  page: PDFPageProxy,
  scale: number,
  opts: { rotation?: number; background?: string } = {},
): Promise<RenderResult> {
  let viewport = page.getViewport({ scale, rotation: (page.rotate + (opts.rotation ?? 0)) % 360 });
  let used = scale;
  let reduced = false;
  const area = viewport.width * viewport.height;
  const limit = maxCanvasArea();
  if (area > limit || viewport.width > MAX_DIM || viewport.height > MAX_DIM) {
    const factor = Math.min(Math.sqrt(limit / area), MAX_DIM / viewport.width, MAX_DIM / viewport.height) * 0.98;
    used = scale * factor;
    reduced = true;
    viewport = page.getViewport({ scale: used, rotation: (page.rotate + (opts.rotation ?? 0)) % 360 });
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new AppError('out-of-memory');
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, scale: used, reduced };
}

/** Libera la memoria de un canvas (importante en iPhone) */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError('out-of-memory'))), type, quality);
  });
}

export type { PDFDocumentProxy, PDFPageProxy };
