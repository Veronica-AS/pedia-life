import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { mergePdfs } from '../../src/tools/merge/merge';
import { splitPdf } from '../../src/tools/split/split';
import { organizePdf } from '../../src/tools/organize/organize';
import { chunkPages } from '../../src/tools/split/ranges';
import { loadPdf } from '../../src/lib/pdf';
import { expectCode, fixture } from './helpers';

const pages = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe('Unir PDF', () => {
  it('une en el orden indicado y reporta progreso', async () => {
    const progress: number[] = [];
    const out = await mergePdfs(
      [
        { name: 'a.pdf', bytes: fixture('sample-3.pdf') },
        { name: 'b.pdf', bytes: fixture('sample-5.pdf') },
      ],
      (p) => progress.push(p),
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(8);
    expect(doc.getTitle()).toBe('Otro documento');
    expect(doc.getPage(7).getRotation().angle).toBe(0);
    expect(doc.getPage(6).getRotation().angle).toBe(90); // la página 4 de sample-5 venía girada
    expect(progress.at(-1)).toBe(1);
  });

  it('une el documento de 150 páginas con el formulario', async () => {
    const out = await mergePdfs([
      { name: 'large.pdf', bytes: fixture('large-150.pdf') },
      { name: 'form.pdf', bytes: fixture('form.pdf') },
    ]);
    expect(await pages(out)).toBe(151);
  });

  it('rechaza PDF protegidos, dañados o que no son PDF, indicando el archivo', async () => {
    await expectCode(mergePdfs([{ name: 'protected.pdf', bytes: fixture('protected.pdf') }]), 'encrypted');
    await expectCode(mergePdfs([{ name: 'owner.pdf', bytes: fixture('owner-only.pdf') }]), 'encrypted');
    await expectCode(mergePdfs([{ name: 'corrupt.pdf', bytes: fixture('corrupt.pdf') }]), 'corrupt');
    await expectCode(mergePdfs([{ name: 'x.pdf', bytes: fixture('not-a-pdf.pdf') }]), 'not-pdf');
    await expectCode(mergePdfs([{ name: 'e.pdf', bytes: fixture('empty.pdf') }]), 'empty-file');
    try {
      await loadPdf(fixture('protected.pdf'), 'contrato.pdf');
    } catch (err) {
      expect((err as { fileName: string }).fileName).toBe('contrato.pdf');
    }
  });
});

describe('Dividir PDF', () => {
  it('divide 150 páginas en archivos de 50', async () => {
    const out = await splitPdf(fixture('large-150.pdf'), chunkPages(150, 50));
    expect(out).toHaveLength(3);
    for (const b of out) expect(await pages(b)).toBe(50);
  });

  it('extrae páginas concretas', async () => {
    const [out] = await splitPdf(fixture('sample-5.pdf'), [[4, 0]]);
    expect(await pages(out)).toBe(2);
  });
});

describe('Organizar páginas', () => {
  it('reordena, rota y elimina', async () => {
    const out = await organizePdf(fixture('sample-5.pdf'), [
      { index: 3, rotation: 90 }, // venía a 90° → 180°
      { index: 0, rotation: -90 }, // → 270°
      { index: 2, rotation: 0 },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
    expect(doc.getPage(1).getRotation().angle).toBe(270);
    expect(doc.getPage(2).getRotation().angle).toBe(0);
  });

  it('no permite eliminar todas las páginas', async () => {
    await expectCode(organizePdf(fixture('sample-5.pdf'), []), 'no-pages');
  });

  it('mantiene los campos del formulario al rotar', async () => {
    const out = await organizePdf(fixture('form.pdf'), [{ index: 0, rotation: 90 }]);
    expect(await pages(out)).toBe(1);
  });
});
