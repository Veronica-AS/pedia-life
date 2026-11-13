import { describe, expect, it } from 'vitest';
import { detectDocument, enhance, homography, outputSize, toGray, warp, type Quad } from '../../src/tools/scan/cv';

/** Imagen sintética: fondo oscuro con ruido y un "papel" claro en forma de cuadrilátero */
function scene(w: number, h: number, quad: Quad) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const inside = (x: number, y: number) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      s += cross > 0 ? 1 : -1;
    }
    return Math.abs(s) === 4;
  };
  let seed = 3;
  const noise = () => ((seed = (seed * 16807) % 2147483647) % 21) - 10;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = (inside(x / w, y / h) ? 225 : 70) + noise();
      const j = (y * w + x) * 4;
      rgba[j] = v;
      rgba[j + 1] = v - 5;
      rgba[j + 2] = v - 15;
      rgba[j + 3] = 255;
    }
  return rgba;
}

describe('Escáner: detección del documento', () => {
  it('encuentra las esquinas de un documento girado con perspectiva', () => {
    const truth: Quad = [
      { x: 0.22, y: 0.12 },
      { x: 0.8, y: 0.2 },
      { x: 0.74, y: 0.9 },
      { x: 0.15, y: 0.82 },
    ];
    const w = 400;
    const h = 300;
    const q = detectDocument(toGray(scene(w, h, truth), w, h), w, h)!;
    expect(q).not.toBeNull();
    q.forEach((p, i) => {
      expect(Math.abs(p.x - truth[i].x)).toBeLessThan(0.02);
      expect(Math.abs(p.y - truth[i].y)).toBeLessThan(0.02);
    });
  });

  it('devuelve null si no hay un documento claro (todo uniforme)', () => {
    const w = 200;
    const h = 150;
    const flat = new Uint8Array(w * h).fill(128);
    expect(detectDocument(flat, w, h)).toBeNull();
  });
});

describe('Escáner: perspectiva', () => {
  it('la homografía lleva cada esquina a su destino', () => {
    const from: Quad = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 400 }, { x: 0, y: 380 }];
    const to: Quad = [{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 149 }, { x: 0, y: 149 }];
    const H = homography(from, to);
    from.forEach((p, i) => {
      const d = H[6] * p.x + H[7] * p.y + H[8];
      expect((H[0] * p.x + H[1] * p.y + H[2]) / d).toBeCloseTo(to[i].x, 5);
      expect((H[3] * p.x + H[4] * p.y + H[5]) / d).toBeCloseTo(to[i].y, 5);
    });
  });

  it('endereza el papel: la salida es casi toda "papel"', () => {
    const w = 400;
    const h = 300;
    const truth: Quad = [{ x: 0.22, y: 0.12 }, { x: 0.8, y: 0.2 }, { x: 0.74, y: 0.9 }, { x: 0.15, y: 0.82 }];
    const src = scene(w, h, truth);
    const px = truth.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
    const size = outputSize(px);
    const out = warp(src, w, h, px, size.w, size.h);
    let bright = 0;
    for (let i = 0; i < out.length; i += 4) if (out[i] > 150) bright++;
    expect(bright / (size.w * size.h)).toBeGreaterThan(0.97);
  });
});

describe('Escáner: blanco y negro adaptativo', () => {
  it('mantiene el texto negro aunque haya sombra en media página', () => {
    const w = 200;
    const h = 100;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const paper = x < 100 ? 230 : 120; // sombra en la mitad derecha
        const ink = x % 20 < 3 && y > 40 && y < 60; // trazos de "texto"
        const v = ink ? paper * 0.35 : paper;
        const j = (y * w + x) * 4;
        rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
        rgba[j + 3] = 255;
      }
    enhance(rgba, w, h, 'bw');
    const at = (x: number, y: number) => rgba[(y * w + x) * 4];
    expect(at(160, 50)).toBe(0); // texto en la sombra
    expect(at(141, 50)).toBe(0);
    expect(at(150, 50)).toBe(255); // entre letras, en la sombra
    expect(at(155, 20)).toBe(255); // papel en la sombra queda blanco
    expect(at(55, 20)).toBe(255);
  });
});
