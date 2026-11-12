/** Opciones y formato de números de página (sin dependencias: se usa en la interfaz) */

export type Position = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
export type NumberFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total' | 'none';
export type Align = 'left' | 'center' | 'right';

export interface PageNumberOptions {
  position: Position;
  format: NumberFormat;
  /** Número que se muestra en la primera página numerada */
  start: number;
  /** Primera página (1-based) que recibe número/encabezado/pie */
  fromPage: number;
  fontSize: number;
  /** Margen desde el borde, en puntos */
  margin: number;
  header: string;
  headerAlign: Align;
  footer: string;
  footerAlign: Align;
}

export const DEFAULT_PAGE_NUMBERS: PageNumberOptions = {
  position: 'bc',
  format: 'n',
  start: 1,
  fromPage: 1,
  fontSize: 11,
  margin: 28,
  header: '',
  headerAlign: 'center',
  footer: '',
  footerAlign: 'left',
};

export function formatNumber(format: NumberFormat, n: number, total: number): string {
  switch (format) {
    case 'page-n':
      return `Página ${n}`;
    case 'n-of-total':
      return `${n} / ${total}`;
    case 'page-n-of-total':
      return `Página ${n} de ${total}`;
    case 'none':
      return '';
    default:
      return String(n);
  }
}

/** Sustituye {n}, {total} y {fecha} en encabezados y pies */
export function fillTemplate(text: string, n: number, total: number, date = new Date()): string {
  return text
    .replace(/\{n\}/g, String(n))
    .replace(/\{total\}/g, String(total))
    .replace(/\{fecha\}/g, date.toLocaleDateString('es'));
}
