import { zipSync } from 'fflate';

export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes], { type });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari necesita que la URL siga viva un momento después del clic
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  // Historial local opcional (solo si el usuario lo activó)
  import('./history').then((h) => h.recordDownload(blob, fileName)).catch(() => {});
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  type: string;
}

/** Evita nombres repetidos dentro del ZIP */
export function uniqueNames(files: OutputFile[]): OutputFile[] {
  const seen = new Map<string, number>();
  return files.map((f) => {
    const count = seen.get(f.name) ?? 0;
    seen.set(f.name, count + 1);
    if (count === 0) return f;
    const dot = f.name.lastIndexOf('.');
    const name = dot > 0 ? `${f.name.slice(0, dot)} (${count + 1})${f.name.slice(dot)}` : `${f.name} (${count + 1})`;
    return { ...f, name };
  });
}

/** Empaqueta en ZIP sin recomprimir (PDF e imágenes ya están comprimidos) */
export function makeZip(files: OutputFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of uniqueNames(files)) entries[f.name] = [f.bytes, { level: 0 }];
  return zipSync(entries);
}

export async function fileToBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
