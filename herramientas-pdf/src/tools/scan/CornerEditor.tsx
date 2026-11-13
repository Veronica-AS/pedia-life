import { useRef } from 'react';
import { useL } from '../../i18n/I18nProvider';
import type { Quad } from './cv';

/** Foto con las 4 esquinas del documento, que se pueden arrastrar (o mover con las flechas) */
export function CornerEditor({ src, aspect, quad, onChange }: { src: string; aspect: number; quad: Quad; onChange: (q: Quad) => void }) {
  const L = useL();
  const box = useRef<HTMLDivElement>(null);
  const names = [L('Esquina superior izquierda', 'Top-left corner'), L('Esquina superior derecha', 'Top-right corner'), L('Esquina inferior derecha', 'Bottom-right corner'), L('Esquina inferior izquierda', 'Bottom-left corner')];
  const set = (i: number, x: number, y: number) => {
    const q = quad.map((p) => ({ ...p })) as Quad;
    q[i] = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    onChange(q);
  };
  const drag = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = box.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => set(i, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={box} className="relative mx-auto touch-none select-none" style={{ aspectRatio: `${aspect}`, width: `min(100%, calc(70vh * ${aspect}))` }} data-testid="corner-editor">
      <img src={src} alt={L('Foto del documento', 'Document photo')} className="absolute inset-0 h-full w-full rounded-lg" draggable={false} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={quad.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(51,123,252,0.18)" stroke="#337bfc" strokeWidth="0.006" />
      </svg>
      {quad.map((p, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${names[i]}. ${L('Flechas para mover', 'Arrows to move')}`}
          className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-4 border-white bg-brand-600 shadow-lg"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={drag(i)}
          onKeyDown={(e) => {
            const s = e.shiftKey ? 0.02 : 0.005;
            const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
            if (d) {
              e.preventDefault();
              set(i, p.x + d[0], p.y + d[1]);
            }
          }}
        />
      ))}
    </div>
  );
}
