import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useL } from '../i18n/I18nProvider';
import type { PDFDocumentProxy } from '../lib/pdfjs';
import { renderToUrl } from '../lib/thumbs';

/**
 * Muestra una página a lo ancho del contenedor con una capa superpuesta (firmas, zonas a ocultar…).
 * Las coordenadas de la capa son porcentajes de la página tal como se ve.
 */
export function PageStage({
  doc,
  page,
  onPageChange,
  children,
  onStagePointerDown,
  stageLabel,
}: {
  doc: PDFDocumentProxy;
  page: number;
  onPageChange: (p: number) => void;
  children?: ReactNode;
  /** Pulsación en una zona vacía de la página: coordenadas normalizadas 0-1 */
  onStagePointerDown?: (u: number, v: number, e: React.PointerEvent<HTMLDivElement>) => void;
  stageLabel?: string;
}) {
  const L = useL();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [img, setImg] = useState<{ url: string; aspect: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth / 50) * 50));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let url: string | null = null;
    let cancelled = false;
    renderToUrl(doc, page, Math.min(width, 1200)).then(
      (r) => {
        url = r.url;
        if (cancelled) URL.revokeObjectURL(r.url);
        else setImg({ url: r.url, aspect: r.width / r.height });
      },
      () => {},
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, page, width]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className="btn-icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={L('Página anterior', 'Previous page')}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <label className="flex items-center gap-2 text-sm">
          {L('Página', 'Page')}
          <select className="input w-auto py-1" value={page} onChange={(e) => onPageChange(+e.target.value)}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <span className="muted">/ {doc.numPages}</span>
        </label>
        <button type="button" className="btn-icon" disabled={page >= doc.numPages} onClick={() => onPageChange(page + 1)} aria-label={L('Página siguiente', 'Next page')}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div ref={wrap} className="w-full rounded-xl bg-slate-200 p-2 dark:bg-slate-800">
        <div
          className="relative mx-auto touch-none select-none bg-white shadow"
          style={{ aspectRatio: img ? `${img.aspect}` : '0.707', maxWidth: '100%' }}
          aria-label={stageLabel}
          data-testid="page-stage"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.stageBg) return;
            const r = e.currentTarget.getBoundingClientRect();
            onStagePointerDown?.((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e);
          }}
        >
          {img && <img src={img.url} alt="" draggable={false} data-stage-bg="1" className="absolute inset-0 h-full w-full" />}
          {children}
        </div>
      </div>
    </div>
  );
}
