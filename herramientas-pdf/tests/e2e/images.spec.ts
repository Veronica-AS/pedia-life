import { expect, test } from '@playwright/test';
import { download, loadPdf, unzip, upload } from './helpers';

test('imágenes a PDF: JPG con EXIF, PNG, WEBP y HEIC', async ({ page }) => {
  await page.goto('/imagenes-a-pdf');
  await upload(page, 'photo-exif6.jpg', 'logo.png', 'photo.webp', 'photo.heic');
  await expect(page.getByRole('button', { name: 'Crear PDF con 4 imagen(es)' })).toBeEnabled({ timeout: 60_000 });
  // es-MX → tamaño Carta por defecto
  await expect(page.getByLabel('Carta')).toBeChecked();
  await page.getByRole('button', { name: 'Crear PDF con 4 imagen(es)' }).click();
  const { bytes } = await download(page);
  const doc = await loadPdf(bytes);
  expect(doc.getPageCount()).toBe(4);
  // La foto con EXIF 6 se tomó en vertical: la página debe quedar vertical
  const first = doc.getPage(0).getSize();
  expect(first).toEqual({ width: 612, height: 792 });
  // La WEBP es horizontal: orientación automática → página horizontal
  expect(doc.getPage(2).getSize()).toEqual({ width: 792, height: 612 });
});

test('imágenes a PDF: ajustar al tamaño de la imagen y archivos no admitidos', async ({ page }) => {
  await page.goto('/jpg-a-pdf');
  await upload(page, 'sample-3.pdf');
  await expect(page.getByRole('alert')).toContainText('no es compatible');
  await upload(page, 'logo.png');
  await page.getByText('Ajustar a la imagen').click();
  await page.getByText('Sin margen').click();
  await page.getByRole('button', { name: 'Crear PDF con 1 imagen(es)' }).click();
  const { name, bytes } = await download(page);
  expect(name).toBe('logo.pdf');
  expect((await loadPdf(bytes)).getPage(0).getSize()).toEqual({ width: 450, height: 300 });
});

test('PDF a imágenes: PNG a 72 ppp → ZIP con todas las páginas', async ({ page }) => {
  await page.goto('/pdf-a-png');
  await upload(page, 'sample-5.pdf');
  await expect(page.getByLabel('PNG')).toBeChecked();
  await page.getByText('72 ppp · pantalla').click();
  await page.getByRole('button', { name: 'Convertir a PNG' }).click();
  await expect(page.getByTestId('result-preview').locator('li')).toHaveCount(5);
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5-imagenes.zip');
  const files = unzip(bytes);
  expect(Object.keys(files)).toHaveLength(5);
  const png = files['sample-5-pagina-1.png'];
  expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  const view = new DataView(png.buffer, png.byteOffset);
  expect(view.getUint32(16)).toBe(595);
});

test('PDF a imágenes: JPG solo de algunas páginas', async ({ page }) => {
  await page.goto('/pdf-a-imagenes');
  await upload(page, 'sample-5.pdf');
  await page.getByText('Elegir', { exact: true }).click();
  await page.getByLabel('Páginas a convertir').fill('4');
  await page.getByRole('button', { name: 'Convertir a JPG' }).click();
  const { name, bytes } = await download(page);
  expect(name).toBe('sample-5-pagina-4.jpg');
  expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
});
