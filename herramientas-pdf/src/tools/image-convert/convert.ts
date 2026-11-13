import { AppError } from '../../lib/errors';
import { decodeImageFile } from '../../lib/images';
import { canvasToBlob, maxCanvasArea } from '../../lib/pdfjs';
import { baseName } from '../../lib/format';

export type OutFormat = 'jpg' | 'png' | 'webp';
export const MIME: Record<OutFormat, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export interface ConvertOptions {
  format: OutFormat;
  /** 0-1, solo JPG y WEBP */
  quality: number;
  /** Lado mayor máximo en píxeles (0 = tamaño original) */
  maxSide: number;
}

export interface Converted {
  name: string;
  bytes: Uint8Array;
  type: string;
  width: number;
  height: number;
  originalSize: number;
  originalName: string;
}

export function fitSize(w: number, h: number, maxSide: number, maxArea: number): [number, number] {
  let k = maxSide > 0 ? Math.min(1, maxSide / Math.max(w, h)) : 1;
  if (w * k * h * k > maxArea) k = Math.sqrt(maxArea / (w * h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

export async function convertImage(file: File, o: ConvertOptions): Promise<Converted> {
  const bmp = await decodeImageFile(file);
  const [w, h] = fitSize(bmp.width, bmp.height, o.maxSide, maxCanvasArea());
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('out-of-memory', { fileName: file.name });
  if (o.format === 'jpg') {
    // JPG no tiene transparencia: fondo blanco en lugar de negro
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await canvasToBlob(canvas, MIME[o.format], o.format === 'png' ? undefined : o.quality);
  canvas.width = canvas.height = 0;
  // Si el navegador no sabe crear el formato, devuelve PNG en silencio: se detecta y se avisa
  if (blob.type !== MIME[o.format]) throw new AppError('format-unsupported', { fileName: file.name });
  return {
    name: `${baseName(file.name)}.${o.format}`,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    type: blob.type,
    width: w,
    height: h,
    originalSize: file.size,
    originalName: file.name,
  };
}
