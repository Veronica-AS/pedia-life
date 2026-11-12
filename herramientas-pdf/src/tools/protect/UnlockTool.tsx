import { LockOpen } from 'lucide-react';
import { useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { PasswordInput } from '../../components/PasswordInput';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import { fileToBytes, type OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { baseName, formatBytes } from '../../lib/format';
import { openPdf } from '../../lib/pdfjs';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { qpdfTasks } from '../../workers/qpdfClient';
import type { ToolProps } from '../types';

interface Loaded {
  name: string;
  bytes: Uint8Array;
  /** true: pide contraseña para abrirse; false: solo tiene restricciones de propietario */
  needsPassword: boolean;
}

export default function UnlockTool(_: ToolProps) {
  const L = useL();
  const [file, setFile] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [pw, setPw] = useState('');
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();

  const load = async (f: File) => {
    setError(null);
    setLoading(true);
    try {
      const bytes = await fileToBytes(f);
      let needsPassword = false;
      try {
        await (await openPdf(bytes, f.name)).destroy();
      } catch (err) {
        const e = toAppError(err, f.name);
        if (e.code !== 'encrypted') throw e;
        needsPassword = true;
      }
      if (!needsPassword) {
        // Se abre sin contraseña: ¿tiene cifrado de propietario o no tiene nada?
        try {
          await pdfTasks.validate(bytes, f.name);
          throw new AppError('not-encrypted', { fileName: f.name });
        } catch (err) {
          const e = toAppError(err, f.name);
          if (e.code !== 'encrypted') throw e;
        }
      }
      setFile({ name: f.name, bytes, needsPassword });
      setPw('');
    } catch (err) {
      setError(toAppError(err, f.name));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setPw('');
  };

  if (!file) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;

  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={reset}>
        <PdfPreview bytes={result.bytes} maxPages={12} />
      </ResultPanel>
    );
  }

  const run = async () => {
    const out = await task.run(() => qpdfTasks.decrypt(file.bytes, file.needsPassword ? pw : ''));
    if (out) setResult({ name: `${baseName(file.name)}-sin-contraseña.pdf`, bytes: out, type: 'application/pdf' });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!task.running && (!file.needsPassword || pw)) run();
      }}
    >
      <div className="card flex items-center gap-3 p-3">
        <LockOpen className="h-5 w-5 text-brand-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-sm muted">{formatBytes(file.bytes.length)}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={reset}>
          {L('Empezar de nuevo', 'Start over')}
        </button>
      </div>
      {file.needsPassword ? (
        <div className="max-w-sm">
          <PasswordInput id="unlock-pw" label={L('Contraseña del PDF', 'PDF password')} value={pw} onChange={setPw} autoComplete="current-password" autoFocus />
        </div>
      ) : (
        <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-100" role="note">
          {L(
            'Este PDF se abre sin contraseña, pero tiene restricciones (por ejemplo, de impresión o copia). Las quitaremos para que puedas usarlo con normalidad.',
            'This PDF opens without a password but has restrictions (e.g. printing or copying). We will remove them.',
          )}
        </p>
      )}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      <ActionBar>
        {task.running ? (
          <ProgressBar value={0.5} label={L('Quitando la protección…', 'Removing protection…')} />
        ) : (
          <button type="submit" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={file.needsPassword && !pw}>
            {file.needsPassword ? L('Quitar contraseña', 'Remove password') : L('Quitar restricciones', 'Remove restrictions')}
          </button>
        )}
      </ActionBar>
    </form>
  );
}
