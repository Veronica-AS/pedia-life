import { expect, test } from '@playwright/test';

test('portada: aviso de privacidad, buscador y categorías', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PDF Libre/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Herramientas PDF gratis y privadas');
  await expect(page.getByText('Tus archivos nunca salen de tu dispositivo').first()).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Buscar herramienta' });
  const grid = page.getByRole('region', { name: 'Todas las herramientas' });
  await search.fill('achicar');
  await expect(grid.getByRole('link', { name: /Comprimir PDF/ })).toBeVisible();
  await expect(grid.getByRole('link', { name: /Unir PDF/ })).toHaveCount(0);
  await search.fill('heic');
  await expect(grid.getByRole('link', { name: /Imágenes a PDF/ })).toBeVisible();
  await search.fill('xyzxyz');
  await expect(page.getByRole('status')).toContainText('No encontramos');
  await search.fill('');

  await page.getByRole('button', { name: 'Convertir', exact: true }).click();
  await expect(grid.getByRole('link', { name: /Dividir PDF/ })).toHaveCount(0);
  await expect(grid.getByRole('link', { name: /PDF a imágenes/ })).toBeVisible();
});

test('modo oscuro e idioma inglés', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Tema del sistema' }).click(); // → claro
  await page.getByRole('button', { name: 'Tema claro' }).click(); // → oscuro
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole('button', { name: /Idioma/ }).click();
  await expect(page.getByText('Your files never leave your device').first()).toBeVisible();
  await expect(html).toHaveAttribute('lang', 'en');
});

test('navegación con teclado hasta una herramienta', async ({ page }) => {
  await page.goto('/');
  await page.locator('body').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.getByRole('link', { name: /Unir PDF/ }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/unir-pdf$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unir PDF');
});

test('SEO: cada herramienta tiene HTML propio, schema.org y está en el sitemap', async ({ request }) => {
  for (const slug of ['unir-pdf', 'dividir-pdf', 'comprimir-pdf', 'organizar-pdf', 'imagenes-a-pdf', 'pdf-a-imagenes', 'pdf-a-jpg']) {
    const html = await (await request.get(`/${slug}/`)).text();
    expect(html).toMatch(/<title>[^<]+\| PDF Libre<\/title>/);
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toMatch(/<h1>[^<]+<\/h1>/);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/comprimir-pdf</loc>');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
});

test('ruta inexistente muestra un mensaje claro', async ({ page }) => {
  await page.goto('/no-existe');
  await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
});
