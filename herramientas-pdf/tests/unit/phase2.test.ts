import { PDFDocument, PDFName } from 'pdf-lib';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { pageBox, visualToPdf, placeRect } from '../../src/lib/geometry';
import { addPageNumbers, DEFAULT_PAGE_NUMBERS, fillTemplate, formatNumber } from '../../src/tools/page-numbers/pageNumbers';
import { cleanMetadata, readMetadata } from '../../src/tools/metadata/metadata';
import { fillForm, readForm } from '../../src/tools/fill-form/fillForm';
import { signPdf } from '../../src/tools/sign/sign';
import { addOcrToPdf, imagesToSearchablePdf } from '../../src/tools/ocr/textLayer';
import { assembleRedacted } from '../../src/tools/redact/redact';
import { decryptPdf, encryptPdf, type QpdfFactory } from '../../src/tools/protect/qpdf';
import { bodyFontSize, extractDocument, looksScanned, pagesToPlainText, toParagraphs } from '../../src/lib/textExtract';
import { expectCode, fixture } from './helpers';
import { openNode, pageTexts } from './pdfjsNode';

const require = createRequire(import.meta.url);

describe('Geometría de página', () => {
  const b = { x: 0, y: 0, width: 600, height: 800, rotation: 0 };
  it('convierte coordenadas visuales a PDF con cada rotación', () => {
    expect(visualToPdf(b, 0, 0)).toEqual({ x: 0, y: 800 });
    expect(visualToPdf({ ...b, rotation: 90 }, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(visualToPdf({ ...b, rotation: 90 }, 0, 1)).toEqual({ x: 600, y: 0 });
    expect(visualToPdf({ ...b, rotation: 180 }, 0, 0)).toEqual({ x: 600, y: 0 });
    expect(visualToPdf({ ...b, rotation: 270 }, 0, 0)).toEqual({ x: 600, y: 800 });
    const r = placeRect({ ...b, rotation: 90 }, { u: 0, v: 0, w: 0.5, h: 0.25 });
    expect(r).toMatchObject({ width: 400, height: 150, angle: 90 });
  });
});

describe('Numerar páginas', () => {
  it('formatea números y plantillas', () => {
    expect(formatNumber('page-n-of-total', 2, 9)).toBe('Página 2 de 9');
    expect(fillTemplate('Hoja {n}/{total}', 3, 4)).toBe('Hoja 3/4');
  });

  it('numera, añade encabezado y el texto queda derecho incluso en páginas giradas', async () => {
    const out = await addPageNumbers(fixture('sample-5.pdf'), {
      ...DEFAULT_PAGE_NUMBERS,
      format: 'page-n-of-total',
      position: 'br',
      fromPage: 2,
      header: 'Confidencial · {n}',
    });
    const pages = await pageTexts(out);
    expect(pages[0].text).not.toContain('Página 1 de 4');
    expect(pages[1].text).toContain('Página 1 de 4');
    expect(pages[3].text).toContain('Página 3 de 4'); // página 4 del original, girada 90°
    const num = pages[3].items.find((i) => i.str.includes('Página 3 de 4'))!;
    expect(num.upright).toBe(true);
    // abajo a la derecha de la página tal como se ve (horizontal: 842 × 595)
    expect(num.x).toBeGreaterThan(pages[3].width / 2);
    expect(num.y).toBeGreaterThan(pages[3].height - 60);
    expect(pages[1].text).toContain('Confidencial · 1');
  });
});

describe('Metadatos', () => {
  it('muestra y elimina todos los metadatos', async () => {
    const before = await readMetadata(fixture('sample-5.pdf'));
    expect(before.title).toBe('Documento de ejemplo');
    expect(before.author).toBe('Pruebas PDF Libre');
    const cleaned = await cleanMetadata(fixture('sample-5.pdf'));
    const after = await readMetadata(cleaned);
    expect(after).toMatchObject({ title: undefined, author: undefined, producer: undefined, creator: undefined, hasXmp: false });
    expect(after.creationDate).toBeUndefined();
    expect((await PDFDocument.load(cleaned)).getPageCount()).toBe(5);
  });

  it('puede conservar o escribir los valores que el usuario quiera', async () => {
    const out = await cleanMetadata(fixture('sample-5.pdf'), { title: 'Informe final' });
    const m = await readMetadata(out);
    expect(m.title).toBe('Informe final');
    expect(m.author).toBeUndefined();
  });
});

describe('Rellenar formularios', () => {
  it('lee los campos con su tipo y página', async () => {
    const { fields, hasXfa } = await readForm(fixture('form.pdf'));
    expect(hasXfa).toBe(false);
    expect(fields.map((f) => [f.name, f.kind, f.page])).toEqual([
      ['nombre', 'text', 1],
      ['correo', 'text', 1],
      ['acepto', 'checkbox', 1],
      ['pais', 'dropdown', 1],
    ]);
    expect(fields[3].options).toContain('México');
  });

  it('rellena con acentos y puede aplanar', async () => {
    const values = { nombre: 'José Núñez Peña', correo: 'jose@example.com', acepto: true, pais: 'México' };
    const out = await fillForm(fixture('form.pdf'), values, false);
    const { fields } = await readForm(out);
    expect(Object.fromEntries(fields.map((f) => [f.name, f.value]))).toEqual(values);
    const flat = await fillForm(fixture('form.pdf'), values, true);
    expect((await readForm(flat)).fields).toHaveLength(0);
    expect((await pageTexts(flat))[0].text).toContain('José Núñez Peña');
  });
});

describe('Firmar', () => {
  it('coloca la firma en la página indicada', async () => {
    const png = fixture('logo.png');
    const out = await signPdf(fixture('sample-5.pdf'), [{ id: 'a', png }], [
      { imageId: 'a', page: 4, rect: { u: 0.6, v: 0.8, w: 0.3, h: 0.1 } },
      { imageId: 'a', page: 1, rect: { u: 0.1, v: 0.1, w: 0.2, h: 0.1 } },
    ]);
    const doc = await PDFDocument.load(out);
    const images = (p: number) => {
      const x = doc.getPage(p).node.Resources()?.lookup(PDFName.of('XObject')) as { keys(): unknown[] } | undefined;
      return x ? x.keys().length : 0;
    };
    expect(images(3)).toBe(1);
    expect(images(0)).toBe(1);
    expect(images(1)).toBe(0);
  });
});

describe('Capa de texto OCR', () => {
  const lines = [{ text: 'CONTRATO DE ARRENDAMIENTO', x0: 0.09, y0: 0.08, x1: 0.6, y1: 0.105, confidence: 95 }];

  it('añade texto invisible y buscable sobre un PDF escaneado', async () => {
    expect((await pageTexts(fixture('scanned.pdf')))[0].text.trim()).toBe('');
    const out = await addOcrToPdf(fixture('scanned.pdf'), [{ lines }, null]);
    const pages = await pageTexts(out);
    expect(pages[0].text).toContain('CONTRATO DE ARRENDAMIENTO');
    expect(pages[1].text.trim()).toBe('');
    const item = pages[0].items.find((i) => i.str.includes('CONTRATO'))!;
    expect(item.x / pages[0].width).toBeCloseTo(0.09, 2);
    // El texto se escribe en modo invisible (Tr 3): no tapa la imagen escaneada
    const pdf = await openNode(out);
    const ops = await (await pdf.getPage(1)).getOperatorList();
    const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const modes = ops.fnArray.flatMap((fn, i) => (fn === OPS.setTextRenderingMode ? [ops.argsArray[i][0]] : []));
    expect(modes).toContain(3);
  });

  it('crea un PDF buscable desde imágenes', async () => {
    const out = await imagesToSearchablePdf([{ bytes: fixture('scan.jpg'), kind: 'jpg', ocr: { lines } }], { pageSize: 'a4', orientation: 'auto', margin: 'none' });
    const pages = await pageTexts(out);
    expect(pages).toHaveLength(1);
    expect(pages[0].text).toContain('ARRENDAMIENTO');
  });
});

describe('Redacción', () => {
  it('sustituye las páginas redactadas: su texto deja de existir', async () => {
    const out = await assembleRedacted(fixture('sample-5.pdf'), [{ index: 1, jpg: fixture('scan.jpg') }]);
    const pages = await pageTexts(out);
    expect(pages).toHaveLength(5);
    expect(pages[1].text.trim()).toBe('');
    expect(pages[0].text).toContain('Página 1 de 5');
    expect(pages[3].width).toBeCloseTo(841.89, 0); // la página girada conserva su forma visible
    const doc = await PDFDocument.load(out);
    expect(doc.getTitle()).toBeUndefined();
  });
});

describe('Contraseñas (qpdf)', () => {
  const factory: QpdfFactory = async () => {
    const create = require('@neslinesli93/qpdf-wasm');
    return create({ locateFile: () => require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'), print: () => {}, printErr: () => {} });
  };

  it('protege con AES-256 y se abre solo con la contraseña', async () => {
    const enc = await encryptPdf(factory, fixture('sample-3.pdf'), { userPassword: 'Contraseña 1', allowPrint: true, allowCopy: false, allowModify: false });
    expect((await PDFDocument.load(enc, { ignoreEncryption: true })).isEncrypted).toBe(true);
    await expect(openNode(enc)).rejects.toThrow();
    expect((await openNode(enc, 'Contraseña 1')).numPages).toBe(3);
    const dec = await decryptPdf(factory, enc, 'Contraseña 1');
    expect((await PDFDocument.load(dec)).isEncrypted).toBe(false);
  });

  it('distingue contraseña incorrecta y quita restricciones de propietario', async () => {
    await expectCode(decryptPdf(factory, fixture('protected.pdf'), 'mal'), 'wrong-password');
    const ok = await decryptPdf(factory, fixture('protected.pdf'), '1234');
    expect((await PDFDocument.load(ok)).getPageCount()).toBe(3);
    const owner = await decryptPdf(factory, fixture('owner-only.pdf'), '');
    expect((await PDFDocument.load(owner)).isEncrypted).toBe(false);
  });
});

describe('Extracción de texto', () => {
  it('reconstruye líneas en orden y detecta PDF escaneados', async () => {
    const doc = await openNode(fixture('sample-5.pdf'));
    const pages = await extractDocument(doc as never, { styles: true });
    expect(pages[0].lines[0].text).toBe('Página 1 de 5');
    expect(pages[0].lines[0].bold).toBe(true);
    expect(pages[0].lines[1].text).toContain('añadir, acción, corazón');
    expect(pagesToPlainText(pages)).toContain('Página 5 de 5');
    expect(looksScanned(pages)).toBe(false);
    const paras = toParagraphs(pages[0], bodyFontSize(pages));
    expect(paras[0].heading).toBeGreaterThan(0);
    const scanned = await extractDocument((await openNode(fixture('scanned.pdf'))) as never);
    expect(looksScanned(scanned)).toBe(true);
  });
});

describe('Patrones de búsqueda para ocultar datos', async () => {
  const { PRESETS, fold, textQuery } = await import('../../src/tools/redact/search');
  const find = (re: RegExp, s: string) => [...fold(s).matchAll(new RegExp(re.source, re.flags))].map((m) => m[0]);
  it('teléfonos sin confundir códigos', () => {
    expect(find(PRESETS.phone, 'Tel: +52 55 1234 5678.')).toEqual(['+52 55 1234 5678']);
    expect(find(PRESETS.phone, 'CURP NUPJ800101HDFXXX09')).toEqual([]);
    expect(find(PRESETS.phone, '(55) 1234-5678')).toEqual(['(55) 1234-5678']);
  });
  it('correos e identificaciones', () => {
    expect(find(PRESETS.email, 'escribe a josé.núñez@ejemplo.com.mx hoy')).toEqual(['jose.nunez@ejemplo.com.mx']);
    expect(find(PRESETS.id, 'CURP: NUPJ800101HDFXXX09 y DNI 12345678Z')).toEqual(['nupj800101hdfxxx09', '12345678z']);
  });
  it('búsqueda sin acentos ni mayúsculas', () => {
    expect(find(textQuery('jose nunez')!, 'Nombre: José  Núñez Peña')).toEqual(['jose  nunez']);
  });
});
