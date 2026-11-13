import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { PDFDocumentProxy } from '../lib/pdfjs';
import { renderToUrl } from '../lib/thumbs';
import { Modal } from './Modal';

/** Visor ampliado de una página, con navegación y zoom */
export function PageViewer({
  doc,
  page,
  onPageChange,
  onClose,
  title,
}: {
  doc: PDFDocumentProxy;
  page: number | null;
  onPageChange: (p: number) => void;
  onClose: () => void;
  title?: string;
}) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (page == null) return;
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    const width = Math.min(window.innerWidth, 1100) * (zoom ? 2.5 : 1);
    renderToUrl(doc, page, width, 'image/png').then((r) => {
      url = r.url;
      if (cancelled) URL.revokeObjectURL(r.url);
      else setSrc(r.url);
    }, () => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, page, zoom]);

  useEffect(() => {
    if (page == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && page < doc.numPages) onPageChange(page + 1);
      if (e.key === 'ArrowLeft' && page > 1) onPageChange(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, doc.numPages, onPageChange]);

  return (
    <Modal open={page != null} onClose={onClose} title={title ?? t('page', { n: page ?? 1 })}>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 dark:bg-slate-950">
          {src ? (
            <img src={src} alt={t('page', { n: page ?? 1 })} className={`mx-auto bg-white shadow ${zoom ? 'max-w-none' : 'max-h-full max-w-full object-contain'}`} style={zoom ? { width: '250%' } : undefined} />
          ) : (
            <div className="mx-auto mt-10 h-96 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-2 dark:border-slate-800">
          <button type="button" className="btn-icon" disabled={!page || page <= 1} onClick={() => page && onPageChange(page - 1)} aria-label={t('prevPage')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-sm tabular-nums">
            {page} / {doc.numPages}
          </span>
          <button type="button" className="btn-icon" onClick={() => setZoom((z) => !z)} aria-pressed={zoom} aria-label={zoom ? 'Zoom −' : 'Zoom +'}>
            {zoom ? <ZoomOut className="h-5 w-5" aria-hidden="true" /> : <ZoomIn className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button type="button" className="btn-icon" disabled={!page || page >= doc.numPages} onClick={() => page && onPageChange(page + 1)} aria-label={t('nextPage')}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
