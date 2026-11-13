/**
 * Nivel "Máxima": cada página se convierte en una imagen JPEG.
 * Logra el menor tamaño, pero el texto deja de ser seleccionable (se avisa en la interfaz).
 */
import { PDFDocument } from 'pdf-lib';
import { fileToBytes } from '../../lib/download';
import type { ProgressFn } from '../../lib/pdf';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from '../../lib/pdfjs';

export const RASTER = { dpi: 110, quality: 0.6 };

export async function rasterizePdf(bytes: Uint8Array, onProgress?: ProgressFn, signal?: AbortSignal): Promise<Uint8Array> {
  const src = await openPdf(bytes);
  const out = await PDFDocument.create();
  out.setProducer('PDF Libre');
  try {
    for (let i = 1; i <= src.numPages; i++) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      onProgress?.((i - 1) / src.numPages);
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const { canvas } = await renderPage(page, RASTER.dpi / 72);
      const jpg = await fileToBytes(await canvasToBlob(canvas, 'image/jpeg', RASTER.quality));
      releaseCanvas(canvas);
      page.cleanup();
      const img = await out.embedJpg(jpg);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    }
  } finally {
    await src.destroy();
  }
  const result = await out.save({ useObjectStreams: true });
  onProgress?.(1);
  return result;
}
