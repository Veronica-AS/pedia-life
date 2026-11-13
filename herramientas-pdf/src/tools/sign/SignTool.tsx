import '@fontsource/dancing-script/400.css';
import '@fontsource/great-vibes/400.css';
import '@fontsource/caveat/500.css';
import { Check, ImagePlus, PenLine, Plus, Type } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionBar, PdfDrop } from '../../components/PdfDropOrError';
import { BoxOverlay } from '../../components/BoxOverlay';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FileDropzone } from '../../components/FileDropzone';
import { PageStage } from '../../components/PageStage';
import { PdfPreview } from '../../components/PdfPreview';
import { ProgressBar } from '../../components/ProgressBar';
import { ResultPanel } from '../../components/ResultPanel';
import { useL } from '../../i18n/I18nProvider';
import type { OutputFile } from '../../lib/download';
import { AppError, toAppError } from '../../lib/errors';
import { baseName } from '../../lib/format';
import type { VisualRect } from '../../lib/geometry';
import { ACCEPTED_IMAGE_EXT, prepareImage } from '../../lib/images';
import { useTask } from '../../lib/useTask';
import { pdfTasks } from '../../workers/client';
import { FileHeader } from '../FileHeader';
import type { ToolProps } from '../types';
import { useSinglePdf } from '../useSinglePdf';
import { SignaturePad } from './SignaturePad';
import { canvasToAsset, removeLightBackground, SIGNATURE_FONTS, textToAsset, type SignatureAsset } from './signatureImage';

type Mode = 'draw' | 'type' | 'upload';
interface PlacementUI {
  id: string;
  imageId: string;
  page: number;
  rect: VisualRect;
}

const COLORS = [
  { value: '#111827', es: 'Negro', en: 'Black' },
  { value: '#1d3fae', es: 'Azul', en: 'Blue' },
];

let pseq = 0;

export default function SignTool(_: ToolProps) {
  const L = useL();
  const { pdf, loading, error, setError, load, clear } = useSinglePdf();
  const [mode, setMode] = useState<Mode>('draw');
  const [color, setColor] = useState(COLORS[0].value);
  const [drawn, setDrawn] = useState<HTMLCanvasElement | null>(null);
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState(SIGNATURE_FONTS[0].family);
  const [upload, setUpload] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [assets, setAssets] = useState<SignatureAsset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [placements, setPlacements] = useState<PlacementUI[]>([]);
  const [page, setPage] = useState(1);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [result, setResult] = useState<OutputFile | null>(null);
  const [createErr, setCreateErr] = useState<AppError | null>(null);
  const task = useTask();
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => {
    setPlacements([]);
    setPage(1);
    setResult(null);
    setAspects({});
  }, [pdf]);

  // Proporción (ancho/alto) de cada página tal como se ve, para mantener la firma sin deformar
  useEffect(() => {
    if (!pdf || aspects[page]) return;
    pdf.doc.getPage(page).then((p) => {
      const vp = p.getViewport({ scale: 1 });
      setAspects((a) => ({ ...a, [page]: vp.width / vp.height }));
    });
  }, [pdf, page, aspects]);

  // Vista previa de la imagen subida con o sin fondo
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!upload) return setUploadPreview(null);
    const c = document.createElement('canvas');
    c.width = upload.canvas.width;
    c.height = upload.canvas.height;
    c.getContext('2d')!.drawImage(upload.canvas, 0, 0);
    if (removeBg) removeLightBackground(c);
    const url = c.toDataURL('image/png');
    setUploadPreview(url);
  }, [upload, removeBg]);

  const onDrawn = useCallback((c: HTMLCanvasElement | null) => setDrawn(c), []);

  if (!pdf) return <PdfDrop onFile={load} loading={loading} error={error} setError={setError} />;
  if (result) {
    return (
      <ResultPanel files={[result]} zipName="" onBack={() => setResult(null)} onReset={clear}>
        <PdfPreview bytes={result.bytes} maxPages={30} />
      </ResultPanel>
    );
  }

  const addAsset = (a: SignatureAsset | null) => {
    if (!a) {
      setCreateErr(new AppError('image-decode', { detail: L('La firma está vacía.', 'The signature is empty.') }));
      return;
    }
    setCreateErr(null);
    urls.current.push(a.url);
    setAssets((p) => [...p, a]);
    setSelected(a.id);
  };

  const create = async () => {
    if (mode === 'draw' && drawn) addAsset(await canvasToAsset(drawn));
    else if (mode === 'type' && typed.trim()) addAsset(await textToAsset(typed.trim(), font, color));
    else if (mode === 'upload' && upload) {
      const c = document.createElement('canvas');
      c.width = upload.canvas.width;
      c.height = upload.canvas.height;
      c.getContext('2d')!.drawImage(upload.canvas, 0, 0);
      if (removeBg) removeLightBackground(c);
      addAsset(await canvasToAsset(c));
    }
  };

  const loadUpload = async (files: File[]) => {
    try {
      const { previewUrl } = await prepareImage(files[0]);
      urls.current.push(previewUrl);
      const img = new Image();
      img.src = previewUrl;
      await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setUpload({ canvas: c, url: previewUrl });
      setCreateErr(null);
    } catch (err) {
      setCreateErr(toAppError(err, files[0]?.name));
    }
  };

  const assetOf = (id: string) => assets.find((a) => a.id === id);
  const placeAt = (p: number, u: number, v: number, imageId = selected) => {
    const a = imageId && assetOf(imageId);
    const pageAspect = aspects[p] ?? 0.707;
    if (!a) return;
    const w = Math.min(0.35, 0.9);
    const h = (w * pageAspect) / a.aspect;
    const rect = { u: Math.max(0, Math.min(1 - w, u - w / 2)), v: Math.max(0, Math.min(1 - h, v - h / 2)), w, h };
    setPlacements((prev) => [...prev, { id: `p${++pseq}`, imageId: a.id, page: p, rect }]);
  };
  const placeAllPages = async () => {
    const a = selected && assetOf(selected);
    if (!a) return;
    const next: PlacementUI[] = [];
    for (let p = 1; p <= pdf.pages; p++) {
      const vp = (await pdf.doc.getPage(p)).getViewport({ scale: 1 });
      const pa = vp.width / vp.height;
      const w = 0.18;
      const h = (w * pa) / a.aspect;
      next.push({ id: `p${++pseq}`, imageId: a.id, page: p, rect: { u: 0.97 - w, v: 0.97 - h, w, h } });
    }
    setPlacements((prev) => [...prev, ...next]);
  };

  const sign = async () => {
    const used = new Set(placements.map((p) => p.imageId));
    const out = await task.run((onProgress) =>
      pdfTasks.sign(
        pdf.bytes,
        assets.filter((a) => used.has(a.id)).map((a) => ({ id: a.id, png: a.png })),
        placements.map(({ imageId, page: pg, rect }) => ({ imageId, page: pg, rect })),
        onProgress,
      ),
    );
    if (out) setResult({ name: `${baseName(pdf.name)}-firmado.pdf`, bytes: out, type: 'application/pdf' });
  };

  const canCreate = (mode === 'draw' && !!drawn) || (mode === 'type' && !!typed.trim()) || (mode === 'upload' && !!upload);
  const onPage = placements.filter((p) => p.page === page);

  return (
    <div className="space-y-5">
      <FileHeader name={pdf.name} pages={pdf.pages} size={pdf.bytes.length} onChange={clear} />

      <section className="card p-4" aria-labelledby="create-title">
        <h2 id="create-title" className="mb-3 font-semibold">
          1. {L('Crea tu firma', 'Create your signature')}
        </h2>
        <div className="mb-3 grid grid-cols-3 gap-2" role="tablist">
          {(
            [
              ['draw', PenLine, L('Dibujar', 'Draw')],
              ['type', Type, L('Escribir', 'Type')],
              ['upload', ImagePlus, L('Subir imagen', 'Upload')],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`btn ${mode === m ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950' : 'border border-slate-300 dark:border-slate-700'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {mode !== 'upload' && (
          <div className="mb-3 flex items-center gap-3 text-sm" role="radiogroup" aria-label={L('Color de la tinta', 'Ink color')}>
            {COLORS.map((c) => (
              <label key={c.value} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="ink" className="sr-only" checked={color === c.value} onChange={() => setColor(c.value)} />
                <span className={`h-7 w-7 rounded-full border-2 ${color === c.value ? 'border-brand-500 ring-2 ring-brand-300' : 'border-white'}`} style={{ background: c.value }} aria-hidden="true" />
                {L(c.es, c.en)}
              </label>
            ))}
          </div>
        )}

        {mode === 'draw' && <SignaturePad color={color} onChange={onDrawn} />}
        {mode === 'type' && (
          <div className="space-y-3">
            <label className="label" htmlFor="typed">
              {L('Tu nombre', 'Your name')}
            </label>
            <input id="typed" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="María Núñez" autoComplete="name" />
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={L('Estilo de letra', 'Font style')}>
              {SIGNATURE_FONTS.map((f) => (
                <label
                  key={f.family}
                  className={`flex min-h-[72px] cursor-pointer items-center justify-center rounded-xl border bg-white px-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${font === f.family ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-300'}`}
                >
                  <input type="radio" name="font" className="sr-only" checked={font === f.family} onChange={() => setFont(f.family)} aria-label={f.label} />
                  <span className="truncate text-3xl" style={{ fontFamily: `"${f.family}", cursive`, color }}>
                    {typed.trim() || 'Firma'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {mode === 'upload' && (
          <div className="space-y-3">
            {!upload ? (
              <FileDropzone accept={ACCEPTED_IMAGE_EXT} onFiles={loadUpload} listenPaste formatsLabel="JPG, PNG, HEIC, WEBP" />
            ) : (
              <>
                <div className="flex items-center justify-center rounded-xl border bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
                  {uploadPreview && <img src={uploadPreview} alt={L('Firma subida', 'Uploaded signature')} className="max-h-40" />}
                </div>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
                  {L('Quitar fondo blanco (recomendado para fotos de una firma en papel)', 'Remove white background (recommended for photos of a paper signature)')}
                </label>
                <button type="button" className="btn-ghost" onClick={() => setUpload(null)}>
                  {L('Elegir otra imagen', 'Choose another image')}
                </button>
              </>
            )}
          </div>
        )}
        {createErr && (
          <div className="mt-3">
            <ErrorMessage error={createErr} onDismiss={() => setCreateErr(null)} />
          </div>
        )}
        <button type="button" className="btn-primary mt-3" disabled={!canCreate} onClick={create}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {L('Usar esta firma', 'Use this signature')}
        </button>
      </section>

      {assets.length > 0 && (
        <section className="card p-4" aria-labelledby="place-title">
          <h2 id="place-title" className="mb-1 font-semibold">
            2. {L('Colócala en el documento', 'Place it on the document')}
          </h2>
          <p className="mb-3 text-sm muted">
            {L('Toca la página donde quieras poner la firma. Arrástrala para moverla y usa el círculo azul para cambiar su tamaño.', 'Tap the page where you want the signature. Drag to move; use the blue dot to resize.')}
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={L('Firma seleccionada', 'Selected signature')}>
            {assets.map((a, i) => (
              <label key={a.id} className={`flex h-16 cursor-pointer items-center rounded-xl border-2 bg-white px-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${selected === a.id ? 'border-brand-600' : 'border-slate-200'}`}>
                <input type="radio" name="sig" className="sr-only" checked={selected === a.id} onChange={() => setSelected(a.id)} aria-label={L('Firma {n}', 'Signature {n}', { n: i + 1 })} />
                <img src={a.url} alt="" className="max-h-12 max-w-[140px]" />
              </label>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => placeAt(page, 0.7, 0.85)} data-testid="place-here">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {L('Añadir en esta página', 'Add on this page')}
            </button>
            {pdf.pages > 1 && (
              <button type="button" className="btn-ghost" onClick={placeAllPages}>
                {L('Añadir en todas las páginas (rúbrica)', 'Add on every page (initials)')}
              </button>
            )}
          </div>
          <PageStage
            doc={pdf.doc}
            page={page}
            onPageChange={setPage}
            stageLabel={L('Página {n}: toca para colocar la firma', 'Page {n}: tap to place the signature', { n: page })}
            onStagePointerDown={(u, v) => placeAt(page, u, v)}
          >
            {onPage.map((pl, i) => {
              const a = assetOf(pl.imageId);
              return (
                <BoxOverlay
                  key={pl.id}
                  rect={pl.rect}
                  aspect={a ? a.aspect / (aspects[page] ?? 0.707) : undefined}
                  label={L('Firma {n} de la página', 'Signature {n} on the page', { n: i + 1 })}
                  className="border border-dashed border-brand-500"
                  onChange={(r) => setPlacements((prev) => prev.map((x) => (x.id === pl.id ? { ...x, rect: r } : x)))}
                  onRemove={() => setPlacements((prev) => prev.filter((x) => x.id !== pl.id))}
                >
                  {a && <img src={a.url} alt="" draggable={false} className="pointer-events-none h-full w-full" />}
                </BoxOverlay>
              );
            })}
          </PageStage>
          <p className="mt-2 text-sm muted" aria-live="polite">
            {L('{n} firma(s) colocada(s) en total', '{n} signature(s) placed in total', { n: placements.length })}
          </p>
        </section>
      )}

      {task.error && <ErrorMessage error={task.error} onDismiss={() => task.setError(null)} />}
      {assets.length > 0 && (
        <ActionBar>
          {task.running ? (
            <ProgressBar value={task.progress} />
          ) : (
            <button type="button" className="btn-primary w-full py-3 text-base sm:w-auto sm:px-8" disabled={!placements.length} onClick={sign}>
              {L('Firmar documento', 'Sign document')}
            </button>
          )}
        </ActionBar>
      )}
    </div>
  );
}
