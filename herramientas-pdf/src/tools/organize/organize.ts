import { PDFDocument, degrees } from 'pdf-lib';
import { AppError } from '../../lib/errors';
import { normRotation } from './rotation';

export { normRotation };
import { copyBasicMetadata, loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';

export interface PagePlan {
  /** Índice 0-based de la página original */
  index: number;
  /** Rotación adicional en grados (múltiplo de 90) */
  rotation: number;
}


/** Genera un PDF nuevo con las páginas en el orden y la rotación indicados (las omitidas se eliminan) */
export async function organizePdf(bytes: Uint8Array, plan: PagePlan[], onProgress?: ProgressFn): Promise<Uint8Array> {
  if (!plan.length) throw new AppError('no-pages');
  const src = await loadPdf(bytes);
  onProgress?.(0.2);
  const out = await PDFDocument.create();
  copyBasicMetadata(src, out);
  const copied = await out.copyPages(
    src,
    plan.map((p) => p.index),
  );
  copied.forEach((page, i) => {
    const extra = normRotation(plan[i].rotation);
    if (extra) page.setRotation(degrees(normRotation(page.getRotation().angle + extra)));
    out.addPage(page);
  });
  onProgress?.(0.7);
  const result = await out.save(saveOptions);
  onProgress?.(1);
  return result;
}
