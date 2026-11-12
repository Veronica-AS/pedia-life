import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';

export const F = (name: string) => join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'files', name);

export async function upload(page: Page, ...files: string[]) {
  await page.getByTestId('file-input').first().setInputFiles(files.map(F));
}

/** Pulsa el botón de descarga y devuelve los bytes descargados */
export async function download(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(path!)) };
}

export const loadPdf = (bytes: Uint8Array) => PDFDocument.load(bytes);
export const unzip = (bytes: Uint8Array) => unzipSync(bytes);

export async function expectNoUploads(page: Page) {
  // Ninguna petición POST/PUT debe salir del navegador: los archivos no se suben
  const sent: string[] = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH'].includes(r.method())) sent.push(r.url());
  });
  return () => expect(sent, 'no debe enviarse ningún archivo a un servidor').toEqual([]);
}
