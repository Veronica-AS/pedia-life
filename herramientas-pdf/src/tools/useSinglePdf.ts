import { useCallback, useEffect, useState } from 'react';
import { fileToBytes } from '../lib/download';
import { AppError, toAppError } from '../lib/errors';
import { openPdf, type PDFDocumentProxy } from '../lib/pdfjs';
import { pdfTasks } from '../workers/client';

export interface LoadedPdf {
  name: string;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  pages: number;
}

/** Carga un único PDF, valida que se pueda editar y mantiene abierto el documento de pdf.js para miniaturas */
export function useSinglePdf() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const bytes = await fileToBytes(file);
      // pdf-lib detecta cifrado que pdf.js abriría sin pedir contraseña (solo permisos)
      await pdfTasks.validate(bytes, file.name);
      const doc = await openPdf(bytes, file.name);
      setPdf({ name: file.name, bytes, doc, pages: doc.numPages });
    } catch (err) {
      setError(toAppError(err, file.name));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPdf(null);
    setError(null);
  }, []);

  // Cierra el documento anterior cuando cambia o al salir de la herramienta
  useEffect(() => () => void pdf?.doc.destroy(), [pdf]);

  return { pdf, loading, error, setError, load, clear };
}
