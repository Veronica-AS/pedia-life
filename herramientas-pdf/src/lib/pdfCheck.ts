import { AppError } from './errors';

/** Comprueba la cabecera %PDF- (algunos archivos traen basura antes, se busca en los primeros 1024 bytes) */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) {
      return true;
    }
  }
  return false;
}

export function assertPdfBytes(bytes: Uint8Array, fileName?: string) {
  if (bytes.length === 0) throw new AppError('empty-file', { fileName });
  if (!looksLikePdf(bytes)) throw new AppError('not-pdf', { fileName });
}
