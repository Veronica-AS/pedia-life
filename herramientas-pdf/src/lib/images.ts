/**
 * Lectura y preparación de imágenes en el navegador:
 * detección de formato por contenido, orientación EXIF, HEIC del iPhone y WEBP.
 */
import { AppError } from './errors';
import { fileToBytes } from './download';
import { canvasToBlob, maxCanvasArea } from './pdfjs';
import type { PreparedImage } from '../tools/images-to-pdf/imagesToPdf';

export type ImageKind = 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'heic' | 'avif' | 'unknown';

export function detectImageKind(b: Uint8Array): ImageKind {
  if (b.length < 12) return 'unknown';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const ascii = (s: number, e: number) => String.fromCharCode(...b.subarray(s, e));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (/^(avif|avis)$/.test(brand)) return 'avif';
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'heic';
  }
  return 'unknown';
}

/** Orientación EXIF de un JPEG (1 = normal). Devuelve 1 si no hay datos. */
export function jpegOrientation(b: Uint8Array): number {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 2;
  while (off + 4 < b.length) {
    if (b[off] !== 0xff) return 1;
    const marker = b[off + 1];
    const len = view.getUint16(off + 2);
    if (marker === 0xe1 && view.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > b.length) return 1;
        if (view.getUint16(e, little) === 0x0112) return view.getUint16(e + 8, little) || 1;
      }
      return 1;
    }
    if (marker === 0xda) return 1; // inicio de datos de imagen: no hay EXIF
    off += 2 + len;
  }
  return 1;
}

/** Ancho y alto de un JPEG leyendo el marcador SOF */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 2;
  while (off + 9 < b.length) {
    if (b[off] !== 0xff) {
      off++;
      continue;
    }
    const marker = b[off + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(off + 5), width: view.getUint16(off + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    off += 2 + view.getUint16(off + 2);
  }
  return null;
}

export function pngSize(b: Uint8Array): { width: number; height: number } {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function decode(blob: Blob, fileName: string): Promise<ImageBitmap> {
  try {
    // 'from-image' aplica la orientación EXIF
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(blob);
    } catch (err) {
      throw new AppError('image-decode', { fileName, cause: err });
    }
  }
}

function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const step = Math.max(1, Math.floor((w * h) / 250_000)); // muestreo para imágenes grandes
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4 * step) if (data[i] < 255) return true;
  return false;
}

/** Dibuja la imagen en un canvas y la vuelve a codificar (JPEG si es opaca, PNG si tiene transparencia) */
async function reencode(
  bitmap: ImageBitmap,
  name: string,
  opts: { forceJpeg?: boolean; quality?: number } = {},
): Promise<PreparedImage> {
  let w = bitmap.width;
  let h = bitmap.height;
  const limit = maxCanvasArea();
  if (w * h > limit) {
    const k = Math.sqrt(limit / (w * h));
    w = Math.floor(w * k);
    h = Math.floor(h * k);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: !opts.forceJpeg });
  if (!ctx) throw new AppError('out-of-memory', { fileName: name });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const alpha = !opts.forceJpeg && hasAlpha(ctx, w, h);
  if (!alpha) {
    // JPEG no admite transparencia: fondo blanco
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  const blob = await canvasToBlob(canvas, alpha ? 'image/png' : 'image/jpeg', opts.quality ?? 0.92);
  canvas.width = canvas.height = 0;
  return { name, bytes: await fileToBytes(blob), kind: alpha ? 'png' : 'jpg', width: w, height: h };
}

async function heicToJpegBlob(file: Blob, name: string): Promise<Blob> {
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    return Array.isArray(out) ? out[0] : out;
  } catch (err) {
    throw new AppError('heic-failed', { fileName: name, cause: err });
  }
}

export interface PreparedWithPreview {
  image: PreparedImage;
  /** URL para la miniatura (siempre en un formato que el navegador puede mostrar) */
  previewUrl: string;
}

export const ACCEPTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.gif', '.bmp', '.avif'];

/**
 * Convierte cualquier imagen admitida en JPEG/PNG listo para pdf-lib.
 * Los JPEG y PNG sin rotación EXIF se incrustan tal cual (sin pérdida de calidad).
 */
export async function prepareImage(file: File): Promise<PreparedWithPreview> {
  const name = file.name;
  const bytes = await fileToBytes(file);
  if (!bytes.length) throw new AppError('empty-file', { fileName: name });
  const kind = detectImageKind(bytes);

  if (kind === 'jpg') {
    const size = jpegSize(bytes);
    if (jpegOrientation(bytes) === 1 && size) {
      return {
        image: { name, bytes, kind: 'jpg', ...size },
        previewUrl: URL.createObjectURL(file),
      };
    }
    const prepared = await reencode(await decode(file, name), name, { forceJpeg: true });
    return { image: prepared, previewUrl: URL.createObjectURL(new Blob([prepared.bytes], { type: 'image/jpeg' })) };
  }
  if (kind === 'png') {
    return { image: { name, bytes, kind: 'png', ...pngSize(bytes) }, previewUrl: URL.createObjectURL(file) };
  }
  if (kind === 'heic') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file); // Safari lo decodifica de forma nativa
    } catch {
      bitmap = null;
    }
    const prepared = bitmap
      ? await reencode(bitmap, name, { forceJpeg: true })
      : await (async () => {
          const jpeg = await heicToJpegBlob(file, name);
          const jb = await fileToBytes(jpeg);
          const size = jpegSize(jb);
          if (!size) throw new AppError('heic-failed', { fileName: name });
          return { name, bytes: jb, kind: 'jpg' as const, ...size };
        })();
    return { image: prepared, previewUrl: URL.createObjectURL(new Blob([prepared.bytes], { type: 'image/jpeg' })) };
  }
  if (kind === 'unknown') throw new AppError('unsupported-file', { fileName: name });
  const prepared = await reencode(await decode(file, name), name);
  return {
    image: prepared,
    previewUrl: URL.createObjectURL(new Blob([prepared.bytes], { type: prepared.kind === 'jpg' ? 'image/jpeg' : 'image/png' })),
  };
}

/**
 * Decodifica cualquier imagen admitida a un ImageBitmap ya orientado (EXIF aplicado).
 * HEIC: nativo en Safari; en otros navegadores se convierte a PNG (sin pérdida) con heic2any.
 */
export async function decodeImageFile(file: File): Promise<ImageBitmap> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (file.size === 0) throw new AppError('empty-file', { fileName: file.name });
  const kind = detectImageKind(head);
  if (kind === 'unknown') throw new AppError('unsupported-file', { fileName: file.name });
  if (kind === 'heic') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* el navegador no lee HEIC: se usa heic2any */
    }
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/png' });
      return await createImageBitmap(Array.isArray(out) ? out[0] : out);
    } catch (err) {
      throw new AppError('heic-failed', { fileName: file.name, cause: err });
    }
  }
  return decode(file, file.name);
}
