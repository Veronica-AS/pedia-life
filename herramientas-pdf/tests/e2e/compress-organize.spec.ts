import { expect, test } from '@playwright/test';
import { download, loadPdf, upload } from './helpers';

test('comprimir: tamaño real antes/después, comparación y descarga', async ({ page }) => {
  await page.goto('/comprimir-pdf');
  await upload(page, 'scanned.pdf');
  await expect(page.getByTestId('size-after')).toContainText('%');
  // Se calculan los demás niveles en segundo plano
  await expect(page.getByTestId('size-light')).toContainText('KB');
  await expect(page.getByTestId('size-strong')).toContainText('KB');
  const compare = page.getByRole('region', { name: 'Compara la calidad' });
  await compare.scrollIntoViewIfNeeded(); // las miniaturas se dibujan al hacerse visibles
  await expect(compare.locator('img')).toHaveCount(2);
  const { name, bytes } = await download(page);
  expect(name).toBe('scanned-comprimido.pdf');
  expect(bytes.length).toBeLessThan(726_582 * 0.5);
  expect((await loadPdf(bytes)).getPageCount()).toBe(2);
});

test('comprimir: nivel máximo avisa que el texto deja de ser seleccionable', async ({ page }) => {
  await page.goto('/comprimir-pdf');
  await upload(page, 'png-image.pdf');
  await page.getByText('Máxima (páginas como imagen)').click();
  await expect(page.getByRole('note').filter({ hasText: 'no podrás copiarlo' })).toBeVisible();
  await expect(page.getByTestId('size-max')).toContainText('KB');
  const { bytes } = await download(page);
  expect((await loadPdf(bytes)).getPageCount()).toBe(1);
});

test('comprimir: un PDF solo con texto explica que ya está optimizado', async ({ page }) => {
  await page.goto('/comprimir-pdf');
  await upload(page, 'sample-5.pdf');
  await expect(page.getByText('Este PDF ya está optimizado')).toBeVisible();
});

test('organizar: rotar, eliminar y reordenar', async ({ page }) => {
  await page.goto('/organizar-pdf');
  await upload(page, 'sample-5.pdf');
  await expect(page.getByTestId('page-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Girar a la derecha: Página 1' }).click();
  await page.getByRole('button', { name: 'Eliminar página: Página 2' }).click();
  await page.getByRole('button', { name: 'Mover después: Página 5' }).isDisabled();
  await page.getByRole('button', { name: 'Mover antes: Página 5' }).click();
  await expect(page.getByText('4 de 5 páginas')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar cambios' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(4);
  const { bytes } = await download(page);
  const doc = await loadPdf(bytes);
  expect(doc.getPageCount()).toBe(4);
  expect(doc.getPage(0).getRotation().angle).toBe(90);
  expect(doc.getPage(2).getRotation().angle).toBe(0); // la 5 pasó antes que la 4
  expect(doc.getPage(3).getRotation().angle).toBe(90); // la 4 venía girada
});

test('organizar: documento de 150 páginas sin bloquearse', async ({ page }) => {
  await page.goto('/rotar-pdf');
  await upload(page, 'large-150.pdf');
  await expect(page.getByTestId('page-card')).toHaveCount(150);
  await page.getByRole('button', { name: 'Girar todas →' }).first().click();
  await page.getByRole('button', { name: 'Aplicar cambios' }).click();
  const { bytes } = await download(page);
  const doc = await loadPdf(bytes);
  expect(doc.getPageCount()).toBe(150);
  expect(doc.getPage(149).getRotation().angle).toBe(90);
});
