/**
 * Errores con mensajes claros: qué pasó y cómo resolverlo.
 * El código viaja entre el Worker y la interfaz (los objetos Error pierden
 * su clase al cruzar postMessage), por eso se serializa en el mensaje.
 */

export type ErrorCode =
  | 'encrypted'
  | 'corrupt'
  | 'not-pdf'
  | 'empty-file'
  | 'unsupported-file'
  | 'image-decode'
  | 'heic-failed'
  | 'out-of-memory'
  | 'invalid-range'
  | 'no-pages'
  | 'canvas-too-large'
  | 'unknown';

const PREFIX = 'APPERR::';

export class AppError extends Error {
  code: ErrorCode;
  fileName?: string;
  detail?: string;
  constructor(code: ErrorCode, opts: { fileName?: string; detail?: string; cause?: unknown } = {}) {
    super(`${PREFIX}${JSON.stringify({ code, fileName: opts.fileName, detail: opts.detail })}`);
    this.name = 'AppError';
    this.code = code;
    this.fileName = opts.fileName;
    this.detail = opts.detail;
  }
}

/** Convierte cualquier error (de pdf-lib, pdf.js, el Worker, el navegador) en un AppError */
export function toAppError(err: unknown, fileName?: string): AppError {
  if (err instanceof AppError) {
    if (fileName && !err.fileName) err.fileName = fileName;
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const name = err instanceof Error ? err.name : '';

  const idx = msg.indexOf(PREFIX);
  if (idx >= 0) {
    try {
      const data = JSON.parse(msg.slice(idx + PREFIX.length));
      return new AppError(data.code, { fileName: data.fileName ?? fileName, detail: data.detail });
    } catch {
      /* sigue */
    }
  }
  if (name === 'PasswordException' || /encrypt/i.test(msg) || /password/i.test(msg)) {
    return new AppError('encrypted', { fileName });
  }
  if (
    name === 'InvalidPDFException' ||
    /Invalid PDF|Failed to parse|No PDF header|Expected instance of PDFDict|trailer|xref|Invalid object ref/i.test(msg)
  ) {
    return new AppError('corrupt', { fileName });
  }
  if (err instanceof RangeError || /allocation|out of memory|Array buffer allocation/i.test(msg)) {
    return new AppError('out-of-memory', { fileName });
  }
  return new AppError('unknown', { fileName, detail: msg.slice(0, 300) });
}

export interface ErrorText {
  title: string;
  fix: string;
}

export const ERROR_TEXT: Record<'es' | 'en', Record<ErrorCode, ErrorText>> = {
  es: {
    encrypted: {
      title: 'Este PDF está protegido con contraseña',
      fix: 'Ábrelo con la contraseña y guárdalo sin protección, o espera la herramienta "Quitar contraseña" que llega en la próxima fase.',
    },
    corrupt: {
      title: 'El archivo parece dañado o incompleto',
      fix: 'Prueba a descargarlo de nuevo desde su origen. Si se abre en otro lector de PDF, ábrelo allí y usa "Imprimir → Guardar como PDF" para generar una copia sana.',
    },
    'not-pdf': {
      title: 'Este archivo no es un PDF',
      fix: 'Comprueba que elegiste el archivo correcto. Si es una imagen, usa la herramienta "Imágenes a PDF".',
    },
    'empty-file': {
      title: 'El archivo está vacío (0 bytes)',
      fix: 'Puede que la descarga o la copia no terminara. Vuelve a obtener el archivo.',
    },
    'unsupported-file': {
      title: 'Este tipo de archivo no es compatible con esta herramienta',
      fix: 'Revisa los formatos admitidos que aparecen en el recuadro para soltar archivos.',
    },
    'image-decode': {
      title: 'No se pudo leer esta imagen',
      fix: 'Puede estar dañada o usar un formato poco común. Ábrela y vuelve a guardarla como JPG o PNG.',
    },
    'heic-failed': {
      title: 'No se pudo convertir la foto HEIC',
      fix: 'En el iPhone puedes ir a Ajustes → Cámara → Formatos y elegir "Más compatible" para futuras fotos, o compartir la foto como JPG.',
    },
    'out-of-memory': {
      title: 'Tu dispositivo se quedó sin memoria para este archivo',
      fix: 'Cierra otras pestañas y apps e inténtalo de nuevo. Si sigue fallando, divide el archivo en partes más pequeñas o usa una resolución menor.',
    },
    'invalid-range': {
      title: 'Los rangos de páginas no son válidos',
      fix: 'Usa números y guiones separados por comas, por ejemplo: 1-3, 5, 8-10.',
    },
    'no-pages': {
      title: 'No quedan páginas en el documento',
      fix: 'Deja al menos una página sin eliminar.',
    },
    'canvas-too-large': {
      title: 'La página es demasiado grande para esta resolución',
      fix: 'Elige una resolución menor. Tu navegador limita el tamaño máximo de imagen.',
    },
    unknown: {
      title: 'Algo salió mal al procesar el archivo',
      fix: 'Inténtalo de nuevo. Si el problema continúa, prueba con otro navegador (Chrome, Firefox o Safari actualizados).',
    },
  },
  en: {
    encrypted: { title: 'This PDF is password protected', fix: 'Open it with its password and save an unprotected copy.' },
    corrupt: { title: 'The file looks damaged or incomplete', fix: 'Download it again, or open it elsewhere and "Print → Save as PDF".' },
    'not-pdf': { title: 'This file is not a PDF', fix: 'Check you chose the right file. For images use "Images to PDF".' },
    'empty-file': { title: 'The file is empty (0 bytes)', fix: 'The download or copy may not have finished. Get the file again.' },
    'unsupported-file': { title: 'This file type is not supported here', fix: 'Check the supported formats shown in the drop area.' },
    'image-decode': { title: 'This image could not be read', fix: 'It may be damaged. Re-save it as JPG or PNG.' },
    'heic-failed': { title: 'The HEIC photo could not be converted', fix: 'Share the photo as JPG from your iPhone.' },
    'out-of-memory': { title: 'Your device ran out of memory', fix: 'Close other tabs and try again, or split the file.' },
    'invalid-range': { title: 'Invalid page ranges', fix: 'Use numbers and hyphens separated by commas, e.g. 1-3, 5, 8-10.' },
    'no-pages': { title: 'No pages left', fix: 'Keep at least one page.' },
    'canvas-too-large': { title: 'The page is too large for this resolution', fix: 'Choose a lower resolution.' },
    unknown: { title: 'Something went wrong', fix: 'Try again, or use an up-to-date Chrome, Firefox or Safari.' },
  },
};
