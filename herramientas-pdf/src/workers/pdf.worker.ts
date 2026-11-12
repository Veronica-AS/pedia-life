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
import { addPageNumbers, type PageNumberOptions } from '../tools/page-numbers/pageNumbers';
import { cleanMetadata, readMetadata, type MetadataEdits } from '../tools/metadata/metadata';
import { fillForm, readForm, type FormValues } from '../tools/fill-form/fillForm';
import { signPdf, type Placement, type SignatureImage } from '../tools/sign/sign';
import { addOcrToPdf, imagesToSearchablePdf, type OcrImagePage, type OcrPage } from '../tools/ocr/textLayer';
import { assembleRedacted, type RedactedPage } from '../tools/redact/redact';

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
  async pageNumbers(bytes: Uint8Array, opts: PageNumberOptions, onProgress?: ProgressFn) {
    return transfer(await addPageNumbers(bytes, opts, onProgress));
  },
  readMetadata: (bytes: Uint8Array) => readMetadata(bytes),
  async cleanMetadata(bytes: Uint8Array, keep: MetadataEdits) {
    return transfer(await cleanMetadata(bytes, keep));
  },
  readForm: (bytes: Uint8Array) => readForm(bytes),
  async fillForm(bytes: Uint8Array, values: FormValues, flatten: boolean) {
    return transfer(await fillForm(bytes, values, flatten));
  },
  async sign(bytes: Uint8Array, images: SignatureImage[], placements: Placement[], onProgress?: ProgressFn) {
    return transfer(await signPdf(bytes, images, placements, onProgress));
  },
  async addOcr(bytes: Uint8Array, pages: (OcrPage | null)[], onProgress?: ProgressFn) {
    return transfer(await addOcrToPdf(bytes, pages, onProgress));
  },
  async imagesOcr(images: OcrImagePage[], layout: LayoutOptions, onProgress?: ProgressFn) {
    return transfer(await imagesToSearchablePdf(images, layout, onProgress));
  },
  async redact(bytes: Uint8Array, pages: RedactedPage[], onProgress?: ProgressFn) {
    return transfer(await assembleRedacted(bytes, pages, onProgress));
  },
};

export type PdfWorkerApi = typeof api;

Comlink.expose(api);
