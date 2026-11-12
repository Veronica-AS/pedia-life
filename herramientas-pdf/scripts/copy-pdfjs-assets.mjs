// Copia a public/ los recursos que la app sirve ella misma (sin CDN), para que funcionen offline:
// fuentes y cMaps de pdf.js, y el motor y los idiomas del OCR (tesseract).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist');
const dest = join(root, 'public', 'pdfjs');
if (!existsSync(src)) process.exit(0);
mkdirSync(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('pdf.js: cmaps y fuentes copiados a public/pdfjs');

const nm = join(root, 'node_modules');
const tess = join(root, 'public', 'tesseract');
mkdirSync(join(tess, 'lang'), { recursive: true });
cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(tess, 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
  cpSync(join(nm, 'tesseract.js-core', f), join(tess, f));
}
for (const lang of ['spa', 'eng']) {
  cpSync(join(nm, '@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`), join(tess, 'lang', `${lang}.traineddata.gz`));
}
console.log('OCR: motor e idiomas (español, inglés) copiados a public/tesseract');
