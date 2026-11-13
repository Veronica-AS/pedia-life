import type { PDFFont } from 'pdf-lib';

/**
 * Las fuentes estándar de PDF (Helvetica, etc.) usan WinAnsi: cubren el español (á, ñ, ¿, ¡, €)
 * pero no otros alfabetos. Este ayudante sustituye lo que no se puede codificar
 * (primero quitando diacríticos, luego por "?") para que pdf-lib no falle.
 */
export function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text.replace(/\r?\n/g, ' ').replace(/\t/g, ' ')) {
    if (canEncode(font, ch)) {
      out += ch;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && base !== ch && canEncode(font, base) ? base : ch.trim() ? '?' : ' ';
  }
  return out;
}

const cache = new WeakMap<PDFFont, Map<string, boolean>>();

function canEncode(font: PDFFont, ch: string): boolean {
  let m = cache.get(font);
  if (!m) cache.set(font, (m = new Map()));
  const hit = m.get(ch);
  if (hit !== undefined) return hit;
  let ok = true;
  try {
    font.encodeText(ch);
    font.widthOfTextAtSize(ch, 10);
  } catch {
    ok = false;
  }
  m.set(ch, ok);
  return ok;
}
