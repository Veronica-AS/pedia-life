import { describe, expect, it } from 'vitest';
import { diffSequences } from '../../src/tools/compare/diff';

const words = (s: string) => s.split(' ');
const render = (a: string[], b: string[]) =>
  diffSequences(a, b)
    .map((o) =>
      o.type === 'equal' ? a.slice(o.aStart, o.aEnd).join(' ') : o.type === 'delete' ? `[-${a.slice(o.aStart, o.aEnd).join(' ')}-]` : `{+${b.slice(o.bStart, o.bEnd).join(' ')}+}`,
    )
    .join(' ');

describe('Diferencias (Myers)', () => {
  it('detecta palabras cambiadas, añadidas y quitadas', () => {
    const a = words('la renta mensual será de $8,500 pagaderos el día uno');
    const b = words('la renta mensual será de $9,000 pagaderos el día cinco de cada mes');
    expect(render(a, b)).toBe('la renta mensual será de [-$8,500-] {+$9,000+} pagaderos el día [-uno-] {+cinco de cada mes+}');
  });

  it('documentos iguales y vacíos', () => {
    expect(diffSequences(words('a b c'), words('a b c'))).toEqual([{ type: 'equal', aStart: 0, aEnd: 3, bStart: 0, bEnd: 3 }]);
    expect(diffSequences([], words('a b'))).toEqual([{ type: 'insert', aStart: 0, aEnd: 0, bStart: 0, bEnd: 2 }]);
    expect(diffSequences(words('a b'), [])).toEqual([{ type: 'delete', aStart: 0, aEnd: 2, bStart: 0, bEnd: 0 }]);
  });

  it('cubre siempre ambas secuencias completas, también en casos aleatorios', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 200; t++) {
      const a = Array.from({ length: Math.floor(rnd() * 30) }, () => 'abcde'[Math.floor(rnd() * 5)]);
      const b = Array.from({ length: Math.floor(rnd() * 30) }, () => 'abcde'[Math.floor(rnd() * 5)]);
      const ops = diffSequences(a, b);
      let ai = 0;
      let bi = 0;
      for (const o of ops) {
        expect(o.aStart).toBe(ai);
        expect(o.bStart).toBe(bi);
        if (o.type === 'equal') expect(a.slice(o.aStart, o.aEnd)).toEqual(b.slice(o.bStart, o.bEnd));
        ai = o.aEnd;
        bi = o.bEnd;
      }
      expect([ai, bi]).toEqual([a.length, b.length]);
    }
  });

  it('documentos grandes y muy distintos no bloquean', () => {
    const a = Array.from({ length: 20000 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 20000 }, (_, i) => `b${i}`);
    const t0 = Date.now();
    const ops = diffSequences(a, b, 500);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(ops.map((o) => o.type)).toEqual(['delete', 'insert']);
  });
});
