/**
 * Capa de texto invisible (OCR): el texto no se ve, pero se puede seleccionar, copiar y buscar.
 * Cada línea se coloca sobre su posición en la imagen y se estira horizontalmente para ocupar el mismo ancho.
 */
import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { safeText } from '../../lib/fontText';
import { pageBox, visualSize, visualToPdf, isolatePageContent } from '../../lib/geometry';
import { loadPdf, saveOptions, type ProgressFn } from '../../lib/pdf';
import { layoutImage, type LayoutOptions } from '../images-to-pdf/layout';

export interface OcrLine {
  text: string;
  /** Caja normalizada respecto a la página visible: (x0, y0) arriba-izquierda, (x1, y1) abajo-derecha */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

export interface OcrPage {
  lines: OcrLine[];
}

/** Escribe líneas invisibles sobre una página (respeta su rotación y CropBox) */
export function addTextLayer(page: PDFPage, font: PDFFont, fontKey: string, lines: OcrLine[]) {
  isolatePageContent(page);
  const box = pageBox(page);
  const vs = visualSize(box);
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ops = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
  for (const line of lines) {
    const text = safeText(font, line.text).trim();
    if (!text) continue;
    const heightPt = Math.max(1, (line.y1 - line.y0) * vs.height);
    const widthPt = Math.max(1, (line.x1 - line.x0) * vs.width);
    const size = heightPt * 0.85;
    const natural = font.widthOfTextAtSize(text, size);
    if (!natural) continue;
    // Línea base cerca del borde inferior de la caja
    const base = visualToPdf(box, line.x0, line.y1 - (line.y1 - line.y0) * 0.18);
    ops.push(
      setFontAndSize(fontKey, size),
      setCharacterSqueeze(Math.max(1, Math.min(1000, (widthPt / natural) * 100))),
      setTextMatrix(cos, sin, -sin, cos, base.x, base.y),
      showText(font.encodeText(text)),
    );
  }
  ops.push(endText(), popGraphicsState());
  page.pushOperators(...ops);
}

/** Registra la fuente en los recursos de la página y devuelve su nombre interno (p. ej. "F1-0") */
function registerFont(page: PDFPage, font: PDFFont): string {
  page.setFont(font);
  return (page as unknown as { fontKey: string }).fontKey;
}

/** Añade capas de texto a un PDF existente. pages[i] = líneas de la página i (o null para no tocarla) */
export async function addOcrToPdf(bytes: Uint8Array, pages: (OcrPage | null)[], onProgress?: ProgressFn): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  await applyLayers(doc, pages, onProgress);
  return doc.save(saveOptions);
}

export async function applyLayers(doc: PDFDocument, pages: (OcrPage | null)[], onProgress?: ProgressFn) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const list = doc.getPages();
  pages.forEach((p, i) => {
    onProgress?.(i / Math.max(1, pages.length));
    if (!p || !list[i]) return;
    addTextLayer(list[i], font, registerFont(list[i], font), p.lines);
  });
}

export interface OcrImagePage {
  /** JPEG o PNG */
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
  ocr: OcrPage;
}

/** Crea un PDF buscable a partir de fotos o escaneos (una página por imagen) */
export async function imagesToSearchablePdf(images: OcrImagePage[], layout: LayoutOptions, onProgress?: ProgressFn): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer('PDF Libre');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < images.length; i++) {
    onProgress?.(i / images.length);
    const im = images[i];
    const emb = im.kind === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes);
    const l = layoutImage(emb.width, emb.height, layout);
    const page = doc.addPage([l.pageWidth, l.pageHeight]);
    page.drawImage(emb, { x: l.x, y: l.y, width: l.width, height: l.height });
    // Las coordenadas OCR son relativas a la imagen: se pasan a coordenadas de la página
    const sx = l.width / l.pageWidth;
    const sy = l.height / l.pageHeight;
    const ox = l.x / l.pageWidth;
    const oy = (l.pageHeight - l.y - l.height) / l.pageHeight;
    const lines = im.ocr.lines.map((ln) => ({ ...ln, x0: ox + ln.x0 * sx, x1: ox + ln.x1 * sx, y0: oy + ln.y0 * sy, y1: oy + ln.y1 * sy }));
    addTextLayer(page, font, registerFont(page, font), lines);
  }
  const out = await doc.save(saveOptions);
  onProgress?.(1);
  return out;
}

