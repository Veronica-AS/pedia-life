import { useCallback, useRef, useState } from 'react';
import { toAppError, type AppError } from './errors';
import type { ProgressFn } from './pdf';

export interface TaskState {
  running: boolean;
  progress: number;
  label?: string;
  error: AppError | null;
}

/**
 * Ejecuta una tarea larga con progreso real, cancelación y errores comprensibles.
 * Si se cancela o se inicia otra, el resultado de la anterior se descarta.
 */
export function useTask() {
  const [state, setState] = useState<TaskState>({ running: false, progress: 0, error: null });
  const runId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const onCancelRef = useRef<(() => void) | null>(null);

  const run = useCallback(
    async <T,>(
      fn: (onProgress: ProgressFn, signal: AbortSignal) => Promise<T>,
      opts: { onCancel?: () => void } = {},
    ): Promise<T | undefined> => {
      const id = ++runId.current;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      onCancelRef.current = opts.onCancel ?? null;
      setState({ running: true, progress: 0, error: null });
      let last = 0;
      let finished = false;
      const onProgress: ProgressFn = (fraction, label) => {
        // Ignora avisos que llegan del Worker después de terminar
        if (id !== runId.current || finished) return;
        const now = performance.now();
        // Limita las actualizaciones para no saturar la interfaz
        if (fraction < 1 && now - last < 50) return;
        last = now;
        setState((s) => ({ ...s, progress: Math.max(s.progress, Math.min(1, fraction)), label }));
      };
      try {
        const result = await fn(onProgress, ctrl.signal);
        finished = true;
        if (id !== runId.current) return undefined;
        setState({ running: false, progress: 1, error: null });
        return result;
      } catch (err) {
        finished = true;
        if (id !== runId.current || (err instanceof DOMException && err.name === 'AbortError')) return undefined;
        console.error(err);
        setState({ running: false, progress: 0, error: toAppError(err) });
        return undefined;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    runId.current++;
    abortRef.current?.abort();
    onCancelRef.current?.();
    setState({ running: false, progress: 0, error: null });
  }, []);

  const setError = useCallback((err: unknown) => {
    setState({ running: false, progress: 0, error: err ? toAppError(err) : null });
  }, []);

  return { ...state, run, cancel, setError };
}
