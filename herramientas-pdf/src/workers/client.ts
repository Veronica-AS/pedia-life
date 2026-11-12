/**
 * Acceso al Worker de PDF. Si el navegador no puede crear el Worker
 * (p. ej. Firefox antiguo sin workers de módulo), todo se ejecuta en la página.
 */
import * as Comlink from 'comlink';
import type { PdfWorkerApi } from './pdf.worker';
import type { ProgressFn } from '../lib/pdf';
import type { NamedBytes } from '../tools/merge/merge';
import type { PagePlan } from '../tools/organize/organize';
import type { PreparedImage } from '../tools/images-to-pdf/imagesToPdf';
import type { LayoutOptions } from '../tools/images-to-pdf/layout';
import type { CompressLevel, CompressStats } from '../tools/compress/compress';
import { toAppError } from '../lib/errors';
import type { PageNumberOptions } from '../tools/page-numbers/pageNumbers';
import type { MetadataEdits, MetadataInfo } from '../tools/metadata/metadata';
import type { FormInfo, FormValues } from '../tools/fill-form/fillForm';
import type { Placement, SignatureImage } from '../tools/sign/sign';
import type { OcrImagePage, OcrPage } from '../tools/ocr/textLayer';
import type { RedactedPage } from '../tools/redact/redact';

let worker: Worker | null = null;
let remote: Promise<Comlink.Remote<PdfWorkerApi> | null> | null = null;

function startWorker(): Promise<Comlink.Remote<PdfWorkerApi> | null> {
  if (typeof Worker === 'undefined') return Promise.resolve(null);
  try {
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module', name: 'pdf-libre' });
  } catch {
    return Promise.resolve(null);
  }
  const w = worker;
  const api = Comlink.wrap<PdfWorkerApi>(w);
  const failed = new Promise<null>((resolve) => {
    w.addEventListener('error', () => resolve(null), { once: true });
    setTimeout(() => resolve(null), 8000);
  });
  return Promise.race([api.ping().then(() => api), failed]).then((r) => {
    if (!r) {
      w.terminate();
      if (worker === w) worker = null;
    }
    return r;
  });
}

function getRemote() {
  if (!remote) remote = startWorker();
  return remote;
}

/** Cancela la operación en curso terminando el Worker (se crea otro en la siguiente tarea) */
export function cancelWorkerTasks() {
  if (worker) {
    worker.terminate();
    worker = null;
    remote = null;
  }
}

const p = (fn?: ProgressFn) => (fn ? Comlink.proxy(fn) : undefined);

async function call<T>(viaWorker: (api: Comlink.Remote<PdfWorkerApi>) => Promise<T>, local: () => Promise<T>): Promise<T> {
  try {
    const api = await getRemote();
    return api ? await viaWorker(api) : await local();
  } catch (err) {
    throw toAppError(err);
  }
}

export const pdfTasks = {
  /** Comprueba en el Worker que el PDF no esté cifrado ni dañado; devuelve el número de páginas */
  validate: (bytes: Uint8Array, fileName?: string) =>
    call(
      (api) => api.validate(bytes, fileName),
      async () => (await (await import('../lib/pdf')).loadPdf(bytes, fileName)).getPageCount(),
    ),
  merge: (files: NamedBytes[], onProgress?: ProgressFn) =>
    call(
      (api) => api.merge(files, p(onProgress)),
      async () => (await import('../tools/merge/merge')).mergePdfs(files, onProgress),
    ),
  split: (bytes: Uint8Array, groups: number[][], onProgress?: ProgressFn) =>
    call(
      (api) => api.split(bytes, groups, p(onProgress)),
      async () => (await import('../tools/split/split')).splitPdf(bytes, groups, onProgress),
    ),
  organize: (bytes: Uint8Array, plan: PagePlan[], onProgress?: ProgressFn) =>
    call(
      (api) => api.organize(bytes, plan, p(onProgress)),
      async () => (await import('../tools/organize/organize')).organizePdf(bytes, plan, onProgress),
    ),
  imagesToPdf: (images: PreparedImage[], opts: LayoutOptions, onProgress?: ProgressFn) =>
    call(
      (api) => api.imagesToPdf(images, opts, p(onProgress)),
      async () => (await import('../tools/images-to-pdf/imagesToPdf')).imagesToPdf(images, opts, onProgress),
    ),
  compress: (bytes: Uint8Array, level: CompressLevel, onProgress?: ProgressFn) =>
    call<{ bytes: Uint8Array; stats: CompressStats }>(
      async (api) =>
        (await api.canCompress())
          ? api.compress(bytes, level, p(onProgress))
          : (await import('../tools/compress/compress')).compressPdf(
              bytes,
              level,
              (await import('../tools/compress/compress')).createCanvasCodec(),
              onProgress,
            ),
      async () => {
        const m = await import('../tools/compress/compress');
        return m.compressPdf(bytes, level, m.createCanvasCodec(), onProgress);
      },
    ),
  pageNumbers: (bytes: Uint8Array, opts: PageNumberOptions, onProgress?: ProgressFn) =>
    call(
      (api) => api.pageNumbers(bytes, opts, p(onProgress)),
      async () => (await import('../tools/page-numbers/pageNumbers')).addPageNumbers(bytes, opts, onProgress),
    ),
  readMetadata: (bytes: Uint8Array) =>
    call<MetadataInfo>(
      (api) => api.readMetadata(bytes),
      async () => (await import('../tools/metadata/metadata')).readMetadata(bytes),
    ),
  cleanMetadata: (bytes: Uint8Array, keep: MetadataEdits) =>
    call(
      (api) => api.cleanMetadata(bytes, keep),
      async () => (await import('../tools/metadata/metadata')).cleanMetadata(bytes, keep),
    ),
  readForm: (bytes: Uint8Array) =>
    call<FormInfo>(
      (api) => api.readForm(bytes),
      async () => (await import('../tools/fill-form/fillForm')).readForm(bytes),
    ),
  fillForm: (bytes: Uint8Array, values: FormValues, flatten: boolean) =>
    call(
      (api) => api.fillForm(bytes, values, flatten),
      async () => (await import('../tools/fill-form/fillForm')).fillForm(bytes, values, flatten),
    ),
  sign: (bytes: Uint8Array, images: SignatureImage[], placements: Placement[], onProgress?: ProgressFn) =>
    call(
      (api) => api.sign(bytes, images, placements, p(onProgress)),
      async () => (await import('../tools/sign/sign')).signPdf(bytes, images, placements, onProgress),
    ),
  addOcr: (bytes: Uint8Array, pages: (OcrPage | null)[], onProgress?: ProgressFn) =>
    call(
      (api) => api.addOcr(bytes, pages, p(onProgress)),
      async () => (await import('../tools/ocr/textLayer')).addOcrToPdf(bytes, pages, onProgress),
    ),
  imagesOcr: (images: OcrImagePage[], layout: LayoutOptions, onProgress?: ProgressFn) =>
    call(
      (api) => api.imagesOcr(images, layout, p(onProgress)),
      async () => (await import('../tools/ocr/textLayer')).imagesToSearchablePdf(images, layout, onProgress),
    ),
  redact: (bytes: Uint8Array, pages: RedactedPage[], onProgress?: ProgressFn) =>
    call(
      (api) => api.redact(bytes, pages, p(onProgress)),
      async () => (await import('../tools/redact/redact')).assembleRedacted(bytes, pages, onProgress),
    ),
};
