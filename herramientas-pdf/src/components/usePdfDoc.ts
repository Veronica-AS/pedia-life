import { useEffect, useState } from 'react';
import { openPdf, type PDFDocumentProxy } from '../lib/pdfjs';
import { toAppError, type AppError } from '../lib/errors';

/** Abre un PDF con pdf.js para miniaturas/vista previa y lo cierra al desmontar */
export function usePdfDoc(bytes: Uint8Array | null, fileName?: string, password?: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  useEffect(() => {
    setDoc(null);
    setError(null);
    if (!bytes) return;
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openPdf(bytes, fileName, password).then(
      (d) => {
        opened = d;
        if (cancelled) d.destroy();
        else setDoc(d);
      },
      (err) => !cancelled && setError(toAppError(err, fileName)),
    );
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [bytes, fileName, password]);
  return { doc, error };
}
