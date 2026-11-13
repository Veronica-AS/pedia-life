import { ArrowRight, FileText, X } from 'lucide-react';
import { useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PasswordInput } from '../../components/PasswordInput';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { ActionBar } from '../../components/PdfDropOrError';
import { useI18n, useL } from '../../i18n/I18nProvider';
import { fileToBytes } from '../../lib/download';
import { AppError, ERROR_TEXT } from '../../lib/errors';
import { formatBytes } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks } from '../../workers/client';
import { runFlow, type FlowInput, type FlowResult } from './runFlow';
import { needsPassword, validateFlow, type Flow } from './steps';

let seq = 0;

/** Elegir muchos archivos, pedir contraseñas si hacen falta, ejecutar y mostrar resultados */
export function FlowRunner({ flow, actionLabel, zipName }: { flow: Flow; actionLabel: string; zipName: string }) {
  const L = useL();
  const { lang } = useI18n();
  const [files, setFiles] = useState<(FlowInput & { id: string })[]>([]);
  const [rejected, setRejected] = useState<AppError | null>(null);
  const [pwUnlock, setPwUnlock] = useState('');
  const [pwProtect, setPwProtect] = useState('');
  const [pwProtect2, setPwProtect2] = useState('');
  const [result, setResult] = useState<FlowResult | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const task = useTask();

  const add = async (list: File[]) => {
    setRejected(null);
    const loaded = await Promise.all(list.map(async (f) => ({ id: `in${++seq}`, name: f.name, bytes: await fileToBytes(f) })));
    setFiles((p) => [...p, ...loaded]);
  };

  const pw = needsPassword(flow.steps);
  const invalid = validateFlow(flow.steps);
  const pwMissing = (pw.unlock && !pwUnlock) || (pw.protect && (!pwProtect || pwProtect !== pwProtect2));

  if (result) {
    const current = result.outputs[Math.min(previewIdx, result.outputs.length - 1)];
    return (
      <div className="space-y-4">
        {result.failures.map((f) => (
          <ErrorMessage key={f.name} error={f.error} />
        ))}
        {result.outputs.length > 0 && (
          <ResultPanel files={result.outputs} zipName={zipName} onBack={() => setResult(null)} onReset={() => (setResult(null), setFiles([]))}>
            <ul className="mb-4 max-h-72 space-y-1 overflow-auto" data-testid="flow-results">
              {result.outputs.map((o, i) => {
                const diff = o.bytes.length - o.originalSize;
                return (
                  <li key={o.name}>
                    <button
                      type="button"
                      onClick={() => setPreviewIdx(i)}
                      aria-current={i === previewIdx}
                      className={`flex w-full flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === previewIdx ? 'bg-brand-50 dark:bg-brand-950/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                      <span className="tabular-nums muted">
                        {formatBytes(o.originalSize, lang)} <ArrowRight className="inline h-3 w-3" aria-label={L('a', 'to')} /> {formatBytes(o.bytes.length, lang)}
                      </span>
                      {diff < 0 && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">−{Math.round((-diff / o.originalSize) * 100)}%</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {current && (
              flow.steps.some((s) => s.type === 'protect') ? (
                <PdfPreview key={current.name} bytes={current.bytes} maxPages={12} password={pwProtect} />
              ) : (
                <PdfPreview key={current.name} bytes={current.bytes} maxPages={12} />
              )
            )}
          </ResultPanel>
        )}
        {result.outputs.length === 0 && (
          <button type="button" className="btn-secondary" onClick={() => setResult(null)}>
            {L('Volver', 'Back')}
          </button>
        )}
      </div>
    );
  }

  const run = async () => {
    const out = await task.run(
      (onProgress, signal) =>
        runFlow(
          files,
          flow,
          { unlock: pwUnlock, protect: pwProtect },
          (f, label) => onProgress(f, label),
          signal,
        ),
      { onCancel: cancelWorkerTasks },
    );
    if (out) {
      setPreviewIdx(0);
      setResult(out);
    }
  };

  return (
    <div className="space-y-4">
      {files.length === 0 ? (
        <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} multiple onFiles={add} onRejected={(n) => setRejected(new AppError('not-pdf', { fileName: n.join(', ') }))} />
      ) : (
        <>
          <ul className="space-y-1" aria-label={L('Archivos', 'Files')} data-testid="flow-inputs">
            {files.map((f) => (
              <li key={f.id} className="card flex items-center gap-2 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="muted tabular-nums">{formatBytes(f.bytes.length, lang)}</span>
                <button type="button" className="btn-icon-sm" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} aria-label={`${L('Quitar', 'Remove')}: ${f.name}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <FileDropzone compact accept={['.pdf']} mimeTypes={['application/pdf']} multiple onFiles={add} onRejected={(n) => setRejected(new AppError('not-pdf', { fileName: n.join(', ') }))} />
        </>
      )}
      {rejected && <ErrorMessage error={rejected} onDismiss={() => setRejected(null)} />}

      {(pw.unlock || pw.protect) && files.length > 0 && (
        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          {pw.unlock && <PasswordInput id="flow-unlock" label={L('Contraseña actual de los PDF', 'Current PDF password')} value={pwUnlock} onChange={setPwUnlock} autoComplete="current-password" />}
          {pw.protect && (
            <>
              <PasswordInput id="flow-protect" label={L('Nueva contraseña', 'New password')} value={pwProtect} onChange={setPwProtect} />
              <PasswordInput id="flow-protect2" label={L('Repite la nueva contraseña', 'Repeat new password')} value={pwProtect2} onChange={setPwProtect2} />
            </>
          )}
          <p className="text-xs muted sm:col-span-2">{L('Las contraseñas solo se usan ahora y no se guardan.', 'Passwords are only used now and never saved.')}</p>
        </div>
      )}

      {invalid && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{invalid[lang]}</p>}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {files.length > 0 && (
        <ActionBar>
          {task.running ? (
            <ProgressBar value={task.progress} label={task.label?.replace(/: \w+$/, '')} onCancel={task.cancel} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!!invalid || !!pwMissing} onClick={run} data-testid="run-flow">
              {actionLabel} ({files.length})
            </button>
          )}
        </ActionBar>
      )}
      {pw.protect && pwProtect2 && pwProtect !== pwProtect2 && <p className="text-sm text-red-700 dark:text-red-400">{ERROR_TEXT[lang]['weak-password'].title}</p>}
    </div>
  );
}
