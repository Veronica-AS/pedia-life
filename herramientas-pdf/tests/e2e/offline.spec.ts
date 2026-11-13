import { expect, test } from '@playwright/test';
import { download, loadPdf, upload } from './helpers';

test('funciona sin internet después de la primera visita (PWA)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'El service worker se prueba en Chromium');
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  // Espera a que termine de guardar todos los archivos en caché
  await expect(page.getByText('Lista para usarse sin conexión.')).toBeVisible({ timeout: 60_000 });
  await context.setOffline(true);
  await page.goto('/unir-pdf');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unir PDF');
  await upload(page, 'sample-3.pdf', 'sample-5.pdf');
  await page.getByRole('button', { name: 'Unir 2 PDF' }).click();
  const { bytes } = await download(page);
  expect((await loadPdf(bytes)).getPageCount()).toBe(8);
});
