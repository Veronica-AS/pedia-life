/**
 * Extracción de texto con pdf.js: reconstruye líneas y párrafos a partir de los fragmentos de texto
 * que trae el PDF, en el orden visual de la página (respeta la rotación).
 */
import type { PDFPageProxy } from './pdfjs';
import { getPdfJs, type PDFDocumentProxy } from './pdfjs';

export interface TextRun {
  str: string;
  /** Posición visual en puntos (origen arriba a la izquierda, línea base) */
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  italic: boolean;
}

export interface TextLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  runs: TextRun[];
}

export interface TextPage {
  width: number;
  height: number;
  lines: TextLine[];
}

interface RawItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
}

/** Lee las fuentes reales (para detectar negrita/cursiva). Requiere procesar los operadores de la página. */
async function fontInfo(page: PDFPageProxy, names: string[]): Promise<Map<string, { bold: boolean; italic: boolean }>> {
  const map = new Map<string, { bold: boolean; italic: boolean }>();
  try {
    await page.getOperatorList();
    for (const n of names) {
      let real = '';
      try {
        const f = page.commonObjs.has(n) ? (page.commonObjs.get(n) as { name?: string; bold?: boolean; italic?: boolean; black?: boolean }) : null;
        real = f?.name ?? '';
        map.set(n, {
          bold: !!f?.bold || !!f?.black || /bold|black|heavy|semibold|demi/i.test(real),
          italic: !!f?.italic || /italic|oblique/i.test(real),
        });
      } catch {
        map.set(n, { bold: false, italic: false });
      }
    }
  } catch {
    /* sin información de fuentes */
  }
  return map;
}

export async function extractPage(page: PDFPageProxy, opts: { styles?: boolean } = {}): Promise<TextPage> {
  const pdfjs = await getPdfJs();
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = (content.items as RawItem[]).filter((i) => typeof i.str === 'string' && i.str.length > 0);
  const fonts = opts.styles ? await fontInfo(page, [...new Set(items.map((i) => i.fontName))]) : new Map();

  const runs: TextRun[] = items.map((it) => {
    const m = pdfjs.Util.transform(viewport.transform, it.transform) as number[];
    const fontSize = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]) || 10;
    const scaleX = Math.hypot(it.transform[0], it.transform[1]) || 1;
    const viewScale = Math.hypot(m[0], m[1]) / scaleX || 1;
    const f = fonts.get(it.fontName) ?? { bold: false, italic: false };
    return { str: it.str, x: m[4], y: m[5], width: it.width * viewScale, fontSize, fontName: it.fontName, bold: f.bold, italic: f.italic };
  });

  // Agrupa en líneas por coordenada vertical (tolerancia proporcional al tamaño de letra)
  runs.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const r of runs) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.y - last.y) <= Math.max(2, Math.min(r.fontSize, last.fontSize) * 0.5)) {
      last.runs.push(r);
    } else {
      lines.push({ text: '', x: r.x, y: r.y, fontSize: r.fontSize, bold: r.bold, italic: r.italic, runs: [r] });
    }
  }
  for (const line of lines) {
    line.runs.sort((a, b) => a.x - b.x);
    let text = '';
    let end = -Infinity;
    for (const r of line.runs) {
      const gap = r.x - end;
      if (text && gap > r.fontSize * 0.2 && !text.endsWith(' ') && !r.str.startsWith(' ')) text += gap > r.fontSize * 2.5 ? '\t' : ' ';
      text += r.str;
      end = Math.max(end, r.x + r.width);
    }
    line.text = text.replace(/\s+$/, '');
    line.x = line.runs[0].x;
    const sizes = line.runs.map((r) => r.fontSize).sort((a, b) => a - b);
    line.fontSize = sizes[Math.floor(sizes.length / 2)];
    const chars = line.runs.reduce((s, r) => s + r.str.length, 0) || 1;
    line.bold = line.runs.reduce((s, r) => s + (r.bold ? r.str.length : 0), 0) / chars > 0.6;
    line.italic = line.runs.reduce((s, r) => s + (r.italic ? r.str.length : 0), 0) / chars > 0.6;
  }
  return { width: viewport.width, height: viewport.height, lines: lines.filter((l) => l.text.trim()) };
}

export async function extractDocument(
  doc: PDFDocumentProxy,
  opts: { styles?: boolean; onProgress?: (f: number) => void; signal?: AbortSignal } = {},
): Promise<TextPage[]> {
  const pages: TextPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    opts.onProgress?.((i - 1) / doc.numPages);
    const page = await doc.getPage(i);
    pages.push(await extractPage(page, opts));
    page.cleanup();
  }
  opts.onProgress?.(1);
  return pages;
}

export interface Paragraph {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  heading: 0 | 1 | 2;
  /** Sangría relativa al margen izquierdo de la página (puntos) */
  indent: number;
}

/** Une líneas en párrafos usando el espaciado vertical y detecta títulos por tamaño de letra */
export function toParagraphs(page: TextPage, bodySize: number): Paragraph[] {
  const out: Paragraph[] = [];
  const left = Math.min(...page.lines.map((l) => l.x));
  let prev: TextLine | null = null;
  for (const line of page.lines) {
    const gap = prev ? line.y - prev.y : Infinity;
    const sameStyle = prev && Math.abs(prev.fontSize - line.fontSize) < 0.8 && prev.bold === line.bold;
    // Sigue el mismo párrafo si el estilo es igual, el salto vertical es normal
    // y la línea no empieza con sangría después de un punto final
    const indented = line.x - left > line.fontSize * 1.5;
    const endsSentence = !!prev && /[.:;!?]$/.test(prev.text.trim());
    const continues = !!prev && !!sameStyle && gap < line.fontSize * 1.6 && !(indented && endsSentence);
    const last = out[out.length - 1];
    if (continues && last && !line.text.includes('\t')) {
      last.text = last.text.endsWith('-') ? last.text.slice(0, -1) + line.text.trimStart() : `${last.text} ${line.text.trim()}`;
    } else {
      const ratio = line.fontSize / bodySize;
      out.push({
        text: line.text.trim(),
        fontSize: line.fontSize,
        bold: line.bold,
        italic: line.italic,
        heading: ratio >= 1.6 ? 1 : ratio >= 1.25 ? 2 : 0,
        indent: Math.max(0, line.x - left),
      });
    }
    prev = line;
  }
  return out;
}

/** Tamaño de letra más común del documento (cuerpo del texto) */
export function bodyFontSize(pages: TextPage[]): number {
  const counts = new Map<number, number>();
  for (const p of pages) for (const l of p.lines) counts.set(Math.round(l.fontSize), (counts.get(Math.round(l.fontSize)) ?? 0) + l.text.length);
  let best = 11;
  let max = 0;
  for (const [size, n] of counts) if (n > max) [best, max] = [size, n];
  return best;
}

export function pagesToPlainText(pages: TextPage[]): string {
  return pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
}

/** Texto medio por página: si es casi nulo, el PDF probablemente es escaneado */
export function looksScanned(pages: TextPage[]): boolean {
  const chars = pages.reduce((s, p) => s + p.lines.reduce((t, l) => t + l.text.trim().length, 0), 0);
  return chars / Math.max(1, pages.length) < 15;
}
