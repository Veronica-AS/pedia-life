import { fileToBytes, type OutputFile } from '../../lib/download';
import type { ProgressFn } from '../../lib/pdf';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from '../../lib/pdfjs';

export type ImageFormat = 'jpg' | 'png';

export interface PdfToImagesOptions {
  format: ImageFormat;
  dpi: number;
  /** Calidad JPEG 0-1 */
  quality: number;
  /** Índices 0-based; vacío = todas */
  pages: number[];
}

export interface PdfToImagesResult {
  files: (OutputFile & { width: number; height: number; page: number })[];
  /** Páginas cuya resolución se redujo por el límite del navegador */
  reducedPages: number[];
}

/** Dibuja cada página con pdf.js y la exporta como imagen */
export async function pdfToImages(
  bytes: Uint8Array,
  base: string,
  opts: PdfToImagesOptions,
  onProgress?: ProgressFn,
  signal?: AbortSignal,
): Promise<PdfToImagesResult> {
  const doc = await openPdf(bytes);
  const indices = opts.pages.length ? opts.pages : Array.from({ length: doc.numPages }, (_, i) => i);
  const pad = String(doc.numPages).length;
  const files: PdfToImagesResult['files'] = [];
  const reducedPages: number[] = [];
  const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';
  try {
    for (let k = 0; k < indices.length; k++) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const pageNo = indices[k] + 1;
      onProgress?.(k / indices.length, `${pageNo}`);
      const page = await doc.getPage(pageNo);
      const { canvas, reduced } = await renderPage(page, opts.dpi / 72);
      if (reduced) reducedPages.push(pageNo);
      const blob = await canvasToBlob(canvas, mime, opts.format === 'jpg' ? opts.quality : undefined);
      files.push({
        name: `${base}-pagina-${String(pageNo).padStart(pad, '0')}.${opts.format}`,
        bytes: await fileToBytes(blob),
        type: mime,
        width: canvas.width,
        height: canvas.height,
        page: pageNo,
      });
      releaseCanvas(canvas);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  onProgress?.(1);
  return { files, reducedPages };
}
