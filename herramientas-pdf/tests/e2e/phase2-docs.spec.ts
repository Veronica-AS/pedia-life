import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { download, expectNoUploads, loadPdf, unzip, upload } from './helpers';
import { openNode, pageTexts } from '../unit/pdfjsNode';
import { readMetadata } from '../../src/tools/metadata/metadata';

test('numerar páginas: formato, desde la página 2 y encabezado', async ({ page }) => {
  await page.goto('/numerar-paginas');
  await upload(page, 'sample-5.pdf');
  await page.getByText('Página 1 de 10').click();
  await page.getByLabel('Empezar en la página').fill('2');
  await page.getByLabel('Encabezado (opcional)').fill('Confidencial');
  await page.getByRole('button', { name: 'Aplicar a 4 páginas' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(5);
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5-numerado.pdf');
  const texts = await pageTexts(bytes);
  expect(texts[0].text).not.toContain('Confidencial');
  expect(texts[1].text).toContain('Página 1 de 4');
  expect(texts[4].text).toContain('Página 4 de 4');
});

test('metadatos: muestra lo que hay y lo elimina', async ({ page }) => {
  await page.goto('/eliminar-metadatos-pdf');
  await upload(page, 'datos.pdf');
  await expect(page.getByTestId('metadata-table').first()).toContainText('Recursos Humanos');
  await page.getByRole('button', { name: 'Eliminar metadatos' }).click();
  await expect(page.getByTestId('metadata-table')).not.toContainText('Recursos Humanos');
  const { bytes } = await download(page);
  const m = await readMetadata(bytes);
  expect(m.author).toBeUndefined();
  expect(m.title).toBeUndefined();
});

test('proteger con contraseña y quitarla después', async ({ page }) => {
  const check = await expectNoUploads(page);
  await page.goto('/proteger-pdf');
  await upload(page, 'sample-3.pdf');
  await page.getByLabel('Contraseña', { exact: true }).fill('Secreta-2026');
  await page.getByLabel('Repite la contraseña').fill('Otra');
  await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proteger PDF' })).toBeDisabled();
  await page.getByLabel('Repite la contraseña').fill('Secreta-2026');
  await page.getByLabel('Permitir copiar texto e imágenes').uncheck();
  await page.getByRole('button', { name: 'Proteger PDF' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(3); // se abre con la contraseña
  const enc = await download(page);
  expect(enc.name).toBe('sample-3-protegido.pdf');
  await expect(openNode(enc.bytes)).rejects.toThrow();
  expect((await openNode(enc.bytes, 'Secreta-2026')).numPages).toBe(3);
  check();

  // Ahora se quita con la herramienta de desbloqueo
  await page.goto('/desbloquear-pdf');
  await page.getByTestId('file-input').setInputFiles({ name: 'protegido.pdf', mimeType: 'application/pdf', buffer: Buffer.from(enc.bytes) });
  await page.getByLabel('Contraseña del PDF').fill('incorrecta');
  await page.getByRole('button', { name: 'Quitar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('La contraseña no es correcta');
  await page.getByLabel('Contraseña del PDF').fill('Secreta-2026');
  await page.getByRole('button', { name: 'Quitar contraseña' }).click();
  const dec = await download(page);
  expect((await PDFDocument.load(dec.bytes)).isEncrypted).toBe(false);
});

test('quitar contraseña: restricciones de propietario y PDF sin contraseña', async ({ page }) => {
  await page.goto('/desbloquear-pdf');
  await upload(page, 'owner-only.pdf');
  await page.getByRole('button', { name: 'Quitar restricciones' }).click();
  const { bytes } = await download(page);
  expect((await PDFDocument.load(bytes)).isEncrypted).toBe(false);
  await page.getByRole('button', { name: 'Empezar de nuevo' }).first().click();
  await upload(page, 'sample-3.pdf');
  await expect(page.getByRole('alert')).toContainText('no tiene contraseña');
});

test('los PDF protegidos en otras herramientas remiten a "Quitar contraseña"', async ({ page }) => {
  await page.goto('/comprimir-pdf');
  await upload(page, 'protected.pdf');
  await expect(page.getByRole('alert')).toContainText('Quitar contraseña');
});

test('rellenar formulario con acentos y fijar respuestas', async ({ page }) => {
  await page.goto('/rellenar-formulario-pdf');
  await upload(page, 'form.pdf');
  await page.getByLabel('nombre').fill('José Núñez Peña');
  await page.getByLabel('correo').fill('jose@example.com');
  await page.getByLabel('acepto').check();
  await page.getByLabel('pais').selectOption('México');
  await page.getByRole('button', { name: 'Guardar formulario' }).click();
  const { bytes } = await download(page);
  const form = (await loadPdf(bytes)).getForm();
  expect(form.getTextField('nombre').getText()).toBe('José Núñez Peña');
  expect(form.getCheckBox('acepto').isChecked()).toBe(true);
  expect(form.getDropdown('pais').getSelected()).toEqual(['México']);
});

test('rellenar formulario: un PDF sin campos lo explica', async ({ page }) => {
  await page.goto('/rellenar-formulario-pdf');
  await upload(page, 'sample-3.pdf');
  await expect(page.getByRole('alert')).toContainText('no tiene campos rellenables');
});

test('PDF a texto: vista previa editable y descarga .txt', async ({ page }) => {
  await page.goto('/pdf-a-texto');
  await upload(page, 'sample-5.pdf');
  const box = page.getByTestId('text-preview');
  await expect(box).toHaveValue(/Página 3 de 5/);
  await box.fill('Texto corregido a mano: ñandú');
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5.txt');
  expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('﻿Texto corregido a mano: ñandú');
});

test('PDF a Word: aviso honesto, vista previa y .docx', async ({ page }) => {
  await page.goto('/pdf-a-word');
  await upload(page, 'sample-5.pdf');
  await expect(page.getByText('Aviso honesto')).toBeVisible();
  await expect(page.getByTestId('docx-preview')).toContainText('Página 2 de 5');
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5.docx');
  const xml = new TextDecoder().decode(unzip(bytes)['word/document.xml']);
  expect(xml).toContain('Página 1 de 5');
  expect(xml).toContain('corazón');
});

test('PDF a texto: un escaneo sugiere usar OCR', async ({ page }) => {
  await page.goto('/pdf-a-texto');
  await upload(page, 'scanned.pdf');
  await expect(page.getByRole('alert')).toContainText('parece escaneado');
  await expect(page.getByRole('link', { name: 'Ir a OCR' })).toBeVisible();
});
