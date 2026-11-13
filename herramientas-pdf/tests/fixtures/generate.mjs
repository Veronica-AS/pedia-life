// Genera los archivos de prueba en tests/fixtures/files. Requiere python3 con Pillow, pypdf y pillow-heif.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'files');
mkdirSync(out, { recursive: true });
execFileSync('python3', [join(here, 'make_images.py'), out], { stdio: 'inherit' });

const save = async (name, doc) => writeFileSync(join(out, name), await doc.save());

async function textPdf(pages, title) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor('Pruebas PDF Libre');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Página ${i} de ${pages}`, { x: 60, y: 760, size: 28, font: bold, color: rgb(0.1, 0.2, 0.5) });
    page.drawText('Información de prueba: añadir, acción, corazón, pingüino.', { x: 60, y: 720, size: 14, font });
    page.drawRectangle({ x: 60, y: 300, width: 475, height: 380, borderColor: rgb(0.2, 0.4, 0.8), borderWidth: 2 });
    page.drawText(String(i), { x: 260, y: 440, size: 120, font: bold, color: rgb(0.85, 0.3, 0.2) });
  }
  return doc;
}

// 1) Documento normal de 5 páginas (una girada 90°)
const sample = await textPdf(5, 'Documento de ejemplo');
sample.getPage(3).setRotation(degrees(90));
await save('sample-5.pdf', sample);

// 2) Segundo documento para unir
await save('sample-3.pdf', await textPdf(3, 'Otro documento'));

// 3) Documento grande: 150 páginas
await save('large-150.pdf', await textPdf(150, 'Documento grande'));

// 4) Formulario rellenable
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Formulario de inscripción', { x: 60, y: 770, size: 22, font });
  const form = doc.getForm();
  page.drawText('Nombre:', { x: 60, y: 700, size: 12, font });
  form.createTextField('nombre').addToPage(page, { x: 140, y: 690, width: 300, height: 24 });
  page.drawText('Correo:', { x: 60, y: 650, size: 12, font });
  form.createTextField('correo').addToPage(page, { x: 140, y: 640, width: 300, height: 24 });
  page.drawText('Acepto los términos', { x: 90, y: 600, size: 12, font });
  form.createCheckBox('acepto').addToPage(page, { x: 60, y: 596, width: 18, height: 18 });
  const dd = form.createDropdown('pais');
  dd.addOptions(['México', 'España', 'Argentina', 'Colombia']);
  dd.addToPage(page, { x: 140, y: 550, width: 200, height: 24 });
  await save('form.pdf', doc);
}

// 5) PDF escaneado (página = imagen JPEG grande) — 2 páginas, útil también para comprimir
{
  const doc = await PDFDocument.create();
  const jpg = await doc.embedJpg(readFileSync(join(out, 'scan.jpg')));
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  await save('scanned.pdf', doc);
}

// 6) PDF con imagen PNG (FlateDecode) + texto, para la ruta de compresión de imágenes sin pérdida
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const scanPng = readFileSync(join(out, 'scan-small.png'));
  const png = await doc.embedPng(scanPng);
  const page = doc.addPage([595.28, 841.89]);
  page.drawText('Texto seleccionable sobre una imagen PNG', { x: 40, y: 810, size: 14, font });
  page.drawImage(png, { x: 40, y: 40, width: 515, height: 750 });
  await save('png-image.pdf', doc);
}

// 6b) Datos personales ficticios (para ocultar/redactar)
{
  const doc = await PDFDocument.create();
  doc.setTitle('Expediente confidencial');
  doc.setAuthor('Recursos Humanos');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595.28, 841.89]);
  const lines = [
    'Expediente del empleado',
    'Nombre: José Núñez Peña',
    'Correo: jose.nunez@example.com',
    'Teléfono: +52 55 1234 5678',
    'CURP: NUPJ800101HDFXXX09',
    'Puesto: Analista de datos',
  ];
  lines.forEach((t, i) => page.drawText(t, { x: 60, y: 760 - i * 30, size: 14, font }));
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('Contacto de emergencia: ana.perez@example.org', { x: 60, y: 760, size: 14, font });
  p2.drawText('Esta página no se modifica si no tiene datos.', { x: 60, y: 730, size: 14, font });
  await save('datos.pdf', doc);
}

// 6c) Dos versiones de un contrato (para comparar)
for (const [name, lines] of [
  ['contrato-v1.pdf', ['CONTRATO DE ARRENDAMIENTO', 'La renta mensual será de $8,500 pagaderos el día uno de cada mes.', 'El plazo del contrato es de doce meses.', 'El inquilino no podrá tener mascotas.']],
  ['contrato-v2.pdf', ['CONTRATO DE ARRENDAMIENTO', 'La renta mensual será de $9,000 pagaderos el día cinco de cada mes.', 'El plazo del contrato es de doce meses.', 'El inquilino podrá tener una mascota pequeña.', 'Se agrega un depósito de garantía.']],
]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595.28, 841.89]);
  lines.forEach((t, i) => page.drawText(t, { x: 50, y: 770 - i * 28, size: 13, font }));
  await save(name, doc);
}

// 7) Protegido con contraseña de apertura y 8) solo con contraseña de propietario
execFileSync('python3', [join(here, 'encrypt.py'), join(out, 'sample-3.pdf'), join(out, 'protected.pdf'), '1234', 'propietario']);
execFileSync('python3', [join(here, 'encrypt.py'), join(out, 'sample-3.pdf'), join(out, 'owner-only.pdf'), '', 'propietario']);

// 9) PDF dañado (cabecera válida pero cortado a la mitad) y 10) archivo que no es PDF
const good = readFileSync(join(out, 'sample-5.pdf'));
writeFileSync(join(out, 'corrupt.pdf'), Buffer.concat([Buffer.from('%PDF-1.7\n'), good.subarray(200, Math.floor(good.length / 3))]));
writeFileSync(join(out, 'not-a-pdf.pdf'), 'Esto es un archivo de texto con extensión .pdf\n');
writeFileSync(join(out, 'empty.pdf'), '');

console.log('Archivos de prueba generados en', out);
