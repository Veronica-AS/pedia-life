/**
 * Genera un .docx básico: párrafos, títulos, negrita/cursiva y saltos de página.
 * No reproduce columnas, tablas, imágenes ni posiciones exactas (se avisa en la interfaz).
 */
import type { Paragraph as Para } from '../../lib/textExtract';

export async function paragraphsToDocx(pages: Para[][], title: string): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import('docx');
  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((paras, pi) => {
    paras.forEach((p, i) => {
      const runs = p.text.split('\t').flatMap((part, k) => {
        const r = new TextRun({ text: part, bold: p.bold || p.heading > 0, italics: p.italic, size: p.heading ? undefined : Math.round(Math.min(Math.max(p.fontSize, 8), 28) * 2) });
        return k === 0 ? [r] : [new TextRun({ text: '\t' }), r];
      });
      if (pi > 0 && i === 0) runs.unshift(new TextRun({ children: [new PageBreak()] }));
      children.push(
        new Paragraph({
          children: runs,
          heading: p.heading === 1 ? HeadingLevel.HEADING_1 : p.heading === 2 ? HeadingLevel.HEADING_2 : undefined,
          spacing: { after: 120 },
          indent: p.indent > 8 && !p.heading ? { left: Math.round(Math.min(p.indent, 144) * 20) } : undefined,
        }),
      );
    });
    if (!paras.length && pi > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
  });
  const doc = new Document({
    creator: 'PDF Libre',
    title,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
