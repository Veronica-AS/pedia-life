import { PDFDocument } from 'pdf-lib';
import { AppError, toAppError } from './errors';
import { assertPdfBytes } from './pdfCheck';

export { assertPdfBytes, looksLikePdf } from './pdfCheck';

/** Carga un PDF con pdf-lib y convierte los fallos en errores comprensibles */
export async function loadPdf(bytes: Uint8Array, fileName?: string): Promise<PDFDocument> {
  assertPdfBytes(bytes, fileName);
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (err) {
    throw toAppError(err, fileName);
  }
  if (doc.isEncrypted) throw new AppError('encrypted', { fileName });
  if (doc.getPageCount() === 0) throw new AppError('corrupt', { fileName });
  return doc;
}

export const saveOptions = { useObjectStreams: true } as const;

/** Copia título/autor/asunto/palabras clave al documento nuevo */
export function copyBasicMetadata(from: PDFDocument, to: PDFDocument) {
  try {
    const title = from.getTitle();
    const author = from.getAuthor();
    const subject = from.getSubject();
    const keywords = from.getKeywords();
    if (title) to.setTitle(title);
    if (author) to.setAuthor(author);
    if (subject) to.setSubject(subject);
    if (keywords) to.setKeywords([keywords]);
  } catch {
    /* metadatos ilegibles: se ignoran */
  }
  to.setProducer('PDF Libre');
  to.setCreator('PDF Libre');
}

export type ProgressFn = (fraction: number, label?: string) => void;
