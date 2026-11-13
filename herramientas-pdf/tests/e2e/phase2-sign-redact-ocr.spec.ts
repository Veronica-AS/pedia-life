import { expect, test } from '@playwright/test';
import { PDFName } from 'pdf-lib';
import { download, expectNoUploads, loadPdf, upload } from './helpers';
import { pageTexts } from '../unit/pdfjsNode';

const imagesOnPage = async (bytes: Uint8Array, i: number) => {
  const doc = await loadPdf(bytes);
  const x = doc.getPage(i).node.Resources()?.lookup(PDFName.of('XObject')) as { keys(): unknown[] } | undefined;
  return x ? x.keys().length : 0;
};

test('firmar: dibujar la firma, colocarla y descargar', async ({ page }) => {
  await page.goto('/firmar-pdf');
  await upload(page, 'sample-5.pdf');
  const pad = page.getByRole('img', { name: 'Área para dibujar la firma' });
  const b = (await pad.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(b.x + b.width * (0.2 + i * 0.03), b.y + b.height * (0.6 + Math.sin(i / 2) * 0.15));
  await page.mouse.up();
  await page.getByRole('button', { name: 'Usar esta firma' }).click();
  await page.getByTestId('place-here').click();
  await expect(page.getByRole('group', { name: /Firma 1 de la página/ })).toBeVisible();
  // Mover con el teclado (accesible)
  await page.getByRole('group', { name: /Firma 1 de la página/ }).press('ArrowLeft');
  await page.getByRole('button', { name: 'Firmar documento' }).click();
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5-firmado.pdf');
  expect(await imagesOnPage(bytes, 0)).toBe(1);
  expect(await imagesOnPage(bytes, 1)).toBe(0);
});

test('firmar: escribir el nombre y poner rúbrica en todas las páginas', async ({ page }) => {
  await page.goto('/firmar-pdf');
  await upload(page, 'sample-3.pdf');
  await page.getByRole('tab', { name: 'Escribir' }).click();
  await page.getByLabel('Tu nombre').fill('María Núñez');
  await page.getByRole('button', { name: 'Usar esta firma' }).click();
  await page.getByRole('button', { name: 'Añadir en todas las páginas (rúbrica)' }).click();
  await expect(page.getByText('3 firma(s) colocada(s) en total')).toBeVisible();
  await page.getByRole('button', { name: 'Firmar documento' }).click();
  const { bytes } = await download(page);
  for (const i of [0, 1, 2]) expect(await imagesOnPage(bytes, i)).toBe(1);
});

test('ocultar datos: buscar correos y teléfonos, y verificar que desaparecen del archivo', async ({ page }) => {
  const check = await expectNoUploads(page);
  await page.goto('/ocultar-datos-pdf');
  await upload(page, 'datos.pdf');
  await page.getByRole('button', { name: '+ Correos' }).click();
  await expect(page.getByText('"Correos": 2 coincidencia(s)')).toBeVisible();
  await page.getByRole('button', { name: '+ Teléfonos' }).click();
  await expect(page.getByText('"Teléfonos": 1 coincidencia(s)')).toBeVisible(); // no confunde los dígitos de la CURP
  await page.getByLabel('Texto a ocultar').fill('jose nunez');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('"jose nunez": 1 coincidencia(s)')).toBeVisible(); // sin acentos encuentra "José Núñez"
  await page.getByRole('button', { name: /Ocultar 4 zona\(s\) definitivamente/ }).click();
  await expect(page.getByTestId('verification')).toContainText('Verificado');
  const { name, bytes } = await download(page);
  expect(name).toBe('datos-redactado.pdf');
  const all = (await pageTexts(bytes)).map((p) => p.text).join(' ');
  for (const secret of ['jose.nunez@example.com', 'ana.perez@example.org', '1234 5678', 'José Núñez']) expect(all).not.toContain(secret);
  const meta = await loadPdf(bytes);
  expect(meta.getAuthor()).toBeUndefined();
  check();
});

test('ocultar datos: dibujar una zona a mano', async ({ page }) => {
  await page.goto('/ocultar-datos-pdf');
  await upload(page, 'sample-3.pdf');
  const stage = page.getByTestId('page-stage');
  await expect(stage.locator('img')).toBeVisible();
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.08, b.y + b.height * 0.05);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.12, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('redact-count')).toHaveText('1 zona(s) en 1 página(s)');
  await page.getByRole('button', { name: /Ocultar 1 zona/ }).click();
  const { bytes } = await download(page);
  const texts = await pageTexts(bytes);
  expect(texts[0].text.trim()).toBe(''); // página rehecha como imagen
  expect(texts[1].text).toContain('Página 2 de 3'); // las demás no cambian
});

test('OCR: reconoce un escaneo en español, se corrige y queda buscable', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/ocr-pdf');
  await upload(page, 'scanned.pdf');
  await expect(page.getByLabel('Español', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Reconocer texto' }).click();
  const lines = page.getByTestId('ocr-lines').locator('input');
  await expect(lines.first()).toBeVisible({ timeout: 200_000 });
  const all = (await lines.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).join('\n');
  expect(all).toMatch(/CONTRATO DE ARRENDAMIENTO/);
  expect(all).toMatch(/Cláusula/); // acentos reconocidos
  expect(all).toMatch(/Muñoz/);
  await lines.first().fill('CONTRATO DE ARRENDAMIENTO REVISADO');
  await page.getByRole('button', { name: 'Crear PDF buscable' }).click();
  const { bytes } = await download(page);
  const texts = await pageTexts(bytes);
  expect(texts[0].text).toContain('CONTRATO DE ARRENDAMIENTO REVISADO');
  expect(texts[1].text).toContain('Benito Juárez');
});
