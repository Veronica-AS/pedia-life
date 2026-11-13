/**
 * Pasos que se pueden encadenar en un flujo o aplicar en lote.
 * Solo datos y validación (sin dependencias pesadas): se guardan en el dispositivo como JSON.
 * Las contraseñas NUNCA se guardan: se piden al ejecutar.
 */
import type { LevelId } from '../compress/levels';
import type { NumberFormat, Position } from '../page-numbers/format';

export type Step =
  | { type: 'unlock' }
  | { type: 'compress'; level: LevelId }
  | { type: 'rotate'; degrees: 90 | 180 | 270 }
  | { type: 'pageNumbers'; format: NumberFormat; position: Position; header: string; footer: string }
  | { type: 'metadata' }
  | { type: 'protect'; allowPrint: boolean; allowCopy: boolean };

export type StepType = Step['type'];

export interface Flow {
  id: string;
  name: string;
  /** true: unir todos los archivos en uno antes de aplicar los pasos; false: cada archivo por separado */
  mergeFirst: boolean;
  steps: Step[];
}

export const STEP_DEFAULTS: { [K in StepType]: Extract<Step, { type: K }> } = {
  unlock: { type: 'unlock' },
  compress: { type: 'compress', level: 'recommended' },
  rotate: { type: 'rotate', degrees: 90 },
  pageNumbers: { type: 'pageNumbers', format: 'page-n-of-total', position: 'bc', header: '', footer: '' },
  metadata: { type: 'metadata' },
  protect: { type: 'protect', allowPrint: true, allowCopy: true },
};

/** Orden recomendado: quitar contraseña al principio y proteger al final */
export const STEP_ORDER: StepType[] = ['unlock', 'rotate', 'pageNumbers', 'compress', 'metadata', 'protect'];

export const STEP_LABEL: Record<StepType, { es: string; en: string }> = {
  unlock: { es: 'Quitar contraseña', en: 'Remove password' },
  compress: { es: 'Comprimir', en: 'Compress' },
  rotate: { es: 'Rotar todas las páginas', en: 'Rotate all pages' },
  pageNumbers: { es: 'Numerar páginas', en: 'Number pages' },
  metadata: { es: 'Eliminar metadatos', en: 'Remove metadata' },
  protect: { es: 'Proteger con contraseña', en: 'Protect with password' },
};

/** Problemas que impiden ejecutar el flujo (texto en español e inglés) */
export function validateFlow(steps: Step[]): { es: string; en: string } | null {
  if (!steps.length) return { es: 'Añade al menos un paso.', en: 'Add at least one step.' };
  const pi = steps.findIndex((s) => s.type === 'protect');
  if (pi >= 0 && pi !== steps.length - 1) {
    return { es: '"Proteger con contraseña" debe ser el último paso: después ya no se puede modificar el PDF.', en: '"Protect" must be the last step.' };
  }
  const ui = steps.findIndex((s) => s.type === 'unlock');
  if (ui > 0) return { es: '"Quitar contraseña" debe ser el primer paso.', en: '"Remove password" must be the first step.' };
  if (steps.filter((s) => s.type === 'protect').length > 1 || steps.filter((s) => s.type === 'unlock').length > 1) {
    return { es: 'Las contraseñas solo pueden aparecer una vez en el flujo.', en: 'Password steps can only appear once.' };
  }
  return null;
}

export const needsPassword = (steps: Step[]) => ({
  unlock: steps.some((s) => s.type === 'unlock'),
  protect: steps.some((s) => s.type === 'protect'),
});

/** Flujos de ejemplo que se ofrecen la primera vez */
export const EXAMPLE_FLOWS: Flow[] = [
  {
    id: 'ejemplo-enviar',
    name: 'Preparar para enviar por correo',
    mergeFirst: true,
    steps: [{ ...STEP_DEFAULTS.pageNumbers }, { type: 'compress', level: 'recommended' }, { type: 'metadata' }],
  },
  {
    id: 'ejemplo-privado',
    name: 'Compartir de forma privada',
    mergeFirst: false,
    steps: [{ type: 'metadata' }, { type: 'compress', level: 'light' }, { ...STEP_DEFAULTS.protect }],
  },
];
