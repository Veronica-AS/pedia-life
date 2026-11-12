import { canvasToBlob, releaseCanvas, renderPage, type PDFDocumentProxy } from './pdfjs';

/** Cola sencilla: como máximo 2 páginas renderizándose a la vez (evita saturar celulares) */
const MAX_CONCURRENT = 2;
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/**
 * Dibuja una página con el ancho indicado (en px de pantalla) y devuelve una URL de imagen.
 * Se convierte a JPEG y se libera el canvas para ahorrar memoria con documentos largos.
 */
export function renderToUrl(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number, format: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<{ url: string; width: number; height: number }> {
  return withSlot(async () => {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const scale = (cssWidth * dpr) / Math.max(base.width, 1);
    const { canvas } = await renderPage(page, scale);
    const blob = await canvasToBlob(canvas, format, 0.85);
    const result = { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
    releaseCanvas(canvas);
    page.cleanup();
    return result;
  });
}
