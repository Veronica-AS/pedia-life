/**
 * Conversión entre coordenadas "visuales" (como se ve la página en pantalla: origen arriba a la izquierda,
 * valores 0-1) y coordenadas PDF (origen abajo a la izquierda, en puntos), teniendo en cuenta
 * el CropBox y la rotación de la página. Se usa para colocar firmas, números, texto OCR y redacciones.
 */
import { degrees, type PDFPage } from 'pdf-lib';

export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotación de visualización en grados (0, 90, 180, 270), en sentido horario */
  rotation: number;
}

export function pageBox(page: PDFPage): PageBox {
  const crop = page.getCropBox();
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as number;
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height, rotation };
}

/** Tamaño de la página tal como se ve (con la rotación aplicada) */
export function visualSize(b: PageBox): { width: number; height: number } {
  return b.rotation % 180 === 0 ? { width: b.width, height: b.height } : { width: b.height, height: b.width };
}

/** Punto visual normalizado (u hacia la derecha, v hacia abajo) → punto PDF */
export function visualToPdf(b: PageBox, u: number, v: number): { x: number; y: number } {
  switch (b.rotation) {
    case 90:
      return { x: b.x + v * b.width, y: b.y + u * b.height };
    case 180:
      return { x: b.x + (1 - u) * b.width, y: b.y + v * b.height };
    case 270:
      return { x: b.x + (1 - v) * b.width, y: b.y + (1 - u) * b.height };
    default:
      return { x: b.x + u * b.width, y: b.y + (1 - v) * b.height };
  }
}

export interface VisualRect {
  /** Esquina superior izquierda y tamaño, normalizados 0-1 respecto a la página visible */
  u: number;
  v: number;
  w: number;
  h: number;
}

/**
 * Parámetros para dibujar un elemento "derecho" (como se ve) dentro de un rectángulo visual:
 * ancla en su esquina inferior izquierda visual, tamaño en puntos y rotación para pdf-lib.
 */
export function placeRect(b: PageBox, r: VisualRect) {
  const vs = visualSize(b);
  const anchor = visualToPdf(b, r.u, r.v + r.h);
  return { x: anchor.x, y: anchor.y, width: r.w * vs.width, height: r.h * vs.height, rotate: degrees(b.rotation), angle: b.rotation };
}

const prepared = new WeakSet<PDFPage>();

/**
 * Envuelve el contenido original de la página en q…Q antes de dibujar encima.
 * Sin esto, un PDF que deja la matriz de transformación modificada haría que
 * números, firmas o texto OCR aparezcan desplazados o escalados.
 */
export function isolatePageContent(page: PDFPage) {
  if (prepared.has(page)) return;
  prepared.add(page);
  const ctx = page.doc.context;
  const start = ctx.register(ctx.stream('q\n'));
  const end = ctx.register(ctx.stream('\nQ\n'));
  page.node.wrapContentStreams(start, end);
}
