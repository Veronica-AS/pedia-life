/** Cálculo de páginas para Imágenes a PDF (puro, se usa en la vista previa y al generar) */

export type PageSizeId = 'a4' | 'letter' | 'fit';
export type OrientationId = 'auto' | 'portrait' | 'landscape';
export type MarginId = 'none' | 'small' | 'large';

export const PAGE_SIZES: Record<Exclude<PageSizeId, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Márgenes en puntos (1 pt = 1/72 de pulgada): pequeño ≈ 10 mm, grande ≈ 20 mm */
export const MARGINS: Record<MarginId, number> = { none: 0, small: 28.35, large: 56.7 };

export interface LayoutOptions {
  pageSize: PageSizeId;
  orientation: OrientationId;
  margin: MarginId;
}

export interface PageLayout {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Píxeles → puntos asumiendo 96 ppp (tamaño "natural" en pantalla) */
const PX_TO_PT = 0.75;

export function layoutImage(imgW: number, imgH: number, opts: LayoutOptions): PageLayout {
  const margin = MARGINS[opts.margin];
  if (opts.pageSize === 'fit') {
    // Limita a 200 pulgadas (máximo del formato PDF) y respeta la proporción
    let w = imgW * PX_TO_PT;
    let h = imgH * PX_TO_PT;
    const max = 14_400 - margin * 2;
    const k = Math.min(1, max / w, max / h);
    w *= k;
    h *= k;
    return { pageWidth: w + margin * 2, pageHeight: h + margin * 2, x: margin, y: margin, width: w, height: h };
  }
  let [pw, ph] = PAGE_SIZES[opts.pageSize];
  const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && imgW > imgH);
  if (landscape) [pw, ph] = [ph, pw];
  const boxW = pw - margin * 2;
  const boxH = ph - margin * 2;
  const k = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * k;
  const height = imgH * k;
  return { pageWidth: pw, pageHeight: ph, x: (pw - width) / 2, y: (ph - height) / 2, width, height };
}

/** Países que usan tamaño Carta por defecto */
const LETTER_REGIONS = ['US', 'CA', 'MX', 'CO', 'CL', 'VE', 'PH', 'CR', 'GT', 'PA', 'SV', 'DO', 'PR', 'NI', 'HN'];

export function defaultPageSize(language: string | undefined): PageSizeId {
  const region = (language ?? '').split('-')[1]?.toUpperCase();
  return region && LETTER_REGIONS.includes(region) ? 'letter' : 'a4';
}
