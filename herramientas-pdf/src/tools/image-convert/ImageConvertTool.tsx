import { ArrowRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionBar } from '../../components/PdfDropOrError';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { Modal } from '../../components/Modal';
import { OptionGroup } from '../../components/OptionGroup';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useI18n, useL } from '../../i18n/I18nProvider';
import { AppError, toAppError } from '../../lib/errors';
import { formatBytes } from '../../lib/format';
import { ACCEPTED_IMAGE_EXT } from '../../lib/images';
import { useTask } from '../../lib/useTask';
import type { ToolProps } from '../types';
import { convertImage, type Converted, type OutFormat } from './convert';

type Size = '0' | '3000' | '2048' | '1280';
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/avif'];
let seq = 0;

export default function ImageConvertTool({ preset }: ToolProps) {
  const L = useL();
  const { lang } = useI18n();
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [format, setFormat] = useState<OutFormat>((preset?.format as OutFormat) ?? 'jpg');
  const [quality, setQuality] = useState(90);
  const [size, setSize] = useState<Size>('0');
  const [results, setResults] = useState<Converted[] | null>(null);
  const [failures, setFailures] = useState<AppError[]>([]);
  const [rejected, setRejected] = useState<AppError | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const task = useTask();

  useEffect(() => {
    if (!results) return;
    const list = results.map((r) => URL.createObjectURL(new Blob([r.bytes], { type: r.type })));
    setUrls(list);
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, [results]);

  const reset = () => {
    setFiles([]);
    setResults(null);
    setFailures([]);
  };

  if (results) {
    return (
      <div className="space-y-4">
        {failures.map((e, i) => (
          <ErrorMessage key={i} error={e} />
        ))}
        {results.length > 0 ? (
          <ResultPanel files={results} zipName={`imagenes-${format}.zip`} onBack={() => setResults(null)} onReset={reset}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="result-preview">
              {results.map((r, i) => (
                <li key={r.name + i}>
                  <button type="button" className="block w-full text-left" onClick={() => setZoom(i)} aria-label={`${L('Ampliar', 'Enlarge')}: ${r.name}`}>
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                      {urls[i] && <img src={urls[i]} alt="" className="max-h-full max-w-full" />}
                    </div>
                    <span className="mt-1 block truncate text-xs font-medium">{r.name}</span>
                    <span className="block text-xs tabular-nums muted">
                      {formatBytes(r.originalSize, lang)} <ArrowRight className="inline h-3 w-3" aria-hidden="true" /> {formatBytes(r.bytes.length, lang)} · {r.width}×{r.height}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Modal open={zoom != null} onClose={() => setZoom(null)} title={zoom != null ? results[zoom].name : ''}>
              {zoom != null && urls[zoom] && <img src={urls[zoom]} alt={results[zoom].name} className="mx-auto max-w-full p-2" />}
            </Modal>
          </ResultPanel>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setResults(null)}>
            {L('Volver', 'Back')}
          </button>
        )}
      </div>
    );
  }

  const run = async () => {
    const fails: AppError[] = [];
    const out = await task.run(async (onProgress, signal) => {
      const done: Converted[] = [];
      for (let i = 0; i < files.length; i++) {
        if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
        onProgress(i / files.length, files[i].file.name);
        try {
          done.push(await convertImage(files[i].file, { format, quality: quality / 100, maxSide: +size }));
        } catch (err) {
          fails.push(toAppError(err, files[i].file.name));
        }
      }
      return done;
    });
    if (out) {
      setFailures(fails);
      setResults(out);
    }
  };

  return (
    <div className="space-y-5">
      {files.length === 0 ? (
        <FileDropzone
          accept={ACCEPTED_IMAGE_EXT}
          mimeTypes={MIMES}
          multiple
          formatsLabel="HEIC, JPG, PNG, WEBP, GIF, BMP, AVIF"
          onFiles={(f) => setFiles(f.map((file) => ({ id: `i${++seq}`, file })))}
          onRejected={(n) => setRejected(new AppError('unsupported-file', { fileName: n.join(', ') }))}
        />
      ) : (
        <>
          <ul className="space-y-1" data-testid="image-inputs">
            {files.map((f) => (
              <li key={f.id} className="card flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{f.file.name}</span>
                <span className="muted tabular-nums">{formatBytes(f.file.size, lang)}</span>
                <button type="button" className="btn-icon-sm" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} aria-label={`${L('Quitar', 'Remove')}: ${f.file.name}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <FileDropzone compact accept={ACCEPTED_IMAGE_EXT} mimeTypes={MIMES} multiple onFiles={(f) => setFiles((p) => [...p, ...f.map((file) => ({ id: `i${++seq}`, file }))])} />
        </>
      )}
      {rejected && <ErrorMessage error={rejected} onDismiss={() => setRejected(null)} />}

      <OptionGroup<OutFormat>
        label={L('Convertir a', 'Convert to')}
        value={format}
        onChange={setFormat}
        options={[
          { value: 'jpg', label: 'JPG', description: L('El más compatible', 'Most compatible') },
          { value: 'png', label: 'PNG', description: L('Sin pérdida, con transparencia', 'Lossless, transparency') },
          { value: 'webp', label: 'WEBP', description: L('Más ligero (no en Safari)', 'Smaller (not Safari)') },
        ]}
      />
      {format !== 'png' && (
        <div>
          <label htmlFor="q" className="label">
            {L('Calidad', 'Quality')}: <span className="tabular-nums">{quality}%</span>
          </label>
          <input id="q" type="range" min={40} max={100} step={5} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-brand-600" />
        </div>
      )}
      <OptionGroup<Size>
        label={L('Tamaño', 'Size')}
        value={size}
        onChange={setSize}
        columns={4}
        options={[
          { value: '0', label: L('Original', 'Original') },
          { value: '3000', label: '3000 px' },
          { value: '2048', label: '2048 px' },
          { value: '1280', label: '1280 px' },
        ]}
      />
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {files.length > 0 && (
        <ActionBar>
          {task.running ? (
            <ProgressBar value={task.progress} label={task.label} onCancel={task.cancel} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" onClick={run}>
              {L('Convertir {n} imagen(es) a {f}', 'Convert {n} image(s) to {f}', { n: files.length, f: format.toUpperCase() })}
            </button>
          )}
        </ActionBar>
      )}
    </div>
  );
}
