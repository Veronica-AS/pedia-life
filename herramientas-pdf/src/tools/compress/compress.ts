/**
 * Compresión de PDF conservando el texto: se vuelven a codificar las imágenes
 * internas (JPEG y PNG/Flate) con menor resolución y calidad según el nivel.
 * El texto, los vectores y las fuentes no se tocan, por lo que siguen siendo seleccionables.
 *
 * Puede ejecutarse en un Web Worker (OffscreenCanvas) o en la página (canvas normal).
 */
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFDocument, type PDFObject } from 'pdf-lib';
import { inflate } from 'pako';
import { loadPdf, type ProgressFn } from '../../lib/pdf';

export { LEVELS, type CompressLevel, type CompressStats, type LevelId } from './levels';
import type { CompressLevel, CompressStats } from './levels';

/** Codificador de imágenes inyectable (permite pruebas y elegir Worker o página) */
export interface ImageCodec {
  /** Decodifica un JPEG y lo vuelve a codificar al tamaño indicado */
  jpegToJpeg(bytes: Uint8Array, width: number, height: number, quality: number): Promise<Uint8Array | null>;
  /** Codifica píxeles RGBA a JPEG redimensionando */
  rgbaToJpeg(
    rgba: Uint8ClampedArray,
    srcW: number,
    srcH: number,
    width: number,
    height: number,
    quality: number,
  ): Promise<Uint8Array | null>;
}

const N = (s: string) => PDFName.of(s);

function lookup(doc: PDFDocument, obj: PDFObject | undefined): PDFObject | undefined {
  return obj instanceof PDFRef ? doc.context.lookup(obj) : obj;
}

function nameOf(obj: PDFObject | undefined): string | undefined {
  return obj instanceof PDFName ? obj.decodeText() : undefined;
}

function numberOf(doc: PDFDocument, obj: PDFObject | undefined): number | undefined {
  const o = lookup(doc, obj);
  return o instanceof PDFNumber ? o.asNumber() : undefined;
}

/** Devuelve el número de componentes de color si el espacio es compatible (Gray o RGB), si no null */
function colorComponents(doc: PDFDocument, cs: PDFObject | undefined): 1 | 3 | null {
  const o = lookup(doc, cs);
  const name = nameOf(o);
  if (name === 'DeviceRGB' || name === 'CalRGB') return 3;
  if (name === 'DeviceGray' || name === 'CalGray') return 1;
  if (o instanceof PDFArray && o.size() >= 1) {
    const kind = nameOf(lookup(doc, o.get(0)));
    if (kind === 'CalRGB') return 3;
    if (kind === 'CalGray') return 1;
    if (kind === 'ICCBased') {
      const stream = lookup(doc, o.get(1));
      if (stream instanceof PDFRawStream) {
        const n = numberOf(doc, stream.dict.get(N('N')));
        if (n === 3) return 3;
        if (n === 1) return 1;
      }
    }
  }
  return null; // CMYK, Indexed, Separation, Lab…: se dejan como están
}

function singleFilter(doc: PDFDocument, dict: PDFDict): string | undefined {
  const f = lookup(doc, dict.get(N('Filter')));
  if (f instanceof PDFName) return f.decodeText();
  if (f instanceof PDFArray && f.size() === 1) return nameOf(lookup(doc, f.get(0)));
  return f === undefined ? 'None' : undefined;
}

/** Deshace los predictores PNG (valores 10-15) de FlateDecode */
export function unpredictPng(data: Uint8Array, columns: number, colors: number, bpc = 8): Uint8Array {
  const bpp = Math.max(1, Math.round((colors * bpc) / 8));
  const rowLen = Math.ceil((columns * colors * bpc) / 8);
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1));
    const cur = out.subarray(r * rowLen, (r + 1) * rowLen);
    for (let i = 0; i < rowLen; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let v: number;
      switch (type) {
        case 1:
          v = src[i] + left;
          break;
        case 2:
          v = src[i] + up;
          break;
        case 3:
          v = src[i] + ((left + up) >> 1);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          v = src[i] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default:
          v = src[i];
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return out;
}

function toRgba(pixels: Uint8Array, w: number, h: number, comps: 1 | 3): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += comps) {
    const o = i * 4;
    if (comps === 3) {
      out[o] = pixels[j];
      out[o + 1] = pixels[j + 1];
      out[o + 2] = pixels[j + 2];
    } else {
      out[o] = out[o + 1] = out[o + 2] = pixels[j];
    }
    out[o + 3] = 255;
  }
  return out;
}

export function targetSize(w: number, h: number, maxDim: number): [number, number] {
  const k = Math.min(1, maxDim / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/** Referencias usadas como máscara (no se recomprimen para no degradar bordes ni transparencias) */
function maskRefs(doc: PDFDocument): Set<string> {
  const set = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      for (const key of ['SMask', 'Mask']) {
        const v = obj.dict.get(N(key));
        if (v instanceof PDFRef) set.add(v.toString());
      }
    }
  }
  return set;
}

export interface ImageCandidate {
  ref: PDFRef;
  stream: PDFRawStream;
  width: number;
  height: number;
  filter: 'DCTDecode' | 'FlateDecode';
  comps: 1 | 3;
}

/** Busca las imágenes que se pueden recomprimir con seguridad */
export function findCandidates(doc: PDFDocument): { total: number; candidates: ImageCandidate[] } {
  const masks = maskRefs(doc);
  const candidates: ImageCandidate[] = [];
  let total = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (nameOf(dict.get(N('Subtype'))) !== 'Image') continue;
    total++;
    if (masks.has(ref.toString())) continue;
    const imageMask = lookup(doc, dict.get(N('ImageMask')));
    if (imageMask && imageMask.toString() === 'true') continue;
    if (dict.get(N('Decode'))) continue;
    if (lookup(doc, dict.get(N('Mask'))) instanceof PDFArray) continue; // máscara por color: JPEG la rompería
    const width = numberOf(doc, dict.get(N('Width')));
    const height = numberOf(doc, dict.get(N('Height')));
    if (!width || !height) continue;
    if (width * height < 160 * 160) continue; // íconos pequeños: no vale la pena
    const comps = colorComponents(doc, dict.get(N('ColorSpace')));
    if (!comps) continue;
    const filter = singleFilter(doc, dict);
    if (filter === 'DCTDecode') {
      candidates.push({ ref, stream: obj, width, height, filter, comps });
    } else if (filter === 'FlateDecode') {
      if (numberOf(doc, dict.get(N('BitsPerComponent'))) !== 8) continue;
      candidates.push({ ref, stream: obj, width, height, filter, comps });
    }
  }
  return { total, candidates };
}

function decodeFlatePixels(doc: PDFDocument, c: ImageCandidate): Uint8Array | null {
  let data: Uint8Array;
  try {
    data = inflate(c.stream.contents);
  } catch {
    return null;
  }
  const parms = lookup(doc, c.stream.dict.get(N('DecodeParms')));
  const parmsDict = parms instanceof PDFArray ? lookup(doc, parms.get(0)) : parms;
  if (parmsDict instanceof PDFDict) {
    const predictor = numberOf(doc, parmsDict.get(N('Predictor'))) ?? 1;
    if (predictor >= 10) {
      const colors = numberOf(doc, parmsDict.get(N('Colors'))) ?? 1;
      const columns = numberOf(doc, parmsDict.get(N('Columns'))) ?? 1;
      if (colors !== c.comps || columns !== c.width) return null;
      data = unpredictPng(data, columns, colors);
    } else if (predictor !== 1) {
      return null; // predictor TIFF: poco común, se deja igual
    }
  }
  if (data.length < c.width * c.height * c.comps) return null;
  return data;
}

/** Comprime en memoria. No modifica el arreglo recibido. */
export async function compressPdf(
  bytes: Uint8Array,
  level: CompressLevel,
  codec: ImageCodec,
  onProgress?: ProgressFn,
): Promise<{ bytes: Uint8Array; stats: CompressStats }> {
  const doc = await loadPdf(bytes);
  const { total, candidates } = findCandidates(doc);
  let recompressed = 0;

  for (let i = 0; i < candidates.length; i++) {
    onProgress?.((i / Math.max(1, candidates.length)) * 0.9);
    const c = candidates[i];
    const [tw, th] = targetSize(c.width, c.height, level.maxDim);
    let encoded: Uint8Array | null = null;
    try {
      if (c.filter === 'DCTDecode') {
        encoded = await codec.jpegToJpeg(c.stream.contents, tw, th, level.quality);
      } else {
        const pixels = decodeFlatePixels(doc, c);
        if (pixels) encoded = await codec.rgbaToJpeg(toRgba(pixels, c.width, c.height, c.comps), c.width, c.height, tw, th, level.quality);
      }
    } catch {
      encoded = null; // si una imagen falla, se conserva la original
    }
    if (!encoded || encoded.length >= c.stream.contents.length) continue;

    const dict = c.stream.dict.clone(doc.context);
    dict.set(N('Width'), PDFNumber.of(tw));
    dict.set(N('Height'), PDFNumber.of(th));
    dict.set(N('Filter'), N('DCTDecode'));
    dict.set(N('ColorSpace'), N('DeviceRGB'));
    dict.set(N('BitsPerComponent'), PDFNumber.of(8));
    dict.delete(N('DecodeParms'));
    dict.delete(N('Length'));
    doc.context.assign(c.ref, PDFRawStream.of(dict, encoded));
    recompressed++;
  }

  onProgress?.(0.92);
  const out = await doc.save({ useObjectStreams: true });
  onProgress?.(1);
  const smaller = out.length < bytes.length;
  return {
    // Nunca se entrega un archivo más pesado que el original
    bytes: smaller ? out : bytes,
    stats: { images: total, recompressed, originalSize: bytes.length, finalSize: smaller ? out.length : bytes.length },
  };
}

/** Codificador basado en canvas (OffscreenCanvas en Workers, canvas normal en la página) */
export function createCanvasCodec(): ImageCodec {
  const makeCanvas = (w: number, h: number) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    throw new Error('NO_CANVAS');
  };
  const toJpeg = async (canvas: OffscreenCanvas | HTMLCanvasElement, quality: number) => {
    const blob =
      'convertToBlob' in canvas
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
        : await new Promise<Blob | null>((r) => (canvas as HTMLCanvasElement).toBlob(r, 'image/jpeg', quality));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  };
  const draw = async (source: CanvasImageSource, w: number, h: number, quality: number) => {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    const out = await toJpeg(canvas, quality);
    canvas.width = canvas.height = 0;
    return out;
  };
  return {
    async jpegToJpeg(bytes, w, h, quality) {
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { imageOrientation: 'none' } as ImageBitmapOptions);
      try {
        return await draw(bmp, w, h, quality);
      } finally {
        bmp.close();
      }
    },
    async rgbaToJpeg(rgba, srcW, srcH, w, h, quality) {
      const bmp = await createImageBitmap(new ImageData(rgba, srcW, srcH));
      try {
        return await draw(bmp, w, h, quality);
      } finally {
        bmp.close();
      }
    },
  };
}
