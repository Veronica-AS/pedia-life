import { Copy, Download, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PdfDrop } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { OptionGroup } from '../../components/OptionGroup';
import { ProgressBar } from '../../components/ProgressBar';
import { useL } from '../../i18n/I18nProvider';
import { downloadBlob } from '../../lib/download';
import { baseName, formatBytes } from '../../lib/format';
import { bodyFontSize, extractDocument, looksScanned, pagesToPlainText, toParagraphs, type Paragraph, type TextPage } from '../../lib/textExtract';
import { useTask } from '../../lib/useTask';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { paragraphsToDocx } from './toDocx';

type Format = 'txt' | 'docx';

export default function PdfToTextTool({ preset }: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [format, setFormat] = useState<Format>(preset?.format === 'txt' ? 'txt' : 'docx');
  const [pages, setPages] = useState<TextPage[] | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const task = useTask();
  const build = useTask();

  useEffect(() => {
    setPages(null);
    if (!pdf) return;
    task.run(async (onProgress, signal) => {
      const res = await extractDocument(pdf.doc, { styles: true, onProgress, signal });
      setPages(res);
      setText(pagesToPlainText(res));
      return res;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  const paragraphs = useMemo<Paragraph[][]>(() => {
    if (!pages) return [];
    const body = bodyFontSize(pages);
    return pages.map((p) => toParagraphs(p, body));
  }, [pages]);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;

  const base = baseName(pdf.name);
  const scanned = pages && looksScanned(pages);

  const download = async () => {
    if (format === 'txt') {
      // BOM para que el Bloc de notas de Windows muestre bien los acentos
      downloadBlob(new Blob(['﻿', text.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      return;
    }
    const bytes = await build.run(() => paragraphsToDocx(paragraphs, base));
    if (bytes) downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${base}.docx`);
  };

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />
      <OptionGroup<Format>
        label={L('Formato de salida', 'Output format')}
        value={format}
        columns={2}
        onChange={setFormat}
        options={[
          { value: 'docx', label: L('Word (.docx)', 'Word (.docx)'), description: L('Títulos, párrafos y negritas', 'Headings, paragraphs, bold') },
          { value: 'txt', label: L('Texto plano (.txt)', 'Plain text (.txt)'), description: L('Solo el texto, editable aquí', 'Text only, editable here') },
        ]}
      />
      {format === 'docx' && (
        <p className="flex gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-100" role="note">
          <Info className="h-5 w-5 shrink-0" aria-hidden="true" />
          {L(
            'Aviso honesto: se conservan el texto, los párrafos, los títulos y las negritas. Las columnas, tablas complejas, imágenes y posiciones exactas pueden perderse. Revisa la vista previa antes de descargar.',
            'Honest notice: text, paragraphs, headings and bold are kept. Columns, complex tables, images and exact positions may be lost. Check the preview before downloading.',
          )}
        </p>
      )}

      {task.running && <ProgressBar value={task.progress} label={L('Leyendo el texto…', 'Reading text…')} onCancel={task.cancel} />}
      {task.error && <ErrorMessage error={task.error} />}

      {scanned && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
          <p className="font-semibold">{L('Este PDF parece escaneado: casi no tiene texto', 'This PDF looks scanned: it has almost no text')}</p>
          <p className="mt-1 text-sm">{L('El texto está dentro de imágenes. Usa primero el OCR para reconocerlo.', 'The text is inside images. Use OCR first to recognize it.')}</p>
          <Link to="/ocr-pdf" className="btn-primary mt-3">
            {L('Ir a OCR', 'Go to OCR')}
          </Link>
        </div>
      )}

      {pages && !scanned && (
        <section className="card p-4" aria-labelledby="preview-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="preview-title" className="font-semibold">
              {L('Vista previa', 'Preview')}
            </h2>
            {format === 'txt' && (
              <button
                type="button"
                className="btn-ghost"
                onClick={async () => {
                  await navigator.clipboard?.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? L('¡Copiado!', 'Copied!') : L('Copiar todo', 'Copy all')}
              </button>
            )}
          </div>
          {format === 'txt' ? (
            <>
              <label htmlFor="txt" className="sr-only">
                {L('Texto extraído (editable)', 'Extracted text (editable)')}
              </label>
              <textarea id="txt" className="input h-96 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} data-testid="text-preview" />
              <p className="mt-1 text-xs muted">
                {L('{n} caracteres · puedes corregir el texto antes de descargarlo', '{n} characters · you can edit before downloading', { n: text.length.toLocaleString() })}
              </p>
            </>
          ) : (
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-inner dark:border-slate-700" data-testid="docx-preview" lang="">
              {paragraphs.map((page, pi) => (
                <div key={pi}>
                  {pi > 0 && <hr className="my-6 border-dashed border-slate-300" aria-label={L('Salto de página', 'Page break')} />}
                  {page.map((p, i) => {
                    const style = { marginLeft: p.indent > 8 && !p.heading ? Math.min(p.indent, 144) * 0.6 : 0 };
                    if (p.heading === 1) return <h3 key={i} className="mb-2 text-xl font-bold">{p.text}</h3>;
                    if (p.heading === 2) return <h4 key={i} className="mb-2 text-lg font-bold">{p.text}</h4>;
                    return (
                      <p key={i} className={`mb-2 whitespace-pre-wrap ${p.bold ? 'font-bold' : ''} ${p.italic ? 'italic' : ''}`} style={style}>
                        {p.text}
                      </p>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {build.error && <ErrorMessage error={build.error} onDismiss={() => build.setError(null)} />}
      {pages && !scanned && (
        <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" onClick={download} disabled={build.running} data-testid="download">
          <Download className="h-5 w-5" aria-hidden="true" />
          {format === 'txt' ? L('Descargar .txt · {size}', 'Download .txt · {size}', { size: formatBytes(new Blob([text]).size) }) : L('Descargar Word (.docx)', 'Download Word (.docx)')}
        </button>
      )}
    </div>
  );
}
