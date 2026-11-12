// Copia las fuentes estándar y los cMaps de pdf.js a public/ para que funcionen offline.
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
