import { PDFDocument } from 'pdf-lib';
import { copyBasicMetadata, loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';

/** Crea un PDF por cada grupo de índices (0-based) */
export async function splitPdf(bytes: Uint8Array, groups: number[][], onProgress?: ProgressFn): Promise<Uint8Array[]> {
  const src = await loadPdf(bytes);
  const out: Uint8Array[] = [];
  for (let i = 0; i < groups.length; i++) {
    onProgress?.(i / groups.length);
    const doc = await PDFDocument.create();
    copyBasicMetadata(src, doc);
    const pages = await doc.copyPages(src, groups[i]);
    for (const p of pages) doc.addPage(p);
    out.push(await doc.save(saveOptions));
  }
  onProgress?.(1);
  return out;
}
