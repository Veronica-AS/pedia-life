import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useI18n, useL } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import type { MetadataEdits, MetadataInfo } from './metadata';

export default function MetadataTool(_: ToolProps) {
  const L = useL();
  const { lang } = useI18n();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [info, setInfo] = useState<MetadataInfo | null>(null);
  const [keep, setKeep] = useState<MetadataEdits>({});
  const [result, setResult] = useState<{ file: OutputFile; info: MetadataInfo } | null>(null);
  const task = useTask();

  useEffect(() => {
    setInfo(null);
    setResult(null);
    setKeep({});
    if (!pdf) return;
    pdfTasks.readMetadata(pdf.bytes).then(setInfo, (e) => setError(toAppError(e, pdf.name)));
  }, [pdf, setError]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;

  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString(lang === 'es' ? 'es' : 'en') : undefined);
  const rows = (m: MetadataInfo): [string, string | undefined][] => [
    [L('Título', 'Title'), m.title],
    [L('Autor', 'Author'), m.author],
    [L('Asunto', 'Subject'), m.subject],
    [L('Palabras clave', 'Keywords'), m.keywords],
    [L('Programa de origen', 'Creator app'), m.creator],
    [L('Generado con', 'Producer'), m.producer],
    [L('Fecha de creación', 'Created'), fmtDate(m.creationDate)],
    [L('Última modificación', 'Modified'), fmtDate(m.modDate)],
    ...m.extra.map((e) => [e.key, e.value] as [string, string]),
    [L('Metadatos XMP (XML oculto)', 'XMP metadata (hidden XML)'), m.hasXmp ? L('Sí', 'Yes') : undefined],
    [L('Páginas con datos de aplicación', 'Pages with app data'), m.pageMetadata ? String(m.pageMetadata) : undefined],
  ];

  const Table = ({ m, caption }: { m: MetadataInfo; caption: string }) => (
    <table className="w-full text-sm" data-testid="metadata-table">
      <caption className="mb-2 text-left font-semibold">{caption}</caption>
      <tbody>
        {rows(m).map(([k, v]) => (
          <tr key={k} className="border-t border-slate-200 dark:border-slate-800">
            <th scope="row" className="w-2/5 py-2 pr-3 text-left font-medium muted">
              {k}
            </th>
            <td className="break-all py-2">
              {v ? (
                <span className="flex items-start gap-1">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  {v}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {L('Vacío', 'Empty')}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (result) {
    return (
      <ResultPanel files={[result.file]} zipName="" onBack={() => setResult(null)} onReset={clear}>
        <Table m={result.info} caption={L('Metadatos del archivo nuevo', 'Metadata of the new file')} />
      </ResultPanel>
    );
  }

  const found = info ? rows(info).filter(([, v]) => v).length : 0;
  const run = async () => {
    const out = await task.run(async () => {
      const bytes = await pdfTasks.cleanMetadata(pdf.bytes, keep);
      return { bytes, info: await pdfTasks.readMetadata(bytes) };
    });
    if (out) setResult({ file: { name: `${baseName(pdf.name)}-sin-metadatos.pdf`, bytes: out.bytes, type: 'application/pdf' }, info: out.info });
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      {!info ? (
        <p className="text-sm muted">{L('Leyendo metadatos…', 'Reading metadata…')}</p>
      ) : (
        <>
          <div className="card p-4">
            <p className="mb-3 text-sm" role="status">
              {found
                ? L('Encontramos {n} dato(s) oculto(s) en este PDF:', 'We found {n} hidden item(s) in this PDF:', { n: found })
                : L('Este PDF no tiene metadatos visibles.', 'This PDF has no visible metadata.')}
            </p>
            <Table m={info} caption={L('Metadatos actuales', 'Current metadata')} />
          </div>
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">{L('Opcional: escribir mis propios datos', 'Optional: write my own values')}</summary>
            <p className="mt-2 text-sm muted">{L('Se borra todo y se guardan solo estos campos.', 'Everything is removed and only these fields are saved.')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['title', L('Título', 'Title')],
                  ['author', L('Autor', 'Author')],
                  ['subject', L('Asunto', 'Subject')],
                  ['keywords', L('Palabras clave', 'Keywords')],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label className="label" htmlFor={`m-${k}`}>
                    {label}
                  </label>
                  <input id={`m-${k}`} className="input" value={keep[k] ?? ''} onChange={(e) => setKeep({ ...keep, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </details>
        </>
      )}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      <ActionBar>
        {task.running ? (
          <ProgressBar value={task.progress} />
        ) : (
          <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!info} onClick={run}>
            {L('Eliminar metadatos', 'Remove metadata')}
          </button>
        )}
      </ActionBar>
    </div>
  );
}
