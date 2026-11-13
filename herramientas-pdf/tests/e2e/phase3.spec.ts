import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { download, expectNoUploads, loadPdf, unzip, upload } from './helpers';
import { openNode, pageTexts } from '../unit/pdfjsNode';

test('lotes: comprimir varios PDF y descargar un ZIP; un archivo protegido no detiene al resto', async ({ page }) => {
  const check = await expectNoUploads(page);
  await page.goto('/procesar-por-lotes');
  await expect(page.getByLabel('Comprimir')).toBeChecked();
  await upload(page, 'scanned.pdf', 'png-image.pdf', 'protected.pdf');
  await page.getByTestId('run-flow').click();
  await expect(page.getByRole('alert')).toContainText('protegido con contraseña');
  await expect(page.getByTestId('flow-results').locator('li')).toHaveCount(2);
  const { name, bytes } = await download(page);
  expect(name).toBe('lote-pdf-libre.zip');
  const files = unzip(bytes);
  expect(Object.keys(files).sort()).toEqual(['png-image-comprimido.pdf', 'scanned-comprimido.pdf']);
  for (const f of Object.values(files)) expect((await loadPdf(f)).getPageCount()).toBeGreaterThan(0);
  check();
});

test('flujos: el ejemplo une, numera, comprime y limpia metadatos', async ({ page }) => {
  await page.goto('/flujos');
  await page.getByRole('button', { name: 'Usar: Preparar para enviar por correo' }).click();
  await upload(page, 'sample-3.pdf', 'sample-5.pdf');
  await page.getByTestId('run-flow').click();
  const { name, bytes } = await download(page);
  expect(name).toBe('documentos-unidos-procesado.pdf');
  const texts = await pageTexts(bytes);
  expect(texts).toHaveLength(8);
  expect(texts[7].text).toContain('Página 8 de 8');
  expect((await loadPdf(bytes)).getAuthor()).toBeUndefined();
});

test('flujos: crear uno con contraseña, se guarda en el dispositivo y no guarda la contraseña', async ({ page }) => {
  await page.goto('/flujos');
  await page.getByRole('button', { name: 'Crear flujo' }).click();
  await page.getByLabel('Nombre del flujo').fill('Rotar y proteger');
  await page.getByLabel('Añadir paso').selectOption('protect');
  await page.getByLabel('Añadir paso').selectOption('rotate'); // se inserta antes de "Proteger"
  await expect(page.getByRole('list', { name: 'Pasos' }).locator('> li').first()).toContainText('Rotar todas las páginas');
  await page.getByRole('button', { name: 'Guardar flujo' }).click();
  await page.reload();
  await expect(page.getByTestId('flow-list')).toContainText('Rotar y proteger');
  const stored = await page.evaluate(() => localStorage.getItem('pdflibre.flows') ?? '');
  expect(stored).not.toMatch(/password/i);

  await page.getByRole('button', { name: 'Usar: Rotar y proteger' }).click();
  await upload(page, 'sample-3.pdf');
  await expect(page.getByTestId('run-flow')).toBeDisabled(); // falta la contraseña
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('clave-123');
  await page.getByLabel('Repite la nueva contraseña').fill('clave-123');
  await page.getByTestId('run-flow').click();
  const { bytes } = await download(page);
  await expect(openNode(bytes)).rejects.toThrow();
  const doc = await openNode(bytes, 'clave-123');
  expect((await doc.getPage(1)).rotate).toBe(90);
  expect(await page.evaluate(() => localStorage.getItem('pdflibre.flows') ?? '')).not.toContain('clave-123');
});

test('convertir imágenes: HEIC y WEBP a JPG en lote', async ({ page }) => {
  await page.goto('/heic-a-jpg');
  await upload(page, 'photo.heic', 'photo.webp', 'logo.png');
  await expect(page.getByLabel('JPG')).toBeChecked();
  await page.getByText('1280 px').click();
  await page.getByRole('button', { name: 'Convertir 3 imagen(es) a JPG' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(3, { timeout: 60_000 });
  const { bytes } = await download(page);
  const files = unzip(bytes);
  expect(Object.keys(files).sort()).toEqual(['logo.jpg', 'photo (2).jpg', 'photo.jpg']);
  for (const f of Object.values(files)) expect([...f.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
});

test('convertir imágenes: a WEBP con tamaño reducido', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari no crea WEBP (se avisa en la interfaz)');
  await page.goto('/convertir-imagenes');
  await upload(page, 'scan.jpg');
  await page.getByText('WEBP', { exact: true }).click();
  await page.getByText('1280 px').click();
  await page.getByRole('button', { name: /a WEBP/ }).click();
  const { name, bytes } = await download(page);
  expect(name).toBe('scan.webp');
  expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WEBP');
});

test('comparar: muestra cambios palabra por palabra y descarga ambos PDF marcados', async ({ page }) => {
  await page.goto('/comparar-pdf');
  await page.getByTestId('slot-a').getByTestId('file-input').setInputFiles('tests/fixtures/files/contrato-v1.pdf');
  await page.getByTestId('slot-b').getByTestId('file-input').setInputFiles('tests/fixtures/files/contrato-v2.pdf');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await expect(page.getByTestId('compare-summary')).toContainText('cambio(s)');
  const list = page.getByTestId('change-list');
  await expect(list.locator('del').filter({ hasText: '$8,500' })).toBeVisible();
  await expect(list.locator('ins').filter({ hasText: '$9,000' })).toBeVisible();
  await expect(list).toContainText('depósito de garantía');
  await page.getByRole('button', { name: 'Ver en la página' }).first().click();
  await expect(page.getByTestId('page-stage').first().locator('span.absolute').first()).toBeAttached();
  const { name, bytes } = await download(page);
  expect(name).toBe('comparacion-pdf.zip');
  const files = unzip(bytes);
  expect(Object.keys(files).sort()).toEqual(['1-contrato-v1-marcado.pdf', '2-contrato-v2-marcado.pdf']);
  expect((await pageTexts(files['2-contrato-v2-marcado.pdf']))[0].text).toContain('$9,000');
});

test('comparar: documentos idénticos', async ({ page }) => {
  await page.goto('/comparar-pdf');
  await page.getByTestId('slot-a').getByTestId('file-input').setInputFiles('tests/fixtures/files/contrato-v1.pdf');
  await page.getByTestId('slot-b').getByTestId('file-input').setInputFiles('tests/fixtures/files/contrato-v1.pdf');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await expect(page.getByTestId('compare-summary')).toHaveText('Los textos son idénticos');
});

test('escáner: detecta el documento, lo endereza y crea un PDF buscable', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/escanear-documento');
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/files/doc-photo.jpg');
  const result = page.getByTestId('scan-result');
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('No encontramos los bordes')).toHaveCount(0); // detección automática
  // El editor de esquinas debe verse con un tamaño útil (también en celular)
  const editor = (await page.getByTestId('corner-editor').boundingBox())!;
  expect(editor.width).toBeGreaterThan(200);
  expect(editor.height).toBeGreaterThan(200);
  // La hoja original mide 850×1100: el resultado enderezado debe tener esa proporción
  const ratio = await result.evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  expect(ratio).toBeGreaterThan(0.72);
  expect(ratio).toBeLessThan(0.83);
  await page.getByText('Blanco y negro').click();
  await expect(page.getByTestId('scan-pages').locator('li')).toHaveCount(1);
  await page.getByText('Hacer el texto buscable (OCR en español)').click();
  await page.getByRole('button', { name: 'Crear PDF con 1 página(s)' }).click();
  const { bytes } = await download(page);
  const texts = await pageTexts(bytes);
  expect(texts[0].text).toMatch(/ARRENDAMIENTO/);
  expect(texts[0].text).toMatch(/Juárez/);
});

test('historial local: desactivado por defecto, guarda al activarlo y se borra todo', async ({ page }) => {
  await page.goto('/historial');
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('switch').check();
  await page.goto('/unir-pdf');
  await upload(page, 'sample-3.pdf', 'sample-5.pdf');
  await page.getByRole('button', { name: 'Unir 2 PDF' }).click();
  await download(page);
  await page.getByRole('link', { name: 'Historial local' }).click();
  await expect(page.getByTestId('history-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('history-list')).toContainText('documento-unido.pdf');
  const again = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar', exact: true }).click()]);
  expect((await PDFDocument.load(new Uint8Array(await (await again[0].createReadStream()).toArray().then((c) => Buffer.concat(c))))).getPageCount()).toBe(8);
  await page.getByRole('button', { name: 'Borrar todo' }).click();
  await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
  await expect(page.getByText('El historial está vacío.')).toBeVisible();
});
