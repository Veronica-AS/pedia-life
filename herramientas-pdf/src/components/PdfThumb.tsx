import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from '../lib/pdfjs';
import { renderToUrl } from '../lib/thumbs';

/**
 * Miniatura de una página. Solo se dibuja cuando entra en pantalla
 * (permite documentos de cientos de páginas sin agotar la memoria).
 */
export function PdfThumb({
  doc,
  pageNumber,
  rotation = 0,
  width = 160,
  alt,
  className = '',
}: {
  doc: PDFDocumentProxy | null;
  pageNumber: number;
  rotation?: number;
  width?: number;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !doc) return;
    let cancelled = false;
    let url: string | null = null;
    renderToUrl(doc, pageNumber, width).then(
      (r) => {
        url = r.url;
        if (cancelled) URL.revokeObjectURL(r.url);
        else setSrc(r.url);
      },
      () => {
        /* el documento se cerró mientras se dibujaba */
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setSrc(null);
    };
  }, [visible, doc, pageNumber, width]);

  return (
    <div ref={ref} className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full bg-white shadow transition-transform duration-200"
          style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined, maxWidth: rotation % 180 ? '100%' : undefined }}
        />
      ) : (
        <div className="h-3/4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      )}
    </div>
  );
}
