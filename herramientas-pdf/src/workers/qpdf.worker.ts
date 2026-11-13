/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import createModule from '@neslinesli93/qpdf-wasm';
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { decryptPdf, encryptPdf, type ProtectOptions, type QpdfFactory } from '../tools/protect/qpdf';

const factory: QpdfFactory = () =>
  createModule({ locateFile: () => wasmUrl, print: () => {}, printErr: () => {} } as unknown as { locateFile: () => string }) as unknown as ReturnType<QpdfFactory>;

const transfer = (b: Uint8Array) => Comlink.transfer(b, [b.buffer as ArrayBuffer]);

const api = {
  async encrypt(bytes: Uint8Array, o: ProtectOptions) {
    return transfer(await encryptPdf(factory, bytes, o));
  },
  async decrypt(bytes: Uint8Array, password: string) {
    return transfer(await decryptPdf(factory, bytes, password));
  },
};

export type QpdfWorkerApi = typeof api;
Comlink.expose(api);
