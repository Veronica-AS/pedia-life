/// <reference lib="webworker" />
/**
 * Worker que hace el trabajo pesado con pdf-lib fuera del hilo principal,
 * para que la interfaz no se congele con archivos grandes.
 */
import * as Comlink from 'comlink';
import { mergePdfs, type NamedBytes } from '../tools/merge/merge';
import { splitPdf } from '../tools/split/split';
import { organizePdf, type PagePlan } from '../tools/organize/organize';
import { imagesToPdf, type PreparedImage } from '../tools/images-to-pdf/imagesToPdf';
import type { LayoutOptions } from '../tools/images-to-pdf/layout';
import { compressPdf, createCanvasCodec, type CompressLevel } from '../tools/compress/compress';
import { loadPdf, type ProgressFn } from '../lib/pdf';

const transfer = (b: Uint8Array) => Comlink.transfer(b, [b.buffer as ArrayBuffer]);

const api = {
  ping: () => 'pong',
  async validate(bytes: Uint8Array, fileName?: string) {
    return (await loadPdf(bytes, fileName)).getPageCount();
  },
  canCompress: () => typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined',
  async merge(files: NamedBytes[], onProgress?: ProgressFn) {
    return transfer(await mergePdfs(files, onProgress));
  },
  async split(bytes: Uint8Array, groups: number[][], onProgress?: ProgressFn) {
    const out = await splitPdf(bytes, groups, onProgress);
    return Comlink.transfer(out, out.map((b) => b.buffer as ArrayBuffer));
  },
  async organize(bytes: Uint8Array, plan: PagePlan[], onProgress?: ProgressFn) {
    return transfer(await organizePdf(bytes, plan, onProgress));
  },
  async imagesToPdf(images: PreparedImage[], opts: LayoutOptions, onProgress?: ProgressFn) {
    return transfer(await imagesToPdf(images, opts, onProgress));
  },
  async compress(bytes: Uint8Array, level: CompressLevel, onProgress?: ProgressFn) {
    const res = await compressPdf(bytes, level, createCanvasCodec(), onProgress);
    // Si no hubo reducción, compressPdf devuelve el mismo arreglo: se copia para poder transferirlo
    const out = res.bytes === bytes ? res.bytes.slice() : res.bytes;
    return Comlink.transfer({ bytes: out, stats: res.stats }, [out.buffer as ArrayBuffer]);
  },
};

export type PdfWorkerApi = typeof api;

Comlink.expose(api);
