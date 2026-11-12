import { Eraser, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useL } from '../../i18n/I18nProvider';

type Point = { x: number; y: number; p: number };

/**
 * Lienzo para dibujar la firma con el dedo, lápiz o ratón.
 * El trazo se suaviza con curvas y su grosor varía con la presión (si el dispositivo la informa).
 */
export function SignaturePad({ color, onChange }: { color: string; onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const L = useL();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[] | null>(null);
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const base = c.width / 220;
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x * c.width, s[0].y * c.height, base, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1];
        const b = s[i];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = base * (0.6 + b.p);
        ctx.beginPath();
        if (i === 1) ctx.moveTo(a.x * c.width, a.y * c.height);
        else {
          const pm = { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 };
          ctx.moveTo(pm.x * c.width, pm.y * c.height);
        }
        ctx.quadraticCurveTo(a.x * c.width, a.y * c.height, mid.x * c.width, mid.y * c.height);
        ctx.stroke();
      }
    }
  }, [color]);

  // Resolución interna alta para que la firma se vea nítida al imprimir
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = 1400;
    c.height = 500;
    redraw();
  }, [redraw]);

  useEffect(() => {
    redraw();
    onChange(strokes.current.length ? canvasRef.current : null);
  }, [color, redraw, onChange, count]);

  const point = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5 };
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="aspect-[14/5] w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-600"
          aria-label={L('Área para dibujar la firma', 'Signature drawing area')}
          role="img"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            current.current = [point(e)];
            redraw();
          }}
          onPointerMove={(e) => {
            if (!current.current) return;
            const events = 'getCoalescedEvents' in e.nativeEvent ? (e.nativeEvent as PointerEvent).getCoalescedEvents() : [];
            if (events.length) {
              const r = canvasRef.current!.getBoundingClientRect();
              for (const ev of events) current.current.push({ x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, p: ev.pressure && ev.pointerType === 'pen' ? ev.pressure : 0.5 });
            } else current.current.push(point(e));
            redraw();
          }}
          onPointerUp={() => {
            if (current.current) strokes.current.push(current.current);
            current.current = null;
            setCount((n) => n + 1);
          }}
          onPointerCancel={() => {
            current.current = null;
            redraw();
          }}
        />
        {!strokes.current.length && !current.current && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400">{L('Firma aquí con el dedo o el ratón', 'Sign here with your finger or mouse')}</span>
        )}
        <span className="pointer-events-none absolute bottom-[22%] left-[8%] right-[8%] border-b border-slate-300" aria-hidden="true" />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={!strokes.current.length}
          onClick={() => {
            strokes.current.pop();
            setCount((n) => n + 1);
          }}
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          {L('Deshacer', 'Undo')}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!strokes.current.length}
          onClick={() => {
            strokes.current = [];
            setCount(0);
          }}
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          {L('Borrar', 'Clear')}
        </button>
      </div>
    </div>
  );
}
