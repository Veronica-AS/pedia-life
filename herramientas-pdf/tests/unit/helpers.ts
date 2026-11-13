import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', 'files', name)));

export async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    const e = err as { code?: string };
    if (e.code !== code) throw new Error(`Se esperaba el código "${code}" y llegó "${e.code}" (${String(err)})`);
    return;
  }
  throw new Error(`Se esperaba un error "${code}" pero no hubo error`);
}
