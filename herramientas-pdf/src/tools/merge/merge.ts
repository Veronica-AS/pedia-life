import { PDFDocument } from 'pdf-lib';
import { copyBasicMetadata, loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

/** Une varios PDF en el orden recibido. Las páginas se copian sin recomprimir. */
export async function mergePdfs(files: NamedBytes[], onProgress?: ProgressFn): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(i / (files.length + 1), f.name);
    const src = await loadPdf(f.bytes, f.name);
    if (i === 0) copyBasicMetadata(src, out);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  onProgress?.(files.length / (files.length + 1));
  const bytes = await out.save(saveOptions);
  onProgress?.(1);
  return bytes;
}
