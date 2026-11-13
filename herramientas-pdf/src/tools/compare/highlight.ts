import { rgb } from 'pdf-lib';
import { isolatePageContent, pageBox, placeRect, type VisualRect } from '../../lib/geometry';
import { loadPdf, saveOptions } from '../../lib/pdf';

export interface Highlight {
  page: number;
  rect: VisualRect;
  color: 'red' | 'green';
}

/** Dibuja rectángulos semitransparentes sobre las palabras cambiadas */
export async function highlightPdf(bytes: Uint8Array, marks: Highlight[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  for (const m of marks) {
    const page = pages[m.page - 1];
    if (!page) continue;
    isolatePageContent(page);
    const r = placeRect(pageBox(page), m.rect);
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      rotate: r.rotate,
      color: m.color === 'red' ? rgb(0.95, 0.2, 0.2) : rgb(0.1, 0.75, 0.3),
      opacity: 0.3,
    });
  }
  return doc.save(saveOptions);
}
