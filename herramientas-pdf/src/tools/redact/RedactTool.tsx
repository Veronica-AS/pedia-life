import { CheckCircle2, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { BoxOverlay } from '../../components/BoxOverlay';
import { ErrorMessage } from '../../components/ErrorMessage';
import { OptionGroup } from '../../components/OptionGroup';
import { PageStage } from '../../components/PageStage';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import { fileToBytes, type OutputFile } from '../../lib/download';
import { baseName } from '../../lib/format';
import type { VisualRect } from '../../lib/geometry';
import { canvasToBlob, openPdf, releaseCanvas, renderPage } from '../../lib/pdfjs';
import { extractDocument } from '../../lib/textExtract';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import { createOcrEngine } from '../ocr/ocrEngine';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import type { RedactedPage } from './redact';
import { fold, PRESETS, searchPage, textQuery, type PresetId } from './search';

interface Box {
  id: string;
  page: number;
  rect: VisualRect;
  source: 'manual' | 'search';
}

interface Verification {
  /** Términos buscados que siguen apareciendo en el archivo final (debería estar vacío) */
  leaked: string[];
  /** Páginas redactadas que aún contienen texto (solo posible con OCR) */
  pagesWithText: number[];
  checkedTerms: number;
}

type Dpi = '150' | '200' | '300';
let seq = 0;

export default function RedactTool(_: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<string[]>([]);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [dpi, setDpi] = useState<Dpi>('200');
  const [ocr, setOcr] = useState(false);
  const [result, setResult] = useState<{ file: OutputFile; check: Verification } | null>(null);
  const drawing = useRef<{ id: string; u: number; v: number } | null>(null);
  const search = useTask();
  const task = useTask();

  useEffect(() => {
    setBoxes([]);
    setFound([]);
    setPage(1);
    setResult(null);
    setSearchInfo(null);
  }, [pdf]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;

  if (result) {
    const ok = !result.check.leaked.length && !result.check.pagesWithText.length;
    return (
      <ResultPanel
        files={[result.file]}
        zipName=""
        onBack={() => setResult(null)}
        onReset={clear}
        note={
          <div className={`flex gap-2 rounded-xl p-3 text-sm ${ok ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100'}`} role="status" data-testid="verification">
            {ok ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />}
            <div>
              {ok ? (
                <>
                  <p className="font-semibold">{L('Verificado: el texto oculto ya no existe en el archivo', 'Verified: the hidden text no longer exists in the file')}</p>
                  <p>
                    {result.check.checkedTerms
                      ? L('Buscamos de nuevo {n} dato(s) en el PDF final y no aparece ninguno.', 'We searched for {n} item(s) again in the final PDF and none appear.', { n: result.check.checkedTerms })
                      : L('Las páginas con zonas ocultas se rehicieron como imagen: su texto original se eliminó.', 'Pages with hidden areas were rebuilt as images: their original text was removed.')}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{L('Atención: aún aparece texto que querías ocultar', 'Warning: some text you wanted to hide still appears')}</p>
                  <p>{result.check.leaked.join(', ')}</p>
                  <p>{L('Puede estar en una página donde no lo marcaste. Vuelve a editar y búscalo de nuevo.', 'It may be on a page where you did not mark it. Go back and search again.')}</p>
                </>
              )}
            </div>
          </div>
        }
      >
        <PdfPreview bytes={result.file.bytes} maxPages={40} />
      </ResultPanel>
    );
  }

  const runSearch = async (pattern: RegExp, label: string) => {
    await search.run(async (onProgress, signal) => {
      const added: Box[] = [];
      const texts = new Set<string>();
      for (let p = 1; p <= pdf.pages; p++) {
        if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        onProgress((p - 1) / pdf.pages);
        const r = await searchPage(pdf.doc, p, pattern);
        r.rects.forEach((rect) => added.push({ id: `b${++seq}`, page: p, rect, source: 'search' }));
        r.texts.forEach((t) => texts.add(t.trim()));
      }
      setBoxes((prev) => [...prev, ...added]);
      setFound((prev) => [...new Set([...prev, ...texts])]);
      setSearchInfo(
        added.length
          ? L('"{q}": {n} coincidencia(s) marcadas en rojo.', '"{q}": {n} match(es) marked in red.', { q: label, n: added.length })
          : L('"{q}": no se encontró en el texto del PDF.', '"{q}": not found in the PDF text.', { q: label }),
      );
      const first = added[0];
      if (first) setPage(first.page);
      return added.length;
    });
  };

  const presets: { id: PresetId; label: string }[] = [
    { id: 'email', label: L('Correos', 'Emails') },
    { id: 'phone', label: L('Teléfonos', 'Phones') },
    { id: 'id', label: L('Números de identificación', 'ID numbers') },
  ];

  const apply = async () => {
    const pagesWithBoxes = [...new Set(boxes.map((b) => b.page))].sort((a, b) => a - b);
    const out = await task.run(async (onProgress, signal) => {
      const engine = ocr ? await createOcrEngine('spa') : null;
      const replaced: RedactedPage[] = [];
      try {
        for (let k = 0; k < pagesWithBoxes.length; k++) {
          if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
          onProgress((k / pagesWithBoxes.length) * 0.85);
          const p = pagesWithBoxes[k];
          const pg = await pdf.doc.getPage(p);
          const { canvas } = await renderPage(pg, +dpi / 72);
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#000';
          for (const b of boxes.filter((x) => x.page === p)) {
            // 1 px extra por lado para no dejar bordes de letras sin cubrir
            ctx.fillRect(Math.floor(b.rect.u * canvas.width) - 1, Math.floor(b.rect.v * canvas.height) - 1, Math.ceil(b.rect.w * canvas.width) + 2, Math.ceil(b.rect.h * canvas.height) + 2);
          }
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
          const lines = engine ? (await engine.recognize(blob, canvas.width, canvas.height)).lines : null;
          releaseCanvas(canvas);
          pg.cleanup();
          replaced.push({ index: p - 1, jpg: await fileToBytes(blob), ocr: lines ? { lines } : null });
        }
      } finally {
        await engine?.terminate();
      }
      const bytes = await pdfTasks.redact(pdf.bytes, replaced, (f) => onProgress(0.85 + f * 0.1));

      // Verificación: se vuelve a leer el PDF final y se buscan los datos ocultados
      const check = await openPdf(bytes);
      const text = await extractDocument(check);
      await check.destroy();
      const all = fold(text.map((t) => t.lines.map((l) => l.text).join(' ')).join(' '));
      const leaked = found.filter((f) => f.length >= 3 && all.includes(fold(f)));
      const pagesWithText = ocr ? [] : pagesWithBoxes.filter((p) => text[p - 1]?.lines.length);
      onProgress(1);
      return { bytes, check: { leaked, pagesWithText, checkedTerms: found.length } };
    });
    if (out) setResult({ file: { name: `${baseName(pdf.name)}-redactado.pdf`, bytes: out.bytes, type: 'application/pdf' }, check: out.check });
  };

  const onPage = boxes.filter((b) => b.page === page);
  const pagesCount = new Set(boxes.map((b) => b.page)).size;

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />

      <section className="card p-4" aria-labelledby="search-title">
        <h2 id="search-title" className="mb-2 font-semibold">
          {L('Buscar y ocultar', 'Find and hide')}
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const re = textQuery(query);
            if (re) runSearch(re, query.trim());
          }}
        >
          <label htmlFor="redact-q" className="sr-only">
            {L('Texto a ocultar', 'Text to hide')}
          </label>
          <input id="redact-q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Ej.: un nombre, una cuenta, una dirección…', 'e.g. a name, an account, an address…')} />
          <button type="submit" className="btn-primary" disabled={!query.trim() || search.running} aria-label={L('Buscar', 'Search')}>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{L('Buscar', 'Search')}</span>
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.id} type="button" className="btn-secondary min-h-[40px] rounded-full py-1" disabled={search.running} onClick={() => runSearch(PRESETS[p.id], p.label)}>
              + {p.label}
            </button>
          ))}
        </div>
        {search.running && (
          <div className="mt-3">
            <ProgressBar value={search.progress} label={L('Buscando en todas las páginas…', 'Searching all pages…')} />
          </div>
        )}
        {searchInfo && (
          <p className="mt-3 text-sm" role="status">
            {searchInfo}
          </p>
        )}
      </section>

      <section className="card p-4" aria-labelledby="mark-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="mark-title" className="font-semibold">
            {L('Marca zonas a mano', 'Mark areas by hand')}
          </h2>
          {boxes.length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => (setBoxes([]), setFound([]), setSearchInfo(null))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {L('Quitar todas', 'Remove all')}
            </button>
          )}
        </div>
        <p className="mb-3 text-sm muted">{L('Arrastra sobre la página para dibujar un rectángulo. Muévelo o cambia su tamaño si hace falta.', 'Drag on the page to draw a rectangle. Move or resize it as needed.')}</p>
        <PageStage
          doc={pdf.doc}
          page={page}
          onPageChange={setPage}
          stageLabel={L('Página {n}: arrastra para marcar una zona', 'Page {n}: drag to mark an area', { n: page })}
          onStagePointerDown={(u, v, e) => {
            const stage = e.currentTarget;
            const r = stage.getBoundingClientRect();
            const id = `b${++seq}`;
            drawing.current = { id, u, v };
            setBoxes((prev) => [...prev, { id, page, rect: { u, v, w: 0, h: 0 }, source: 'manual' }]);
            const move = (ev: PointerEvent) => {
              const d = drawing.current;
              if (!d) return;
              const cu = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
              const cv = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
              const rect = { u: Math.min(d.u, cu), v: Math.min(d.v, cv), w: Math.abs(cu - d.u), h: Math.abs(cv - d.v) };
              setBoxes((prev) => prev.map((b) => (b.id === d.id ? { ...b, rect } : b)));
            };
            const up = () => {
              const d = drawing.current;
              drawing.current = null;
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              // Un toque sin arrastrar no crea zona
              if (d) setBoxes((prev) => prev.filter((b) => b.id !== d.id || (b.rect.w > 0.01 && b.rect.h > 0.005)));
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        >
          {onPage.map((b, i) => (
            <BoxOverlay
              key={b.id}
              rect={b.rect}
              label={L('Zona oculta {n}', 'Hidden area {n}', { n: i + 1 })}
              className="border-2 border-red-600 bg-black/70"
              onChange={(rect) => setBoxes((prev) => prev.map((x) => (x.id === b.id ? { ...x, rect } : x)))}
              onRemove={() => setBoxes((prev) => prev.filter((x) => x.id !== b.id))}
            />
          ))}
        </PageStage>
        <p className="mt-2 text-sm muted" aria-live="polite" data-testid="redact-count">
          {L('{n} zona(s) en {p} página(s)', '{n} area(s) on {p} page(s)', { n: boxes.length, p: pagesCount })}
        </p>
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">{L('Opciones', 'Options')}</summary>
        <div className="mt-3 space-y-4">
          <OptionGroup<Dpi>
            label={L('Calidad de las páginas con zonas ocultas', 'Quality of pages with hidden areas')}
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '150', label: L('Normal', 'Normal'), description: '150 ppp' },
              { value: '200', label: L('Alta', 'High'), description: '200 ppp' },
              { value: '300', label: L('Impresión', 'Print'), description: '300 ppp' },
            ]}
          />
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={ocr} onChange={(e) => setOcr(e.target.checked)} />
            <span>
              {L('Mantener buscable el resto del texto de esas páginas (OCR)', 'Keep the rest of those pages searchable (OCR)')}
              <span className="block text-sm muted">{L('Más lento. Lo tapado no se reconoce porque ya está en negro.', 'Slower. Hidden content is not recognized because it is already black.')}</span>
            </span>
          </label>
        </div>
      </details>

      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-100" role="note">
        {L(
          'Cómo funciona: las páginas con zonas ocultas se convierten en imagen con las zonas ya en negro, así el texto original desaparece del archivo. El documento final no conserva metadatos, marcadores ni adjuntos.',
          'How it works: pages with hidden areas become images with the areas already blacked out, so the original text is gone. The final file keeps no metadata, bookmarks or attachments.',
        )}
      </p>

      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      <ActionBar>
        {task.running ? (
          <ProgressBar value={task.progress} onCancel={task.cancel} />
        ) : (
          <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!boxes.length} onClick={apply}>
            {L('Ocultar {n} zona(s) definitivamente', 'Permanently hide {n} area(s)', { n: boxes.length })}
          </button>
        )}
      </ActionBar>
    </div>
  );
}
