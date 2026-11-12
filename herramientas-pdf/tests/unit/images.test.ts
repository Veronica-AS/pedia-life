import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { detectImageKind, jpegOrientation, jpegSize, pngSize } from '../../src/lib/images';
import { imagesToPdf } from '../../src/tools/images-to-pdf/imagesToPdf';
import { defaultPageSize, layoutImage, PAGE_SIZES } from '../../src/tools/images-to-pdf/layout';
import { fixture } from './helpers';

describe('Detección de imágenes', () => {
  it('reconoce el formato por su contenido, no por la extensión', () => {
    expect(detectImageKind(fixture('scan.jpg'))).toBe('jpg');
    expect(detectImageKind(fixture('logo.png'))).toBe('png');
    expect(detectImageKind(fixture('photo.webp'))).toBe('webp');
    expect(detectImageKind(fixture('photo.heic'))).toBe('heic');
    expect(detectImageKind(fixture('sample-3.pdf'))).toBe('unknown');
  });

  it('lee la orientación EXIF y el tamaño', () => {
    expect(jpegOrientation(fixture('photo-exif6.jpg'))).toBe(6);
    expect(jpegOrientation(fixture('scan.jpg'))).toBe(1);
    expect(jpegSize(fixture('photo-exif6.jpg'))).toEqual({ width: 1200, height: 800 });
    expect(pngSize(fixture('logo.png'))).toEqual({ width: 600, height: 400 });
  });
});

describe('Diseño de página', () => {
  it('centra la imagen respetando márgenes y orientación automática', () => {
    const l = layoutImage(1200, 800, { pageSize: 'a4', orientation: 'auto', margin: 'none' });
    expect(l.pageWidth).toBeCloseTo(PAGE_SIZES.a4[1]); // horizontal
    expect(l.width).toBeCloseTo(l.pageWidth);
    expect(l.y).toBeGreaterThan(0);
    const p = layoutImage(1200, 800, { pageSize: 'letter', orientation: 'portrait', margin: 'large' });
    expect(p.pageWidth).toBe(612);
    expect(p.x).toBeCloseTo(56.7);
  });

  it('elige Carta en México y EE. UU., A4 en España', () => {
    expect(defaultPageSize('es-MX')).toBe('letter');
    expect(defaultPageSize('en-US')).toBe('letter');
    expect(defaultPageSize('es-ES')).toBe('a4');
    expect(defaultPageSize('es')).toBe('a4');
  });
});

describe('Imágenes a PDF', () => {
  it('crea una página por imagen con el tamaño de la imagen', async () => {
    const out = await imagesToPdf(
      [
        { name: 'scan.jpg', bytes: fixture('scan.jpg'), kind: 'jpg', width: 1700, height: 2200 },
        { name: 'logo.png', bytes: fixture('logo.png'), kind: 'png', width: 600, height: 400 },
      ],
      { pageSize: 'fit', orientation: 'auto', margin: 'none' },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(1).getSize()).toEqual({ width: 450, height: 300 });
  });
});
