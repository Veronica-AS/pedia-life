/**
 * Búsqueda de texto en las páginas para ocultarlo: devuelve rectángulos (coordenadas visuales 0-1).
 * Ignora mayúsculas y acentos ("Jose" encuentra "José").
 */
import type { VisualRect } from '../../lib/geometry';
import { extractPage, type TextRun } from '../../lib/textExtract';
import type { PDFDocumentProxy } from '../../lib/pdfjs';

export type PresetId = 'email' | 'phone' | 'id';

export const PRESETS: Record<PresetId, RegExp> = {
  email: /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/giu,
  // Teléfonos: 8 o más dígitos con espacios, guiones, puntos o paréntesis, con o sin prefijo +
  // (no puede ir pegado a letras: así no confunde los dígitos de una CURP o un código con un teléfono)
  phone: /(?<![\p{L}\d])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){2,4}(?![\p{L}\d])/gu,
  // Identificadores: CURP, RFC, DNI/NIE, NSS, cuentas… (8 a 24 caracteres alfanuméricos con al menos 6 dígitos o un patrón mixto)
  id: /\b(?=(?:[A-ZÑ]*\d){6,}|[A-ZÑ]{4}\d{6})[A-ZÑ\d]{8,24}\b/giu,
};

/** Quita acentos carácter a carácter conservando la longitud (para mapear posiciones) */
export function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const base = ch.normalize('NFD')[0] ?? ch;
    out += base.length === ch.length ? base.toLowerCase() : ch.toLowerCase();
  }
  return out;
}

export function textQuery(q: string): RegExp | null {
  const clean = fold(q.trim());
  if (!clean) return null;
  return new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g');
}

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;

/**
 * Fracción del ancho de un fragmento que ocupan sus primeros `chars` caracteres.
 * Se mide con una fuente sans-serif real (las letras no miden todas lo mismo: "m" ≠ "i");
 * si no hay canvas disponible, se usa una estimación proporcional.
 */
export function prefixFraction(str: string, chars: number): number {
  if (chars <= 0) return 0;
  if (chars >= str.length) return 1;
  if (measureCtx === undefined) {
    try {
      measureCtx =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(1, 1).getContext('2d')
          : typeof document !== 'undefined'
            ? document.createElement('canvas').getContext('2d')
            : null;
      if (measureCtx) measureCtx.font = '100px Helvetica, Arial, "Liberation Sans", sans-serif';
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return chars / str.length;
  const total = measureCtx.measureText(str).width;
  return total > 0 ? measureCtx.measureText(str.slice(0, chars)).width / total : chars / str.length;
}

interface Segment {
  start: number;
  end: number;
  run: TextRun;
}

/** Busca en una página y devuelve una caja por cada coincidencia (puede abarcar varios fragmentos) */
export async function searchPage(doc: PDFDocumentProxy, pageNumber: number, pattern: RegExp): Promise<{ rects: VisualRect[]; texts: string[] }> {
  const page = await doc.getPage(pageNumber);
  const tp = await extractPage(page);
  page.cleanup();
  const rects: VisualRect[] = [];
  const texts: string[] = [];
  for (const line of tp.lines) {
    // Reconstruye la línea guardando qué fragmento ocupa cada posición
    const segs: Segment[] = [];
    let text = '';
    let end = -Infinity;
    for (const r of line.runs) {
      const gap = r.x - end;
      if (text && gap > r.fontSize * 0.2 && !text.endsWith(' ') && !r.str.startsWith(' ')) text += ' ';
      segs.push({ start: text.length, end: text.length + r.str.length, run: r });
      text += r.str;
      end = Math.max(end, r.x + r.width);
    }
    const folded = fold(text);
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const m of folded.matchAll(re)) {
      if (!m[0].trim()) continue;
      const a = m.index!;
      const b = a + m[0].length;
      let x0 = Infinity, x1 = -Infinity, top = Infinity, bottom = -Infinity;
      for (const s of segs) {
        if (s.end <= a || s.start >= b) continue;
        const from = Math.max(a, s.start) - s.start;
        const to = Math.min(b, s.end) - s.start;
        x0 = Math.min(x0, s.run.x + prefixFraction(s.run.str, from) * s.run.width);
        x1 = Math.max(x1, s.run.x + prefixFraction(s.run.str, to) * s.run.width);
        top = Math.min(top, s.run.y - s.run.fontSize * 0.92);
        bottom = Math.max(bottom, s.run.y + s.run.fontSize * 0.28);
      }
      if (!isFinite(x0)) continue;
      // Margen de seguridad generoso: en una redacción es mejor tapar de más que dejar ver un trazo
      const size = bottom - top;
      const padX = Math.max(2, size * 0.35);
      const padY = Math.max(1.5, size * 0.12);
      const left = Math.max(0, x0 - padX);
      const right = Math.min(tp.width, x1 + padX);
      rects.push({
        u: left / tp.width,
        v: Math.max(0, (top - padY) / tp.height),
        w: (right - left) / tp.width,
        h: Math.min(1, (size + padY * 2) / tp.height),
      });
      texts.push(text.slice(a, b));
    }
  }
  return { rects, texts };
}
