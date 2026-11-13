import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { OptionGroup } from '../../components/OptionGroup';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { SortableItem, SortableList } from '../../components/Sortable';
import { useI18n } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { ACCEPTED_IMAGE_EXT, prepareImage } from '../../lib/images';
import { useTask } from '../../lib/useTask';
import { cancelWorkerTasks, pdfTasks } from '../../workers/client';
import type { ToolProps } from '../types';
import type { PreparedImage } from './imagesToPdf';
import { defaultPageSize, layoutImage, type LayoutOptions, type MarginId, type OrientationId, type PageSizeId } from './layout';

interface Item {
  id: string;
  name: string;
  previewUrl: string;
  image: PreparedImage;
}

const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/avif'];
let seq = 0;

export default function ImagesToPdfTool(_: ToolProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [opts, setOpts] = useState<LayoutOptions>(() => ({
    pageSize: defaultPageSize(typeof navigator !== 'undefined' ? navigator.language : 'es'),
    orientation: 'auto',
    margin: 'small',
  }));
  const [result, setResult] = useState<OutputFile | null>(null);
  const task = useTask();
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = async (files: File[]) => {
    setErrors([]);
    const errs: AppError[] = [];
    setPreparing({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        const { image, previewUrl } = await prepareImage(files[i]);
        urls.current.push(previewUrl);
        setItems((prev) => [...prev, { id: `i${++seq}`, name: files[i].name, previewUrl, image }]);
      } catch (err) {
        errs.push(toAppError(err, files[i].name));
      }
      setPreparing({ done: i + 1, total: files.length });
    }
    setPreparing(null);
    setErrors(errs);
  };

  const reset = () => {
    setItems([]);
    setResult(null);
    setErrors([]);
  };

  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={reset}>
        <PdfPreview bytes={result.bytes} />
      </ResultPanel>
    );
  }

  const create = async () => {
    const out = await task.run((onProgress) => pdfTasks.imagesToPdf(items.map((i) => i.image), opts, onProgress), { onCancel: cancelWorkerTasks });
    if (out) setResult({ name: items.length === 1 ? `${items[0].name.replace(/\.[^.]+$/, '')}.pdf` : 'imagenes.pdf', bytes: out, type: 'application/pdf' });
  };

  const rejected = (names: string[]) => setErrors([new AppError('unsupported-file', { fileName: names.join(', ') })]);
  const formats = 'JPG, PNG, HEIC, WEBP, GIF, BMP';

  return (
    <div className="space-y-5">
      {items.length === 0 && !preparing ? (
        <>
          <FileDropzone accept={ACCEPTED_IMAGE_EXT} mimeTypes={MIME} multiple onFiles={addFiles} onRejected={rejected} formatsLabel={formats} />
          <p className="text-xs muted">{t('heicNote')}</p>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <OptionGroup<PageSizeId>
              label={t('pageSize')}
              value={opts.pageSize}
              columns={1}
              onChange={(v) => setOpts({ ...opts, pageSize: v })}
              options={[
                { value: 'a4', label: t('sizeA4') },
                { value: 'letter', label: t('sizeLetter') },
                { value: 'fit', label: t('sizeFit') },
              ]}
            />
            {opts.pageSize !== 'fit' && (
              <OptionGroup<OrientationId>
                label={t('orientation')}
                value={opts.orientation}
                columns={1}
                onChange={(v) => setOpts({ ...opts, orientation: v })}
                options={[
                  { value: 'auto', label: t('orientAuto') },
                  { value: 'portrait', label: t('orientPortrait') },
                  { value: 'landscape', label: t('orientLandscape') },
                ]}
              />
            )}
            <OptionGroup<MarginId>
              label={t('margin')}
              value={opts.margin}
              columns={1}
              onChange={(v) => setOpts({ ...opts, margin: v })}
              options={[
                { value: 'none', label: t('marginNone') },
                { value: 'small', label: t('marginSmall') },
                { value: 'large', label: t('marginLarge') },
              ]}
            />
          </div>

          <div>
            <p className="label">{t('previewTitle')}</p>
            <SortableList items={items} onReorder={setItems} className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5" describe={(it) => it.name}>
              {items.map((it, i) => {
                const l = layoutImage(it.image.width, it.image.height, opts);
                return (
                  <SortableItem key={it.id} id={it.id} handleLabel={it.name} className="card p-2">
                    {(handle) => (
                      <>
                        <div className="mb-1 flex items-center justify-between gap-1">
                          {handle}
                          <span className="text-xs font-semibold tabular-nums">{i + 1}</span>
                          <button type="button" className="btn-icon-sm" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} aria-label={`${t('remove')}: ${it.name}`}>
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        {/* Página a escala con la imagen colocada exactamente como saldrá en el PDF */}
                        <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                          <div
                            className="relative max-h-full max-w-full bg-white shadow"
                            style={{
                              aspectRatio: `${l.pageWidth} / ${l.pageHeight}`,
                              width: l.pageWidth >= l.pageHeight ? '100%' : 'auto',
                              height: l.pageWidth >= l.pageHeight ? 'auto' : '100%',
                            }}
                          >
                            <img
                              src={it.previewUrl}
                              alt={it.name}
                              draggable={false}
                              className="absolute"
                              style={{
                                left: `${(l.x / l.pageWidth) * 100}%`,
                                bottom: `${(l.y / l.pageHeight) * 100}%`,
                                width: `${(l.width / l.pageWidth) * 100}%`,
                                height: `${(l.height / l.pageHeight) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="mt-1 truncate text-xs muted" title={it.name}>
                          {it.name}
                        </p>
                      </>
                    )}
                  </SortableItem>
                );
              })}
            </SortableList>
          </div>
          {!preparing && <FileDropzone compact accept={ACCEPTED_IMAGE_EXT} mimeTypes={MIME} multiple onFiles={addFiles} onRejected={rejected} />}
        </>
      )}

      {preparing && (
        <ProgressBar value={preparing.done / preparing.total} label={t('preparingImages', { done: preparing.done, total: preparing.total })} />
      )}
      {errors.map((e, i) => (
        <ErrorMessage key={i} error={e} onDismiss={() => setErrors((prev) => prev.filter((x) => x !== e))} />
      ))}
      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}

      {items.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          {task.running ? (
            <ProgressBar value={task.progress} onCancel={task.cancel} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!!preparing} onClick={create}>
              {t('imagesAction', { n: items.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
