/** Niveles de compresión (sin dependencias, se puede importar desde la interfaz) */

export type LevelId = 'light' | 'recommended' | 'strong';

export interface CompressLevel {
  id: LevelId;
  /** Lado mayor máximo de cada imagen, en píxeles */
  maxDim: number;
  /** Calidad JPEG 0-1 */
  quality: number;
}

export const LEVELS: Record<LevelId, CompressLevel> = {
  light: { id: 'light', maxDim: 2400, quality: 0.82 },
  recommended: { id: 'recommended', maxDim: 1600, quality: 0.68 },
  strong: { id: 'strong', maxDim: 1100, quality: 0.5 },
};

export interface CompressStats {
  images: number;
  recompressed: number;
  originalSize: number;
  finalSize: number;
}
