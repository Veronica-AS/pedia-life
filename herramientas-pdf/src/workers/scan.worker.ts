/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { detectDocument, enhance, outputSize, rotateRgba, toGray, warp, type Filter, type Quad } from '../tools/scan/cv';

const api = {
  detect(rgba: Uint8ClampedArray, w: number, h: number): Quad | null {
    return detectDocument(toGray(rgba, w, h), w, h);
  },
  /** quad normalizado (0-1) respecto a la imagen de origen */
  process(rgba: Uint8ClampedArray, w: number, h: number, quad: Quad, filter: Filter, rotation: number) {
    const px = quad.map((p) => ({ x: p.x * (w - 1), y: p.y * (h - 1) })) as Quad;
    const size = outputSize(px);
    const flat = warp(rgba, w, h, px, size.w, size.h);
    enhance(flat, size.w, size.h, filter);
    const r = rotateRgba(flat, size.w, size.h, rotation);
    return Comlink.transfer({ data: r.data, w: r.w, h: r.h }, [r.data.buffer as ArrayBuffer]);
  },
};

export type ScanWorkerApi = typeof api;
Comlink.expose(api);
