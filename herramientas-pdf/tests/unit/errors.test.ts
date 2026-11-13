import { describe, expect, it } from 'vitest';
import { AppError, ERROR_TEXT, toAppError } from '../../src/lib/errors';

describe('Errores', () => {
  it('se reconstruyen tras cruzar el Worker (solo viaja el mensaje)', () => {
    const original = new AppError('encrypted', { fileName: 'a.pdf' });
    const cruzado = new Error(original.message);
    const e = toAppError(cruzado);
    expect(e.code).toBe('encrypted');
    expect(e.fileName).toBe('a.pdf');
  });

  it('clasifica errores comunes de las librerías', () => {
    expect(toAppError(Object.assign(new Error('x'), { name: 'PasswordException' })).code).toBe('encrypted');
    expect(toAppError(Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' })).code).toBe('corrupt');
    expect(toAppError(new RangeError('Array buffer allocation failed')).code).toBe('out-of-memory');
    expect(toAppError('???').code).toBe('unknown');
  });

  it('todos los códigos tienen mensaje en español e inglés', () => {
    for (const code of Object.keys(ERROR_TEXT.es)) {
      expect(ERROR_TEXT.en[code as keyof typeof ERROR_TEXT.en]).toBeTruthy();
      expect(ERROR_TEXT.es[code as keyof typeof ERROR_TEXT.es].fix.length).toBeGreaterThan(10);
    }
  });
});
