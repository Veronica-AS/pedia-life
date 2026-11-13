/**
 * Historial local OPCIONAL (desactivado por defecto): guarda en IndexedDB, solo en este
 * dispositivo, los archivos que descargas para poder volver a bajarlos. Nunca sale del navegador.
 */
const DB = 'pdflibre';
const STORE = 'history';
const FLAG = 'pdflibre.history';
const MAX_ENTRIES = 50;
const MAX_BYTES = 300 * 1024 * 1024;

export interface HistoryEntry {
  id?: number;
  date: number;
  /** Ruta de la herramienta, p. ej. "/unir-pdf" */
  tool: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export function historyEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function setHistoryEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    /* sin almacenamiento */
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req ? (req as IDBRequest<T>).result : undefined);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const all = (await tx<HistoryEntry[]>('readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.date - a.date);
}

export const deleteHistory = (id: number) => tx('readwrite', (s) => s.delete(id));
export const clearHistory = () => tx('readwrite', (s) => s.clear());

export async function addHistory(entry: Omit<HistoryEntry, 'id'>) {
  await tx('readwrite', (s) => s.add(entry));
  // Se eliminan los más antiguos si se supera el límite de cantidad o de espacio
  const all = await listHistory();
  let total = 0;
  for (let i = 0; i < all.length; i++) {
    total += all[i].size;
    if (i >= MAX_ENTRIES || total > MAX_BYTES) await deleteHistory(all[i].id!);
  }
}

/** Llamado al descargar: solo guarda si el usuario activó el historial */
export async function recordDownload(blob: Blob, name: string) {
  if (!historyEnabled() || typeof indexedDB === 'undefined') return;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const tool = location.pathname.slice(base.length) || '/';
  try {
    await addHistory({ date: Date.now(), tool, name, type: blob.type, size: blob.size, blob });
  } catch {
    /* modo privado o espacio lleno: el historial es opcional, no debe impedir la descarga */
  }
}
