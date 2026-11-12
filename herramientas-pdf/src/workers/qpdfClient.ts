import * as Comlink from 'comlink';
import { toAppError } from '../lib/errors';
import type { ProtectOptions } from '../tools/protect/qpdf';
import type { QpdfWorkerApi } from './qpdf.worker';

/** Cada operación usa un Worker nuevo que se cierra al terminar (qpdf ocupa memoria) */
async function withWorker<T>(fn: (api: Comlink.Remote<QpdfWorkerApi>) => Promise<T>): Promise<T> {
  const w = new Worker(new URL('./qpdf.worker.ts', import.meta.url), { type: 'module', name: 'qpdf' });
  try {
    return await fn(Comlink.wrap<QpdfWorkerApi>(w));
  } catch (err) {
    throw toAppError(err);
  } finally {
    w.terminate();
  }
}

export const qpdfTasks = {
  encrypt: (bytes: Uint8Array, o: ProtectOptions) => withWorker((api) => api.encrypt(bytes, o)),
  decrypt: (bytes: Uint8Array, password: string) => withWorker((api) => api.decrypt(bytes, password)),
};
