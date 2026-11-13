/**
 * Ejecuta un flujo: (opcionalmente) une los archivos y aplica cada paso en orden.
 * Cada paso usa el Worker correspondiente (pdf-lib o qpdf), así la interfaz no se congela.
 */
import type { OutputFile } from '../../lib/download';
import { toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { LEVELS } from '../compress/levels';
import { DEFAULT_PAGE_NUMBERS } from '../page-numbers/format';
import { pdfTasks } from '../../workers/client';
import { qpdfTasks } from '../../workers/qpdfClient';
import type { Flow, Step } from './steps';

export interface FlowInput {
  name: string;
  bytes: Uint8Array;
}

export interface FlowPasswords {
  unlock?: string;
  protect?: string;
}

export interface FlowResult {
  outputs: (OutputFile & { source: string; originalSize: number })[];
  /** Archivos que fallaron (el resto se procesa igualmente) */
  failures: { name: string; error: ReturnType<typeof toAppError> }[];
}

export async function applyStep(bytes: Uint8Array, step: Step, pw: FlowPasswords): Promise<Uint8Array> {
  switch (step.type) {
    case 'unlock':
      return qpdfTasks.decrypt(bytes, pw.unlock ?? '');
    case 'compress':
      return (await pdfTasks.compress(bytes, LEVELS[step.level])).bytes;
    case 'rotate':
      return pdfTasks.rotateAll(bytes, step.degrees);
    case 'pageNumbers':
      return pdfTasks.pageNumbers(bytes, { ...DEFAULT_PAGE_NUMBERS, format: step.format, position: step.position, header: step.header, footer: step.footer });
    case 'metadata':
      return pdfTasks.cleanMetadata(bytes, {});
    case 'protect':
      return qpdfTasks.encrypt(bytes, { userPassword: pw.protect ?? '', allowPrint: step.allowPrint, allowCopy: step.allowCopy, allowModify: false });
  }
}

const suffix = (flow: Flow) => (flow.steps.length === 1 ? stepSuffix(flow.steps[0]) : 'procesado');
function stepSuffix(s: Step): string {
  return { unlock: 'sin-contraseña', compress: 'comprimido', rotate: 'rotado', pageNumbers: 'numerado', metadata: 'sin-metadatos', protect: 'protegido' }[s.type];
}

export async function runFlow(
  inputs: FlowInput[],
  flow: Flow,
  pw: FlowPasswords,
  onProgress: (fraction: number, label: string) => void,
  signal?: AbortSignal,
): Promise<FlowResult> {
  const outputs: FlowResult['outputs'] = [];
  const failures: FlowResult['failures'] = [];
  const steps = flow.steps;

  // Si hay que unir y el primer paso es quitar contraseña, se desbloquea cada archivo antes de unir
  let items = inputs;
  let pending = steps;
  if (flow.mergeFirst && inputs.length > 1) {
    if (steps[0]?.type === 'unlock') {
      items = [];
      for (const f of inputs) items.push({ name: f.name, bytes: await applyStep(f.bytes, steps[0], pw) });
      pending = steps.slice(1);
    }
    onProgress(0, 'Uniendo archivos…');
    const merged = await pdfTasks.merge(items);
    items = [{ name: 'documentos-unidos.pdf', bytes: merged }];
  }

  const total = items.length * Math.max(1, pending.length);
  let done = 0;
  for (const item of items) {
    try {
      let bytes = item.bytes;
      for (const step of pending) {
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        onProgress(done / total, `${item.name}: ${step.type}`);
        bytes = await applyStep(bytes, step, pw);
        done++;
      }
      const original = flow.mergeFirst && inputs.length > 1 ? inputs.reduce((s, f) => s + f.bytes.length, 0) : item.bytes.length;
      outputs.push({ name: `${baseName(item.name)}-${suffix(flow)}.pdf`, bytes, type: 'application/pdf', source: item.name, originalSize: original });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      failures.push({ name: item.name, error: toAppError(err, item.name) });
      done += pending.length;
    }
  }
  onProgress(1, '');
  return { outputs, failures };
}
