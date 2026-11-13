/** Palabras de un PDF con su página y posición (para resaltar los cambios sobre la página) */
import type { VisualRect } from '../../lib/geometry';
import type { PDFDocumentProxy } from '../../lib/pdfjs';
import { extractPage } from '../../lib/textExtract';
import { prefixFraction } from '../redact/search';

export interface Token {
  text: string;
  /** Página 1-based */
  page: number;
  rect: VisualRect;
}

export async function tokenize(doc: PDFDocumentProxy, onProgress?: (f: number) => void, signal?: AbortSignal): Promise<Token[]> {
  const out: Token[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    onProgress?.((p - 1) / doc.numPages);
    const page = await doc.getPage(p);
    const tp = await extractPage(page);
    page.cleanup();
    for (const line of tp.lines) {
      for (const run of line.runs) {
        for (const m of run.str.matchAll(/\S+/g)) {
          const a = m.index!;
          const b = a + m[0].length;
          const x0 = run.x + prefixFraction(run.str, a) * run.width;
          const x1 = run.x + prefixFraction(run.str, b) * run.width;
          const top = run.y - run.fontSize * 0.92;
          out.push({
            text: m[0],
            page: p,
            rect: { u: x0 / tp.width, v: top / tp.height, w: Math.max(0.002, (x1 - x0) / tp.width), h: (run.fontSize * 1.2) / tp.height },
          });
        }
      }
    }
  }
  onProgress?.(1);
  return out;
}
