import { StandardFonts, degrees, rgb } from 'pdf-lib';
import { safeText } from '../../lib/fontText';
import { pageBox, visualSize, visualToPdf, isolatePageContent } from '../../lib/geometry';
import { loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';

export * from './format';
import type { Align, PageNumberOptions } from './format';
import { fillTemplate, formatNumber } from './format';

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions, onProgress?: ProgressFn): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const first = Math.max(1, Math.min(opts.fromPage, pages.length));
  const total = pages.length - first + opts.start;
  const color = rgb(0.15, 0.15, 0.15);

  const draw = (pageIndex: number, text: string, vertical: 'top' | 'bottom', align: Align) => {
    if (!text.trim()) return;
    const page = pages[pageIndex];
    isolatePageContent(page);
    const box = pageBox(page);
    const vs = visualSize(box);
    const safe = safeText(font, text);
    const size = opts.fontSize;
    const width = font.widthOfTextAtSize(safe, size);
    const m = Math.min(opts.margin, vs.width / 4, vs.height / 4);
    // Posición visual de la línea base (en puntos desde arriba a la izquierda)
    const vx = align === 'left' ? m : align === 'right' ? vs.width - m - width : (vs.width - width) / 2;
    const vy = vertical === 'top' ? m + size * 0.8 : vs.height - m;
    const p = visualToPdf(box, vx / vs.width, vy / vs.height);
    page.drawText(safe, { x: p.x, y: p.y, size, font, color, rotate: degrees(box.rotation) });
  };

  for (let i = first - 1; i < pages.length; i++) {
    onProgress?.(i / pages.length);
    const n = i - (first - 1) + opts.start;
    if (opts.format !== 'none') {
      const vertical = opts.position[0] === 't' ? 'top' : 'bottom';
      const align: Align = opts.position[1] === 'l' ? 'left' : opts.position[1] === 'r' ? 'right' : 'center';
      draw(i, formatNumber(opts.format, n, total), vertical, align);
    }
    draw(i, fillTemplate(opts.header, n, total), 'top', opts.headerAlign);
    draw(i, fillTemplate(opts.footer, n, total), 'bottom', opts.footerAlign);
  }
  const out = await doc.save(saveOptions);
  onProgress?.(1);
  return out;
}
