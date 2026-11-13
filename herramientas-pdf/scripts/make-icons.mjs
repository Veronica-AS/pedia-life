// Genera los íconos PNG de la PWA a partir de los SVG (usa el Chromium de Playwright)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  ['icon.svg', 192, 'icon-192.png', 'transparent'],
  ['icon.svg', 512, 'icon-512.png', 'transparent'],
  ['maskable.svg', 192, 'maskable-192.png', '#1d5cf1'],
  ['maskable.svg', 512, 'maskable-512.png', '#1d5cf1'],
  ['maskable.svg', 180, 'apple-touch-icon.png', '#1d5cf1'],
];
for (const [src, size, out, bg] of jobs) {
  const svg = readFileSync(join(dir, src), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`);
  await page.screenshot({ path: join(dir, out), omitBackground: bg === 'transparent' });
}
await browser.close();
console.log('Íconos generados');
