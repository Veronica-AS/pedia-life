export function formatBytes(bytes: number, lang: 'es' | 'en' = 'es'): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : n < 10 ? 1 : 0;
  return `${n.toLocaleString(lang === 'es' ? 'es' : 'en', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[i]}`;
}

export function baseName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  const b = i > 0 ? fileName.slice(0, i) : fileName;
  return b.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'documento';
}

export function percent(fraction: number): number {
  return Math.max(0, Math.min(100, Math.round(fraction * 100)));
}
