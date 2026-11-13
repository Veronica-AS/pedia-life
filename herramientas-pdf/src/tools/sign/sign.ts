import type { PDFImage } from 'pdf-lib';
import { AppError } from '../../lib/errors';
import { pageBox, placeRect, type VisualRect, isolatePageContent } from '../../lib/geometry';
import { loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';

export interface SignatureImage {
  id: string;
  /** PNG con fondo transparente */
  png: Uint8Array;
}

export interface Placement {
  imageId: string;
  /** Página 1-based */
  page: number;
  rect: VisualRect;
}

/** Estampa las firmas (imágenes) en las posiciones indicadas */
export async function signPdf(bytes: Uint8Array, images: SignatureImage[], placements: Placement[], onProgress?: ProgressFn): Promise<Uint8Array> {
  if (!placements.length) throw new AppError('no-pages');
  const doc = await loadPdf(bytes);
  const embedded = new Map<string, PDFImage>();
  for (const img of images) embedded.set(img.id, await doc.embedPng(img.png));
  const pages = doc.getPages();
  placements.forEach((pl, i) => {
    onProgress?.(i / placements.length);
    const page = pages[pl.page - 1];
    const img = embedded.get(pl.imageId);
    if (!page || !img) return;
    isolatePageContent(page);
    const r = placeRect(pageBox(page), pl.rect);
    page.drawImage(img, { x: r.x, y: r.y, width: r.width, height: r.height, rotate: r.rotate });
  });
  const out = await doc.save(saveOptions);
  onProgress?.(1);
  return out;
}
