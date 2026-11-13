import * as Comlink from 'comlink';
import type { ScanWorkerApi } from '../../workers/scan.worker';

let remote: Comlink.Remote<ScanWorkerApi> | null = null;

/** Worker del escáner (se crea al primer uso y se reutiliza) */
export function scanWorker(): Comlink.Remote<ScanWorkerApi> {
  if (!remote) remote = Comlink.wrap<ScanWorkerApi>(new Worker(new URL('../../workers/scan.worker.ts', import.meta.url), { type: 'module', name: 'scan' }));
  return remote;
}
