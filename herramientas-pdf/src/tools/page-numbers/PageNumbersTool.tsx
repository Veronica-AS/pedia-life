import { useEffect, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { OptionGroup } from '../../components/OptionGroup';
import { PdfPreview } from '../../components/PdfPreview';
import { PdfThumb } from '../../components/PdfThumb';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { baseName } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks, pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { DEFAULT_PAGE_NUMBERS, fillTemplate, formatNumber, type Align, type NumberFormat, type PageNumberOptions, type Position } from './format';

const POSITIONS: Position[] = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];

export default function PageNumbersTool({ preset }: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [o, setO] = useState<PageNumberOptions>(() =>
    preset?.focus === 'header' ? { ...DEFAULT_PAGE_NUMBERS, format: 'none', header: '', footer: 'Página {n} de {total}', footerAlign: 'right' } : DEFAULT_PAGE_NUMBERS,
  );
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();
  useEffect(() => setResult(null), [pdf]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;
  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={clear}>
        <PdfPreview bytes={result.bytes} maxPages={40} />
      </ResultPanel>
    );
  }

  const set = <K extends keyof PageNumberOptions>(k: K, v: PageNumberOptions[K]) => setO((p) => ({ ...p, [k]: v }));
  const total = pdf.pages - o.fromPage + o.start;
  const sample = formatNumber(o.format, o.start, total);
  const nothing = o.format === 'none' && !o.header.trim() && !o.footer.trim();
  const posLabel: Record<Position, string> = {
    tl: L('Arriba izquierda', 'Top left'),
    tc: L('Arriba centro', 'Top center'),
    tr: L('Arriba derecha', 'Top right'),
    bl: L('Abajo izquierda', 'Bottom left'),
    bc: L('Abajo centro', 'Bottom center'),
    br: L('Abajo derecha', 'Bottom right'),
  };
  const alignOpts: { value: Align; label: string }[] = [
    { value: 'left', label: L('Izquierda', 'Left') },
    { value: 'center', label: L('Centro', 'Center') },
    { value: 'right', label: L('Derecha', 'Right') },
  ];
  const textAlign = (a: Align) => (a === 'left' ? 'text-left' : a === 'right' ? 'text-right' : 'text-center');

  const apply = async () => {
    const out = await task.run((onProgress) => pdfTasks.pageNumbers(pdf.bytes, o, onProgress), { onCancel: cancelWorkerTasks });
    if (out) setResult({ name: `${baseName(pdf.name)}-numerado.pdf`, bytes: out, type: 'application/pdf' });
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-5">
          <OptionGroup<NumberFormat>
            label={L('Formato del número', 'Number format')}
            value={o.format}
            onChange={(v) => set('format', v)}
            options={[
              { value: 'n', label: '1, 2, 3' },
              { value: 'page-n', label: L('Página 1', 'Page 1') },
              { value: 'n-of-total', label: '1 / 10' },
              { value: 'page-n-of-total', label: L('Página 1 de 10', 'Page 1 of 10') },
              { value: 'none', label: L('Sin número', 'No number') },
            ]}
          />
          {o.format !== 'none' && (
            <fieldset>
              <legend className="label">{L('Posición', 'Position')}</legend>
              <div className="grid max-w-xs grid-cols-3 gap-2">
                {POSITIONS.map((p) => (
                  <label
                    key={p}
                    title={posLabel[p]}
                    className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${o.position === p ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/50' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    <input type="radio" name="pos" className="sr-only" checked={o.position === p} onChange={() => set('position', p)} aria-label={posLabel[p]} />
                    <span className={`h-1.5 w-6 rounded ${o.position === p ? 'bg-brand-600 dark:bg-brand-400' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="from">
                {L('Empezar en la página', 'Start at page')}
              </label>
              <input id="from" type="number" min={1} max={pdf.pages} className="input" value={o.fromPage} onChange={(e) => set('fromPage', Math.max(1, Math.min(pdf.pages, +e.target.value || 1)))} />
            </div>
            <div>
              <label className="label" htmlFor="start">
                {L('Primer número', 'First number')}
              </label>
              <input id="start" type="number" min={0} className="input" value={o.start} onChange={(e) => set('start', Math.max(0, +e.target.value || 0))} />
            </div>
            <div>
              <label className="label" htmlFor="size">
                {L('Tamaño de letra', 'Font size')}
              </label>
              <input id="size" type="number" min={6} max={36} className="input" value={o.fontSize} onChange={(e) => set('fontSize', Math.max(6, Math.min(36, +e.target.value || 11)))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['header', 'footer'] as const).map((k) => (
              <div key={k}>
                <label className="label" htmlFor={k}>
                  {k === 'header' ? L('Encabezado (opcional)', 'Header (optional)') : L('Pie de página (opcional)', 'Footer (optional)')}
                </label>
                <input id={k} className="input" value={o[k]} placeholder={k === 'header' ? L('Ej.: Confidencial', 'e.g. Confidential') : L('Ej.: Mi empresa · {fecha}', 'e.g. My company · {fecha}')} onChange={(e) => set(k, e.target.value)} />
                <div className="mt-2">
                  <OptionGroup<Align> label={L('Alineación', 'Alignment')} value={o[k === 'header' ? 'headerAlign' : 'footerAlign']} onChange={(v) => set(k === 'header' ? 'headerAlign' : 'footerAlign', v)} options={alignOpts} columns={3} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs muted">{L('Puedes usar {n} (número de página), {total} y {fecha}.', 'You can use {n} (page number), {total} and {fecha} (date).')}</p>
        </div>

        {/* Vista previa en vivo sobre la primera página numerada */}
        <div>
          <p className="label">{L('Vista previa', 'Preview')}</p>
          <div className="relative overflow-hidden rounded-lg">
            <PdfThumb doc={pdf.doc} pageNumber={o.fromPage} alt="" width={220} className="aspect-[3/4]" />
            <div className="pointer-events-none absolute inset-x-[12%] inset-y-[3%] flex flex-col justify-between text-[9px] font-medium text-slate-900">
              <div className="relative">
                {o.header && <p className={`rounded bg-amber-200/90 px-1 ${textAlign(o.headerAlign)}`}>{fillTemplate(o.header, o.start, total)}</p>}
                {o.format !== 'none' && o.position[0] === 't' && <p className={`rounded bg-brand-200/90 px-1 ${textAlign(o.position[1] === 'l' ? 'left' : o.position[1] === 'r' ? 'right' : 'center')}`}>{sample}</p>}
              </div>
              <div>
                {o.format !== 'none' && o.position[0] === 'b' && <p className={`rounded bg-brand-200/90 px-1 ${textAlign(o.position[1] === 'l' ? 'left' : o.position[1] === 'r' ? 'right' : 'center')}`}>{sample}</p>}
                {o.footer && <p className={`rounded bg-amber-200/90 px-1 ${textAlign(o.footerAlign)}`}>{fillTemplate(o.footer, o.start, total)}</p>}
              </div>
            </div>
          </div>
          <p className="mt-1 text-center text-xs muted">{L('Página {n}', 'Page {n}', { n: o.fromPage })}</p>
        </div>
      </div>

      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      <ActionBar>
        {task.running ? (
          <ProgressBar value={task.progress} onCancel={task.cancel} />
        ) : (
          <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={nothing} onClick={apply}>
            {L('Aplicar a {n} páginas', 'Apply to {n} pages', { n: pdf.pages - o.fromPage + 1 })}
          </button>
        )}
      </ActionBar>
    </div>
  );
}
