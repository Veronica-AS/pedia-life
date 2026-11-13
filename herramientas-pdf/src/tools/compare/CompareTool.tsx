import { Download, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PageStage } from '../../components/PageStage';
import { ProgressBar } from '../../components/ProgressBar';
import { useL } from '../../i18n/I18nProvider';
import { downloadBlob, fileToBytes, makeZip } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import { openPdf, type PDFDocumentProxy } from '../../lib/pdfjs';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import type { ToolProps } from '../types';
import { diffSequences } from './diff';
import type { Highlight } from './highlight';
import { tokenize, type Token } from './tokens';

interface Side {
  name: string;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
}

interface Change {
  del: Token[];
  ins: Token[];
  before: string;
  pageA: number;
  pageB: number;
}

interface Comparison {
  a: Token[];
  b: Token[];
  changes: Change[];
  added: number;
  removed: number;
}

export default function CompareTool(_: ToolProps) {
  const L = useL();
  const [a, setA] = useState<Side | null>(null);
  const [b, setB] = useState<Side | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [view, setView] = useState<'list' | 'pages'>('list');
  const [pageA, setPageA] = useState(1);
  const [pageB, setPageB] = useState(1);
  const task = useTask();
  const dl = useTask();

  useEffect(() => () => void a?.doc.destroy(), [a]);
  useEffect(() => () => void b?.doc.destroy(), [b]);
  useEffect(() => setCmp(null), [a, b]);

  const load = (set: (s: Side) => void) => async (files: File[]) => {
    setError(null);
    try {
      const f = files[0];
      const bytes = await fileToBytes(f);
      await pdfTasks.validate(bytes, f.name);
      set({ name: f.name, bytes, doc: await openPdf(bytes, f.name) });
    } catch (err) {
      setError(toAppError(err, files[0]?.name));
    }
  };

  const compare = async () => {
    if (!a || !b) return;
    const out = await task.run(async (onProgress, signal) => {
      const ta = await tokenize(a.doc, (f) => onProgress(f * 0.45), signal);
      const tb = await tokenize(b.doc, (f) => onProgress(0.45 + f * 0.45), signal);
      const ops = diffSequences(
        ta.map((t) => t.text),
        tb.map((t) => t.text),
      );
      const changes: Change[] = [];
      let added = 0;
      let removed = 0;
      for (let i = 0; i < ops.length; i++) {
        const o = ops[i];
        if (o.type === 'equal') continue;
        const del = ta.slice(o.aStart, o.aEnd);
        const ins = tb.slice(o.bStart, o.bEnd);
        removed += del.length;
        added += ins.length;
        const last = changes[changes.length - 1];
        // Un borrado seguido de una inserción es un único "cambio"
        if (last && o.type === 'insert' && ops[i - 1]?.type === 'delete') {
          last.ins = ins;
          last.pageB = ins[0]?.page ?? last.pageB;
          continue;
        }
        changes.push({
          del,
          ins,
          before: ta.slice(Math.max(0, o.aStart - 6), o.aStart).map((t) => t.text).join(' '),
          pageA: del[0]?.page ?? ta[Math.max(0, o.aStart - 1)]?.page ?? 1,
          pageB: ins[0]?.page ?? tb[Math.max(0, o.bStart - 1)]?.page ?? 1,
        });
      }
      onProgress(1);
      return { a: ta, b: tb, changes, added, removed };
    });
    if (out) setCmp(out);
  };

  const marks = useMemo(() => {
    const ma: Highlight[] = [];
    const mb: Highlight[] = [];
    for (const c of cmp?.changes ?? []) {
      c.del.forEach((t) => ma.push({ page: t.page, rect: t.rect, color: 'red' }));
      c.ins.forEach((t) => mb.push({ page: t.page, rect: t.rect, color: 'green' }));
    }
    return { a: ma, b: mb };
  }, [cmp]);

  const download = async () => {
    if (!a || !b) return;
    const out = await dl.run(async () => {
      const ha = await pdfTasks.highlight(a.bytes, marks.a);
      const hb = await pdfTasks.highlight(b.bytes, marks.b);
      return makeZip([
        { name: `1-${baseName(a.name)}-marcado.pdf`, bytes: ha, type: 'application/pdf' },
        { name: `2-${baseName(b.name)}-marcado.pdf`, bytes: hb, type: 'application/pdf' },
      ]);
    });
    if (out) downloadBlob(new Blob([out], { type: 'application/zip' }), 'comparacion-pdf.zip');
  };

  const slot = (side: Side | null, set: (s: Side) => void, label: string, testid: string) => (
    <div>
      <p className="label">{label}</p>
      {side ? (
        <div className="card flex items-center gap-2 p-3" data-testid={testid}>
          <FileText className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{side.name}</p>
            <p className="text-xs muted">{L('{n} página(s)', '{n} page(s)', { n: side.doc.numPages })}</p>
          </div>
        </div>
      ) : (
        <div data-testid={testid}>
          <FileDropzone accept={['.pdf']} mimeTypes={['application/pdf']} onFiles={load(set)} listenPaste={false} onRejected={(n) => setError(new AppError('not-pdf', { fileName: n.join(', ') }))} />
        </div>
      )}
    </div>
  );

  const scanned = cmp && (!cmp.a.length || !cmp.b.length);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {slot(a, setA, L('1. Versión original', '1. Original version'), 'slot-a')}
        {slot(b, setB, L('2. Versión nueva', '2. New version'), 'slot-b')}
      </div>
      {(a || b) && (
        <button type="button" className="btn-ghost" onClick={() => (setA(null), setB(null))}>
          {L('Empezar de nuevo', 'Start over')}
        </button>
      )}
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      {task.error && <ErrorMessage error={task.error} />}
      {a && b && !cmp && (task.running ? <ProgressBar value={task.progress} label={L('Comparando texto…', 'Comparing text…')} onCancel={task.cancel} /> : (
        <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" onClick={compare}>
          {L('Comparar', 'Compare')}
        </button>
      ))}

      {scanned && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
          <p className="font-semibold">{L('Uno de los PDF no tiene texto (parece escaneado)', 'One of the PDFs has no text (looks scanned)')}</p>
          <p className="mt-1 text-sm">{L('Pásalo primero por el OCR para poder comparar su texto.', 'Run it through OCR first to compare its text.')}</p>
          <Link to="/ocr-pdf" className="btn-primary mt-3">
            {L('Ir a OCR', 'Go to OCR')}
          </Link>
        </div>
      )}

      {cmp && !scanned && a && b && (
        <section className="space-y-4" aria-labelledby="cmp-title">
          <div className="card p-4">
            <h2 id="cmp-title" className="font-semibold" data-testid="compare-summary">
              {cmp.changes.length === 0
                ? L('Los textos son idénticos', 'The texts are identical')
                : L('{n} cambio(s): {add} palabra(s) añadida(s), {del} eliminada(s)', '{n} change(s): {add} word(s) added, {del} removed', {
                    n: cmp.changes.length,
                    add: cmp.added,
                    del: cmp.removed,
                  })}
            </h2>
            <p className="mt-1 text-sm muted">{L('Se compara solo el texto, no el diseño ni las imágenes.', 'Only text is compared, not layout or images.')}</p>
            {cmp.changes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="flex rounded-xl border border-slate-300 p-1 dark:border-slate-700" role="tablist">
                  {(
                    [
                      ['list', L('Lista de cambios', 'Change list')],
                      ['pages', L('Páginas lado a lado', 'Side-by-side pages')],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`btn min-h-[40px] ${view === v ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950' : ''}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-primary" onClick={download} disabled={dl.running} data-testid="download">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {L('Descargar ambos PDF marcados (ZIP)', 'Download both marked PDFs (ZIP)')}
                </button>
              </div>
            )}
          </div>

          {view === 'list' && cmp.changes.length > 0 && (
            <ol className="space-y-2" data-testid="change-list">
              {cmp.changes.slice(0, 500).map((c, i) => (
                <li key={i} className="card p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs muted">
                    <span>
                      {L('Cambio {n}', 'Change {n}', { n: i + 1 })} · {L('pág. {a} → pág. {b}', 'p. {a} → p. {b}', { a: c.pageA, b: c.pageB })}
                    </span>
                    <button
                      type="button"
                      className="rounded px-2 py-1 font-semibold text-brand-700 hover:underline dark:text-brand-300"
                      onClick={() => {
                        setPageA(c.pageA);
                        setPageB(c.pageB);
                        setView('pages');
                      }}
                    >
                      {L('Ver en la página', 'Show on page')}
                    </button>
                  </div>
                  <p className="leading-relaxed">
                    {c.before && <span className="muted">…{c.before} </span>}
                    {c.del.length > 0 && (
                      <del className="rounded bg-red-100 px-1 text-red-900 dark:bg-red-950/60 dark:text-red-200">
                        <span className="sr-only">{L('Eliminado:', 'Removed:')} </span>
                        {c.del.map((t) => t.text).join(' ')}
                      </del>
                    )}{' '}
                    {c.ins.length > 0 && (
                      <ins className="rounded bg-emerald-100 px-1 text-emerald-900 no-underline dark:bg-emerald-950/60 dark:text-emerald-200">
                        <span className="sr-only">{L('Añadido:', 'Added:')} </span>
                        {c.ins.map((t) => t.text).join(' ')}
                      </ins>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {view === 'pages' && (
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  [a, pageA, setPageA, marks.a, L('Original', 'Original'), 'bg-red-500/30 ring-1 ring-red-500'],
                  [b, pageB, setPageB, marks.b, L('Nueva', 'New'), 'bg-emerald-500/30 ring-1 ring-emerald-500'],
                ] as const
              ).map(([side, pg, setPg, ms, label, cls]) => (
                <div key={label}>
                  <p className="mb-1 font-semibold">{label}</p>
                  <PageStage doc={side.doc} page={pg} onPageChange={setPg}>
                    {ms
                      .filter((m) => m.page === pg)
                      .map((m, i) => (
                        <span
                          key={i}
                          className={`pointer-events-none absolute rounded-sm ${cls}`}
                          style={{ left: `${m.rect.u * 100}%`, top: `${m.rect.v * 100}%`, width: `${m.rect.w * 100}%`, height: `${m.rect.h * 100}%` }}
                          aria-hidden="true"
                        />
                      ))}
                  </PageStage>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {dl.error && <ErrorMessage error={dl.error} onDismiss={() => dl.setError(null)} />}
    </div>
  );
}
