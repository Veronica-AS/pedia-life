/**
 * Redacción real: las páginas con zonas ocultas se sustituyen por una imagen en la que
 * los rectángulos negros ya están "quemados". El texto, las imágenes y los vectores originales
 * de esas páginas dejan de existir en el archivo. Las demás páginas se copian sin cambios.
 * El documento resultante es nuevo: no conserva metadatos, marcadores, adjuntos ni JavaScript.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pageBox, visualSize } from '../../lib/geometry';
import { loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';
import { addTextLayer, type OcrPage } from '../ocr/textLayer';

export interface RedactedPage {
  /** Índice 0-based de la página original */
  index: number;
  /** Página completa ya rasterizada con las zonas en negro */
  jpg: Uint8Array;
  /** Texto OCR opcional de lo que quedó visible */
  ocr?: OcrPage | null;
}

export async function assembleRedacted(bytes: Uint8Array, replaced: RedactedPage[], onProgress?: ProgressFn): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const out = await PDFDocument.create();
  out.setProducer('PDF Libre');
  const byIndex = new Map(replaced.map((r) => [r.index, r]));
  const keep = src.getPageIndices().filter((i) => !byIndex.has(i));
  const copied = await out.copyPages(src, keep);
  const copiedByIndex = new Map(keep.map((idx, k) => [idx, copied[k]]));
  const font = replaced.some((r) => r.ocr?.lines.length) ? await out.embedFont(StandardFonts.Helvetica) : null;
  const srcPages = src.getPages();

  for (let i = 0; i < srcPages.length; i++) {
    onProgress?.(i / srcPages.length);
    const r = byIndex.get(i);
    if (!r) {
      out.addPage(copiedByIndex.get(i)!);
      continue;
    }
    const vs = visualSize(pageBox(srcPages[i]));
    const page = out.addPage([vs.width, vs.height]);
    const img = await out.embedJpg(r.jpg);
    page.drawImage(img, { x: 0, y: 0, width: vs.width, height: vs.height });
    if (font && r.ocr?.lines.length) {
      page.setFont(font);
      addTextLayer(page, font, (page as unknown as { fontKey: string }).fontKey, r.ocr.lines);
    }
  }
  const result = await out.save(saveOptions);
  onProgress?.(1);
  return result;
}
