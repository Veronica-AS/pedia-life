import { AppError } from '../../lib/errors';

export interface PageRange {
  start: number; // 1-based, inclusivo
  end: number; // 1-based, inclusivo
}

/**
 * Interpreta "1-3, 5, 8-10, 12-" (12- = hasta el final).
 * Acepta guiones largos y espacios; lanza AppError('invalid-range') con detalle en español.
 */
export function parseRanges(input: string, pageCount: number): PageRange[] {
  const clean = input.replace(/[–—]/g, '-').replace(/;/g, ',').trim();
  if (!clean) throw new AppError('invalid-range', { detail: 'Escribe al menos una página o rango.' });
  const ranges: PageRange[] = [];
  for (const raw of clean.split(',')) {
    const part = raw.replace(/\s+/g, '');
    if (!part) continue;
    const m = /^(\d+)?(-)?(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) {
      throw new AppError('invalid-range', { detail: `No se entiende "${raw.trim()}".` });
    }
    const start = m[1] ? parseInt(m[1], 10) : 1;
    const end = m[2] ? (m[3] ? parseInt(m[3], 10) : pageCount) : start;
    if (start < 1 || end < 1) throw new AppError('invalid-range', { detail: 'Las páginas empiezan en 1.' });
    if (start > pageCount || end > pageCount) {
      throw new AppError('invalid-range', {
        detail: `"${raw.trim()}" se sale del documento, que tiene ${pageCount} página${pageCount === 1 ? '' : 's'}.`,
      });
    }
    if (start > end) {
      throw new AppError('invalid-range', { detail: `En "${raw.trim()}" el inicio es mayor que el final.` });
    }
    ranges.push({ start, end });
  }
  if (!ranges.length) throw new AppError('invalid-range', { detail: 'Escribe al menos una página o rango.' });
  return ranges;
}

/** Rango → índices 0-based */
export const rangeToIndices = (r: PageRange) => Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start - 1 + i);

/** Agrupa todas las páginas de n en n */
export function chunkPages(pageCount: number, size: number): number[][] {
  const groups: number[][] = [];
  const n = Math.max(1, Math.floor(size));
  for (let i = 0; i < pageCount; i += n) {
    groups.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, k) => i + k));
  }
  return groups;
}

export function describeGroup(indices: number[]): string {
  if (!indices.length) return '';
  const parts: string[] = [];
  let s = indices[0];
  let prev = s;
  for (let i = 1; i <= indices.length; i++) {
    const cur = indices[i];
    if (cur !== prev + 1) {
      parts.push(s === prev ? `${s + 1}` : `${s + 1}-${prev + 1}`);
      s = cur;
    }
    prev = cur;
  }
  return parts.join(', ');
}
