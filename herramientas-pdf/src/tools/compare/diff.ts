/**
 * Diferencias entre dos secuencias (algoritmo de Myers, O((N+M)·D)).
 * Se recortan primero el inicio y el final comunes; si los documentos son casi
 * totalmente distintos, se limita el trabajo para no bloquear el dispositivo.
 */

export type OpType = 'equal' | 'delete' | 'insert';

export interface DiffOp {
  type: OpType;
  /** Rango [aStart, aEnd) en la secuencia original */
  aStart: number;
  aEnd: number;
  /** Rango [bStart, bEnd) en la secuencia nueva */
  bStart: number;
  bEnd: number;
}

function push(ops: DiffOp[], type: OpType, a0: number, a1: number, b0: number, b1: number) {
  if (a1 === a0 && b1 === b0) return;
  const last = ops[ops.length - 1];
  if (last && last.type === type && last.aEnd === a0 && last.bEnd === b0) {
    last.aEnd = a1;
    last.bEnd = b1;
  } else ops.push({ type, aStart: a0, aEnd: a1, bStart: b0, bEnd: b1 });
}

/** Devuelve las operaciones, o null si hay más de maxD diferencias */
function myers(a: string[], b: string[], offA: number, offB: number, maxD: number): DiffOp[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  let v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    // Solo se guarda la ventana k ∈ [-d-1, d+1]: memoria O(D²) en lugar de O(D·(N+M))
    trace.push(v.slice(off - d - 1, off + d + 2));
    const next = v.slice();
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      next[off + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    v = next;
    if (found >= 0) break;
  }
  if (found < 0) return null;
  // Reconstrucción hacia atrás
  const rev: { type: OpType; x0: number; x1: number; y0: number; y1: number }[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const w = trace[d];
    const at = (k: number) => w[k + d + 1];
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    const midX = prevK === k + 1 ? prevX : prevX + 1;
    const midY = midX - k;
    if (x > midX) rev.push({ type: 'equal', x0: midX, x1: x, y0: midY, y1: y });
    if (prevK === k + 1) rev.push({ type: 'insert', x0: prevX, x1: prevX, y0: prevY, y1: midY });
    else rev.push({ type: 'delete', x0: prevX, x1: midX, y0: prevY, y1: prevY });
    x = prevX;
    y = prevY;
  }
  if (x > 0) rev.push({ type: 'equal', x0: 0, x1: x, y0: 0, y1: y });
  const ops: DiffOp[] = [];
  for (let i = rev.length - 1; i >= 0; i--) {
    const r = rev[i];
    push(ops, r.type, offA + r.x0, offA + r.x1, offB + r.y0, offB + r.y1);
  }
  return ops;
}

export function diffSequences(a: string[], b: string[], maxD = 4000): DiffOp[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: DiffOp[] = [];
  push(ops, 'equal', 0, start, 0, start);
  const mid = myers(a.slice(start, endA), b.slice(start, endB), start, start, maxD);
  if (mid) for (const o of mid) push(ops, o.type, o.aStart, o.aEnd, o.bStart, o.bEnd);
  else {
    // Demasiado distintos: se marca todo el bloque central como reemplazado
    push(ops, 'delete', start, endA, start, start);
    push(ops, 'insert', endA, endA, start, endB);
  }
  push(ops, 'equal', endA, a.length, endB, b.length);
  return ops;
}
