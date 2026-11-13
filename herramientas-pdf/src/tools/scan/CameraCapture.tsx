import { Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Modal } from '../../components/Modal';
import { useL } from '../../i18n/I18nProvider';
import { AppError } from '../../lib/errors';
import { canvasToBlob } from '../../lib/pdfjs';

/** Cámara en vivo (trasera si existe). Cada captura se entrega como imagen JPEG. */
export function CameraCapture({ open, onClose, onCapture, count }: { open: boolean; onClose: () => void; onCapture: (b: Blob) => void; count: number }) {
  const L = useL();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-media');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(new AppError('camera-unavailable', { detail: err instanceof Error ? err.name : undefined }));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    onCapture(await canvasToBlob(c, 'image/jpeg', 0.92));
    c.width = c.height = 0;
  };

  return (
    <Modal open={open} onClose={onClose} title={L('Escanear con la cámara', 'Scan with camera')}>
      <div className="flex h-full flex-col bg-black">
        {error ? (
          <div className="p-4">
            <ErrorMessage error={error} />
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <video ref={video} playsInline muted className="h-full w-full object-contain" aria-label={L('Vista de la cámara', 'Camera view')} />
            {flash && <div className="absolute inset-0 bg-white/70" aria-hidden="true" />}
            {!ready && <p className="absolute inset-0 flex items-center justify-center text-white">{L('Abriendo la cámara…', 'Opening camera…')}</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 bg-slate-950 p-4 text-white">
          <span className="text-sm" aria-live="polite">
            {L('{n} página(s) capturada(s)', '{n} page(s) captured', { n: count })}
          </span>
          <button type="button" className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40" onClick={capture} disabled={!ready} aria-label={L('Capturar página', 'Capture page')}>
            <Camera className="h-7 w-7" aria-hidden="true" />
          </button>
          <button type="button" className="btn rounded-xl bg-white px-4 text-slate-900" onClick={onClose}>
            {L('Listo', 'Done')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
