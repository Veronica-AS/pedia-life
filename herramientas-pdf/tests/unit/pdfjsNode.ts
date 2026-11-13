/** pdf.js en Node para comprobar el texto de los PDF generados */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

export async function openNode(bytes: Uint8Array, password?: string) {
  return pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false, verbosity: 0 }).promise;
}

/** Texto de cada página y la orientación de cada fragmento tal como se ve */
export async function pageTexts(bytes: Uint8Array) {
  const doc = await openNode(bytes);
  const out: { text: string; items: { str: string; x: number; y: number; upright: boolean }[]; width: number; height: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as { str: string; transform: number[] }[]).map((it) => {
      const m = pdfjs.Util.transform(vp.transform, it.transform);
      return { str: it.str, x: m[4], y: m[5], upright: m[0] > 0 && Math.abs(m[1]) < 1e-6 };
    });
    out.push({ text: items.map((i) => i.str).join(' '), items, width: vp.width, height: vp.height });
  }
  await doc.destroy();
  return out;
}
