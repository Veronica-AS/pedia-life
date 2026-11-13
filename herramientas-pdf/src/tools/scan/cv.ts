/**
 * Visión por computadora mínima para escanear documentos, sin dependencias:
 * detección del documento (papel claro sobre fondo más oscuro), corrección de
 * perspectiva y filtros para mejorar la legibilidad. Funciona en un Worker o en Node.
 */

export interface Pt {
  x: number;
  y: number;
}
/** Esquinas en orden: arriba-izq, arriba-der, abajo-der, abajo-izq */
export type Quad = [Pt, Pt, Pt, Pt];

export type Filter = 'original' | 'color' | 'gray' | 'bw';

export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

/** Desenfoque de caja (separable) para quitar ruido antes de umbralizar */
export function boxBlur(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / size;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Umbral de Otsu: separa automáticamente "papel" de "fondo" */
export function otsu(gray: Uint8Array): number {
  const hist = new Float64Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Busca el documento: la mayor región clara y conectada. Sus esquinas son los puntos extremos
 * en las diagonales (mín./máx. de x+y y x−y), lo que funciona con documentos girados hasta ~40°.
 * Devuelve null si no hay una región clara convincente (el usuario ajustará las esquinas).
 */
export function detectDocument(gray: Uint8Array, w: number, h: number): Quad | null {
  const blurred = boxBlur(gray, w, h, 2);
  const t = otsu(blurred);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = blurred[i] > t ? 1 : 0;

  // Componente conexa más grande (recorrido iterativo para no desbordar la pila)
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestId = 0;
  let bestSize = 0;
  let id = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    id++;
    let size = 0;
    let sp = 0;
    stack[sp++] = start;
    label[start] = id;
    while (sp) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !label[p - 1]) (label[p - 1] = id), (stack[sp++] = p - 1);
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) (label[p + 1] = id), (stack[sp++] = p + 1);
      if (y > 0 && mask[p - w] && !label[p - w]) (label[p - w] = id), (stack[sp++] = p - w);
      if (y < h - 1 && mask[p + w] && !label[p + w]) (label[p + w] = id), (stack[sp++] = p + w);
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
  }
  const frac = bestSize / (w * h);
  if (frac < 0.12 || frac > 0.97) return null;

  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let p = 0; p < label.length; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w;
    const y = (p - x) / w;
    const sum = x + y;
    const dif = x - y;
    if (sum < tl.s) tl = { x, y, s: sum };
    if (sum > br.s) br = { x, y, s: sum };
    if (dif > tr.s) tr = { x, y, s: dif };
    if (dif < bl.s) bl = { x, y, s: dif };
  }
  const quad: Quad = [tl, tr, br, bl].map((p) => ({ x: (p.x + 0.5) / w, y: (p.y + 0.5) / h })) as Quad;
  // Un cuadrilátero muy pequeño o degenerado no es un documento
  return quadArea(quad) > 0.1 ? quad : null;
}

export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Esquinas por defecto: casi toda la imagen */
export const FULL_QUAD: Quad = [
  { x: 0.02, y: 0.02 },
  { x: 0.98, y: 0.02 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.98 },
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Tamaño de salida a partir de las esquinas (en píxeles de la imagen original), limitado */
export function outputSize(q: Quad, maxSide = 2480): { w: number; h: number } {
  const w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Homografía que lleva los puntos `from` a `to` (8 incógnitas, eliminación gaussiana) */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row) => row[8]), 1];
}

/**
 * Corrige la perspectiva: recorta el cuadrilátero (en píxeles de la imagen) y lo "endereza"
 * a un rectángulo de outW × outH, con interpolación bilineal.
 */
export function warp(src: Uint8ClampedArray, sw: number, sh: number, quad: Quad, outW: number, outH: number): Uint8ClampedArray {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const H = homography(rect, quad); // salida → origen
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const den = H[6] * x + H[7] * y + H[8];
      let sx = (H[0] * x + H[1] * y + H[2]) / den;
      let sy = (H[3] * x + H[4] * y + H[5]) / den;
      sx = Math.min(sw - 1.001, Math.max(0, sx));
      sy = Math.min(sh - 1.001, Math.max(0, sy));
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        out[o + c] = top + (bot - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

function percentiles(values: Uint8Array | Uint8ClampedArray, step: number, offset: number, lo: number, hi: number): [number, number] {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = offset; i < values.length; i += step) {
    hist[values[i]]++;
    n++;
  }
  let acc = 0;
  let a = 0;
  let b = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * lo) {
      a = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= n * (1 - hi)) {
      b = v;
      break;
    }
  }
  return [a, Math.max(a + 1, b)];
}

/** Mejora la imagen escaneada (modifica y devuelve el mismo arreglo RGBA) */
export function enhance(rgba: Uint8ClampedArray, w: number, h: number, filter: Filter): Uint8ClampedArray {
  if (filter === 'original') return rgba;
  if (filter === 'color') {
    // Estira el contraste de cada canal (también corrige el tono amarillento de la luz)
    for (let c = 0; c < 3; c++) {
      const [lo, hi] = percentiles(rgba, 4, c, 0.01, 0.97);
      const k = 255 / (hi - lo);
      for (let i = c; i < rgba.length; i += 4) rgba[i] = (rgba[i] - lo) * k;
    }
    return rgba;
  }
  const gray = toGray(rgba, w, h);
  if (filter === 'gray') {
    const [lo, hi] = percentiles(gray, 1, 0, 0.01, 0.97);
    const k = 255 / (hi - lo);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) rgba[j] = rgba[j + 1] = rgba[j + 2] = (gray[i] - lo) * k;
    return rgba;
  }
  // Blanco y negro con umbral adaptativo (media local con imagen integral): ideal para texto con sombras
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 40));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = gray[y * w + x] < mean * 0.88 ? 0 : 255;
      const j = (y * w + x) * 4;
      rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
    }
  }
  return rgba;
}

/** Gira una imagen RGBA en pasos de 90° (en sentido horario) */
export function rotateRgba(src: Uint8ClampedArray, w: number, h: number, deg: number): { data: Uint8ClampedArray; w: number; h: number } {
  const r = (((deg % 360) + 360) % 360) / 90;
  if (!r) return { data: src, w, h };
  const nw = r % 2 ? h : w;
  const nh = r % 2 ? w : h;
  const out = new Uint8ClampedArray(src.length);
  const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
  const o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [nx, ny] = r === 1 ? [h - 1 - y, x] : r === 2 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x];
      o32[ny * nw + nx] = s32[y * w + x];
    }
  return { data: out, w: nw, h: nh };
}
