import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { compressPdf, findCandidates, LEVELS, targetSize, unpredictPng, type ImageCodec } from '../../src/tools/compress/compress';
import { fixture } from './helpers';

/** Codificador falso: devuelve un JPEG real y pequeño y registra lo que recibió */
function fakeCodec() {
  const calls: { kind: string; w: number; h: number; rgbaLength?: number; srcW?: number; srcH?: number }[] = [];
  const small = fixture('photo-exif6.jpg');
  const codec: ImageCodec = {
    async jpegToJpeg(_b, w, h) {
      calls.push({ kind: 'jpeg', w, h });
      return small;
    },
    async rgbaToJpeg(rgba, srcW, srcH, w, h) {
      calls.push({ kind: 'rgba', w, h, rgbaLength: rgba.length, srcW, srcH });
      return small;
    },
  };
  return { codec, calls };
}

describe('Comprimir PDF', () => {
  it('encuentra las imágenes recomprimibles', async () => {
    const doc = await PDFDocument.load(fixture('scanned.pdf'));
    const { total, candidates } = findCandidates(doc);
    expect(total).toBe(1);
    expect(candidates[0]).toMatchObject({ width: 1700, height: 2200, filter: 'DCTDecode', comps: 3 });
  });

  it('recomprime JPEG respetando el tamaño máximo del nivel y conserva las páginas', async () => {
    const { codec, calls } = fakeCodec();
    const original = fixture('scanned.pdf');
    const { bytes, stats } = await compressPdf(original, LEVELS.recommended, codec);
    expect(calls).toEqual([{ kind: 'jpeg', w: 1236, h: 1600 }]);
    expect(stats.recompressed).toBe(1);
    expect(bytes.length).toBeLessThan(original.length);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const img = [...doc.context.enumerateIndirectObjects()].map(([, o]) => o).find((o) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) as PDFRawStream;
    expect((img.dict.get(PDFName.of('Width')) as PDFNumber).asNumber()).toBe(1236);
  });

  it('decodifica imágenes PNG (FlateDecode) a RGBA del tamaño correcto', async () => {
    const { codec, calls } = fakeCodec();
    const { stats } = await compressPdf(fixture('png-image.pdf'), LEVELS.strong, codec);
    expect(calls[0]).toMatchObject({ kind: 'rgba', srcW: 1000, srcH: 1294, rgbaLength: 1000 * 1294 * 4 });
    expect(stats.recompressed).toBe(1);
  });

  it('nunca devuelve un archivo más pesado que el original', async () => {
    const codec: ImageCodec = {
      jpegToJpeg: async () => null,
      rgbaToJpeg: async () => null,
    };
    const original = fixture('sample-5.pdf');
    const { bytes, stats } = await compressPdf(original, LEVELS.light, codec);
    expect(stats.finalSize).toBeLessThanOrEqual(original.length);
    expect(bytes.length).toBeLessThanOrEqual(original.length);
  });

  it('calcula tamaños y deshace predictores PNG', () => {
    expect(targetSize(4000, 3000, 1600)).toEqual([1600, 1200]);
    expect(targetSize(800, 600, 1600)).toEqual([800, 600]);
    // 2 filas, 2 columnas, 1 componente: filtro Sub (1) y Up (2)
    const data = new Uint8Array([1, 10, 5, 2, 1, 1]);
    expect([...unpredictPng(data, 2, 1)]).toEqual([10, 15, 11, 16]);
  });
});
