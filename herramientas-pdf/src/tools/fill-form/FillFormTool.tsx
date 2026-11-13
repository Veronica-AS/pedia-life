import { useEffect, useMemo, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { PdfPreview } from '../../components/PdfPreview';
import { PdfThumb } from '../../components/PdfThumb';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import type { FormFieldInfo, FormInfo, FormValues } from './fillForm';

/** Convierte nombres técnicos ("datos_personales.nombre_completo") en etiquetas legibles */
const pretty = (s: string) => s.replace(/[_.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();

export default function FillFormTool(_: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [form, setForm] = useState<FormInfo | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [flatten, setFlatten] = useState(false);
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();

  useEffect(() => {
    setForm(null);
    setResult(null);
    if (!pdf) return;
    pdfTasks.readForm(pdf.bytes).then(
      (f) => {
        setForm(f);
        setValues(Object.fromEntries(f.fields.map((x) => [x.name, x.value])));
      },
      (e) => setError(toAppError(e, pdf.name)),
    );
  }, [pdf, setError]);

  const byPage = useMemo(() => {
    const m = new Map<number, FormFieldInfo[]>();
    for (const f of form?.fields ?? []) {
      if (f.kind === 'other') continue;
      m.set(f.page, [...(m.get(f.page) ?? []), f]);
    }
    return [...m.entries()];
  }, [form]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;
  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={clear}>
        <PdfPreview bytes={result.bytes} maxPages={20} />
      </ResultPanel>
    );
  }

  const set = (name: string, v: string | boolean | string[]) => setValues((p) => ({ ...p, [name]: v }));
  const field = (f: FormFieldInfo) => {
    const id = `f-${f.name}`;
    const label = (
      <>
        {pretty(f.label)}
        {f.required && <span className="text-red-600"> *</span>}
      </>
    );
    const common = { id, disabled: f.readOnly, 'aria-required': f.required || undefined };
    switch (f.kind) {
      case 'checkbox':
        return (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" {...common} checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
            <span>{label}</span>
          </label>
        );
      case 'radio':
        return (
          <fieldset>
            <legend className="label">{label}</legend>
            <div className="flex flex-wrap gap-x-5">
              {f.options.map((o) => (
                <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-2">
                  <input type="radio" name={id} className="h-5 w-5 accent-brand-600" disabled={f.readOnly} checked={values[f.name] === o} onChange={() => set(f.name, o)} />
                  {pretty(o)}
                </label>
              ))}
            </div>
          </fieldset>
        );
      case 'dropdown':
      case 'list':
        return (
          <div>
            <label className="label" htmlFor={id}>
              {label}
            </label>
            <select
              className="input"
              {...common}
              multiple={f.multiSelect}
              value={f.multiSelect ? (values[f.name] as string[]) : String(Array.isArray(values[f.name]) ? (values[f.name] as string[])[0] ?? '' : values[f.name] ?? '')}
              onChange={(e) => set(f.name, f.multiSelect ? [...e.target.selectedOptions].map((o) => o.value) : e.target.value)}
            >
              {!f.multiSelect && <option value="">{L('— Elegir —', '— Choose —')}</option>}
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        );
      default:
        return (
          <div>
            <label className="label" htmlFor={id}>
              {label}
            </label>
            {f.multiline ? (
              <textarea className="input min-h-[96px]" {...common} maxLength={f.maxLength} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
            ) : (
              <input className="input" {...common} maxLength={f.maxLength} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
            )}
          </div>
        );
    }
  };

  const run = async () => {
    const out = await task.run(() => pdfTasks.fillForm(pdf.bytes, values, flatten));
    if (out) setResult({ name: `${baseName(pdf.name)}-relleno.pdf`, bytes: out, type: 'application/pdf' });
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      {!form ? (
        <p className="text-sm muted">{L('Buscando campos…', 'Looking for fields…')}</p>
      ) : byPage.length === 0 ? (
        <ErrorMessage error={new AppError('no-form-fields', { fileName: pdf.name })} />
      ) : (
        <>
          {form.hasXfa && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="note">
              {L(
                'Este formulario usa la tecnología XFA de Adobe. Rellenaremos su versión estándar, que se ve en cualquier lector; revisa la vista previa al terminar.',
                'This form uses Adobe XFA. We will fill its standard version; check the preview when done.',
              )}
            </p>
          )}
          {byPage.map(([page, fields]) => (
            <section key={page} className="card grid gap-4 p-4 md:grid-cols-[140px_1fr]" aria-label={L('Página {n}', 'Page {n}', { n: page || '?' })}>
              {page > 0 && (
                <div className="hidden md:block">
                  <PdfThumb doc={pdf.doc} pageNumber={page} alt="" width={140} className="aspect-[3/4]" />
                  <p className="mt-1 text-center text-xs muted">{L('Página {n}', 'Page {n}', { n: page })}</p>
                </div>
              )}
              <div className="space-y-3">
                <h2 className="font-semibold md:hidden">{L('Página {n}', 'Page {n}', { n: page || '?' })}</h2>
                {fields.map((f) => (
                  <div key={f.name}>{field(f)}</div>
                ))}
              </div>
            </section>
          ))}
          <label className="card flex min-h-[44px] cursor-pointer items-start gap-3 p-4">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            <span>
              <span className="font-semibold">{L('Fijar las respuestas', 'Lock the answers')}</span>
              <span className="block text-sm muted">{L('Los campos se convierten en texto normal y ya no se pueden cambiar.', 'Fields become plain text and can no longer be changed.')}</span>
            </span>
          </label>
        </>
      )}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {byPage.length > 0 && (
        <ActionBar>
          {task.running ? (
            <ProgressBar value={0.5} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" onClick={run}>
              {L('Guardar formulario', 'Save form')}
            </button>
          )}
        </ActionBar>
      )}
    </div>
  );
}
