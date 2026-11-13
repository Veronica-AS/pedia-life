import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { PasswordInput, passwordStrength } from '../../components/PasswordInput';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { baseName } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { qpdfTasks } from '../../workers/qpdfClient';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';

export default function ProtectTool(_: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [perms, setPerms] = useState({ allowPrint: true, allowCopy: true, allowModify: false });
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();
  useEffect(() => setResult(null), [pdf]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;

  if (result) {
    return (
      <ResultPanel
        files={[result]}
        zipName=""
        onBack={() => setResult(null)}
        onReset={clear}
        note={
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="note">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            {L('Guarda la contraseña en un lugar seguro: si la olvidas, no hay forma de recuperarla.', 'Keep the password somewhere safe: if you forget it, there is no way to recover it.')}
          </p>
        }
      >
        <p className="mb-3 text-sm muted">{L('Comprobamos que el archivo se abre con tu contraseña:', 'We checked that the file opens with your password:')}</p>
        <PdfPreview bytes={result.bytes} password={pw} maxPages={12} />
      </ResultPanel>
    );
  }

  const strength = passwordStrength(pw);
  const strengthText = [
    '',
    L('Débil: usa al menos 8 caracteres', 'Weak: use at least 8 characters'),
    L('Aceptable', 'Fair'),
    L('Fuerte', 'Strong'),
  ][strength];
  const mismatch = pw2.length > 0 && pw !== pw2;
  const run = async () => {
    const out = await task.run(() => qpdfTasks.encrypt(pdf.bytes, { userPassword: pw, ...perms }));
    if (out) setResult({ name: `${baseName(pdf.name)}-protegido.pdf`, bytes: out, type: 'application/pdf' });
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PasswordInput id="pw" label={L('Contraseña', 'Password')} value={pw} onChange={setPw} describedBy="pw-strength" />
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded ${strength >= i ? ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'][strength] : 'bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>
          <p id="pw-strength" className="mt-1 text-xs muted" aria-live="polite">
            {strengthText}
          </p>
        </div>
        <div>
          <PasswordInput id="pw2" label={L('Repite la contraseña', 'Repeat password')} value={pw2} onChange={setPw2} describedBy="pw2-hint" />
          <p id="pw2-hint" className={`mt-1 text-xs ${mismatch ? 'text-red-700 dark:text-red-400' : 'muted'}`} aria-live="polite">
            {mismatch ? L('Las contraseñas no coinciden', 'Passwords do not match') : ''}
          </p>
        </div>
      </div>
      <fieldset className="card p-4">
        <legend className="px-1 font-semibold">{L('Permisos al abrirlo con la contraseña', 'Permissions when opened with the password')}</legend>
        {(
          [
            ['allowPrint', L('Permitir imprimir', 'Allow printing')],
            ['allowCopy', L('Permitir copiar texto e imágenes', 'Allow copying text and images')],
            ['allowModify', L('Permitir modificar', 'Allow editing')],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
        <p className="mt-1 text-xs muted">{L('Algunos lectores de PDF no respetan estos permisos; la contraseña de apertura sí es obligatoria en todos.', 'Some PDF readers ignore these permissions; the open password is enforced by all of them.')}</p>
      </fieldset>
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      <ActionBar>
        {task.running ? (
          <ProgressBar value={0.5} label={L('Cifrando con AES-256…', 'Encrypting with AES-256…')} />
        ) : (
          <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!pw || pw !== pw2} onClick={run}>
            {L('Proteger PDF', 'Protect PDF')}
          </button>
        )}
      </ActionBar>
    </div>
  );
}
