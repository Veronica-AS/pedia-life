/**
 * Motor OCR (tesseract.js) servido desde la propia app: nada se envía a internet.
 * El motor y los idiomas se descargan del mismo sitio la primera vez y quedan en caché.
 */
import { AppError } from '../../lib/errors';
import type { OcrLine, OcrPage } from './textLayer';

export type OcrLang = 'spa' | 'eng' | 'spa+eng';

export interface OcrProgress {
  /** 0-1 dentro de la etapa actual */
  progress: number;
  stage: 'loading' | 'recognizing';
}

export interface OcrEngine {
  recognize(image: Blob, width: number, height: number, onProgress?: (p: number) => void): Promise<OcrPage>;
  terminate(): Promise<void>;
}

const base = () => `${import.meta.env.BASE_URL}tesseract/`;

interface TessLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TessBlock {
  paragraphs: { lines: TessLine[] }[];
}

export async function createOcrEngine(lang: OcrLang, onLoad?: (p: OcrProgress) => void): Promise<OcrEngine> {
  let current: ((p: number) => void) | undefined;
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(lang.split('+'), 1, {
      workerPath: `${base()}worker.min.js`,
      corePath: base(),
      langPath: `${base()}lang`,
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') current?.(m.progress);
        else onLoad?.({ stage: 'loading', progress: m.progress });
      },
    });
    await worker.setParameters({ preserve_interword_spaces: '1' } as Record<string, string>);
    return {
      async recognize(image, width, height, onProgress) {
        current = onProgress;
        try {
          const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
          const blocks = ((data as unknown as { blocks?: TessBlock[] }).blocks ?? []) as TessBlock[];
          const lines: OcrLine[] = blocks
            .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
            .filter((l) => l.text.trim())
            .map((l) => ({
              text: l.text.replace(/\s+$/, ''),
              confidence: l.confidence,
              x0: l.bbox.x0 / width,
              y0: l.bbox.y0 / height,
              x1: l.bbox.x1 / width,
              y1: l.bbox.y1 / height,
            }));
          return { lines };
        } finally {
          current = undefined;
        }
      },
      terminate: async () => {
        await worker.terminate();
      },
    };
  } catch (err) {
    throw new AppError('ocr-failed', { cause: err, detail: err instanceof Error ? err.message : String(err) });
  }
}

/** Umbral por debajo del cual una línea se marca para revisión */
export const LOW_CONFIDENCE = 75;
