import { expect, test } from '@playwright/test';
import { download, expectNoUploads, loadPdf, unzip, upload } from './helpers';

test('unir: reordenar, vista previa y descarga', async ({ page }) => {
  const check = await expectNoUploads(page);
  await page.goto('/unir-pdf');
  await upload(page, 'sample-3.pdf', 'sample-5.pdf');
  await expect(page.getByTestId('merge-total')).toContainText('8 páginas');
  await page.getByRole('button', { name: 'Mover abajo: sample-3.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Unir 2 PDF' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(8);
  const { name, bytes } = await download(page);
  expect(name).toBe('documento-unido.pdf');
  const doc = await loadPdf(bytes);
  expect(doc.getPageCount()).toBe(8);
  expect(doc.getTitle()).toBe('Documento de ejemplo'); // sample-5 quedó primero
  check();
});

test('unir: archivos protegidos o dañados muestran un error claro y la app sigue funcionando', async ({ page }) => {
  await page.goto('/unir-pdf');
  await upload(page, 'protected.pdf');
  await expect(page.getByRole('alert')).toContainText('protegido con contraseña');
  await expect(page.getByRole('alert')).toContainText('protected.pdf');
  await upload(page, 'corrupt.pdf');
  await expect(page.getByRole('alert')).toContainText('dañado');
  await upload(page, 'not-a-pdf.pdf');
  await expect(page.getByRole('alert')).toContainText('no es un PDF');
  await upload(page, 'owner-only.pdf');
  await expect(page.getByRole('alert')).toContainText('protegido');
  await upload(page, 'sample-3.pdf', 'large-150.pdf');
  await expect(page.getByTestId('merge-total')).toContainText('153 páginas');
});

test('dividir: 150 páginas cada 50 → ZIP con 3 PDF', async ({ page }) => {
  await page.goto('/dividir-pdf');
  await upload(page, 'large-150.pdf');
  await expect(page.getByTestId('file-info')).toContainText('150 páginas');
  await page.getByText('Cada N páginas').click();
  await page.getByLabel('Páginas por archivo').fill('50');
  await expect(page.getByText('Se crearán 3 archivo(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Dividir PDF' }).click();
  const { name, bytes } = await download(page);
  expect(name).toBe('large-150-dividido.zip');
  const files = unzip(bytes);
  expect(Object.keys(files).sort()).toEqual(['large-150-paginas-1-50.pdf', 'large-150-paginas-101-150.pdf', 'large-150-paginas-51-100.pdf']);
  for (const f of Object.values(files)) expect((await loadPdf(f)).getPageCount()).toBe(50);
});

test('dividir: rangos inválidos explican el problema; extraer páginas', async ({ page }) => {
  await page.goto('/dividir-pdf');
  await upload(page, 'sample-5.pdf');
  const input = page.getByLabel('Rangos de páginas');
  await input.fill('1-3, 9');
  await expect(page.getByText(/se sale del documento, que tiene 5 páginas/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dividir PDF' })).toBeDisabled();
  await input.fill('2-3');
  await page.getByRole('button', { name: 'Dividir PDF' }).click();
  let out = await download(page);
  expect(out.name).toBe('sample-5-paginas-2-3.pdf');
  expect((await loadPdf(out.bytes)).getPageCount()).toBe(2);

  await page.getByRole('button', { name: 'Volver a editar' }).click();
  await page.getByText('Extraer páginas').click();
  await page.getByLabel('Página 1', { exact: true }).check({ force: true });
  await page.getByLabel('Página 5', { exact: true }).check({ force: true });
  await expect(page.getByText('2 seleccionada(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Dividir PDF' }).click();
  out = await download(page);
  expect((await loadPdf(out.bytes)).getPageCount()).toBe(2);
});
