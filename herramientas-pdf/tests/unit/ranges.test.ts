import { describe, expect, it } from 'vitest';
import { chunkPages, describeGroup, parseRanges, rangeToIndices } from '../../src/tools/split/ranges';

describe('parseRanges', () => {
  it('interpreta rangos, páginas sueltas y "hasta el final"', () => {
    expect(parseRanges('1-3, 5, 8-10', 10)).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 8, end: 10 },
    ]);
    expect(parseRanges('7-', 9)).toEqual([{ start: 7, end: 9 }]);
    expect(parseRanges('-2', 9)).toEqual([{ start: 1, end: 2 }]);
    expect(parseRanges(' 2 – 4 ; 6 ', 9)).toEqual([
      { start: 2, end: 4 },
      { start: 6, end: 6 },
    ]);
  });

  it('da errores claros en español', () => {
    expect(() => parseRanges('', 5)).toThrowError();
    for (const [input, detail] of [
      ['12', 'se sale del documento, que tiene 5 páginas'],
      ['4-2', 'el inicio es mayor que el final'],
      ['abc', 'No se entiende'],
      ['0', 'empiezan en 1'],
    ]) {
      try {
        parseRanges(input, 5);
        throw new Error('no falló');
      } catch (err) {
        const e = err as { code: string; detail: string };
        expect(e.code).toBe('invalid-range');
        expect(e.detail).toContain(detail);
      }
    }
  });

  it('convierte a índices y agrupa', () => {
    expect(rangeToIndices({ start: 2, end: 4 })).toEqual([1, 2, 3]);
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(describeGroup([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
  });
});
