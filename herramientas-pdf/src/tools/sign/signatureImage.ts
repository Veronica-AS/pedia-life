/** Utilidades de imagen para firmas: recortar al trazo, quitar fondo blanco y exportar PNG transparente */
import { canvasToBlob } from '../../lib/pdfjs';

export interface SignatureAsset {
  id: string;
  png: Uint8Array;
  url: string;
  /** ancho / alto */
  aspect: number;
}

/** Recorta el canvas al área con contenido (alfa > 0) dejando un pequeño margen */
export function trimCanvas(src: HTMLCanvasElement, pad = 8): HTMLCanvasElement | null {
  const ctx = src.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // vacío
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Vuelve transparentes los píxeles claros (fondo de papel) con un borde suave */
export function removeLightBackground(canvas: HTMLCanvasElement, threshold = 200) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum >= threshold) d[i + 3] = 0;
    else if (lum > threshold - 50) d[i + 3] = Math.round(d[i + 3] * ((threshold - lum) / 50));
  }
  ctx.putImageData(img, 0, 0);
}

let seq = 0;

export async function canvasToAsset(canvas: HTMLCanvasElement): Promise<SignatureAsset | null> {
  const trimmed = trimCanvas(canvas);
  if (!trimmed) return null;
  const blob = await canvasToBlob(trimmed, 'image/png');
  return {
    id: `sig${++seq}`,
    png: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
    aspect: trimmed.width / trimmed.height,
  };
}

export const SIGNATURE_FONTS = [
  { family: 'Dancing Script', label: 'Dancing Script' },
  { family: 'Great Vibes', label: 'Great Vibes' },
  { family: 'Caveat', label: 'Caveat' },
];

/** Dibuja un nombre con una fuente manuscrita y lo convierte en firma */
export async function textToAsset(text: string, family: string, color: string): Promise<SignatureAsset | null> {
  const size = 120;
  try {
    await document.fonts.load(`${size}px "${family}"`, text);
  } catch {
    /* si la fuente no carga se usa la de respaldo */
  }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `${size}px "${family}", cursive`;
  const w = Math.ceil(ctx.measureText(text).width) + size;
  c.width = Math.min(4000, w);
  c.height = Math.round(size * 1.8);
  const ctx2 = c.getContext('2d')!;
  ctx2.font = `${size}px "${family}", cursive`;
  ctx2.fillStyle = color;
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, size / 2, c.height / 2);
  return canvasToAsset(c);
}
