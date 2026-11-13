import { PDFDocument } from 'pdf-lib';
import { saveOptions, type ProgressFn } from '../../lib/pdf';
import { layoutImage, type LayoutOptions } from './layout';

export interface PreparedImage {
  name: string;
  /** JPEG o PNG listos para incrustar */
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

export async function imagesToPdf(images: PreparedImage[], opts: LayoutOptions, onProgress?: ProgressFn): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer('PDF Libre');
  doc.setCreator('PDF Libre');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    onProgress?.(i / (images.length + 1), img.name);
    const embedded = img.kind === 'jpg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
    const l = layoutImage(embedded.width, embedded.height, opts);
    const page = doc.addPage([l.pageWidth, l.pageHeight]);
    page.drawImage(embedded, { x: l.x, y: l.y, width: l.width, height: l.height });
  }
  const bytes = await doc.save(saveOptions);
  onProgress?.(1);
  return bytes;
}
