import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useL } from '../i18n/I18nProvider';
import type { VisualRect } from '../lib/geometry';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Caja movible y redimensionable sobre una página (coordenadas normalizadas 0-1).
 * Teclado: flechas mueven (Mayús = más rápido), + / − cambian el tamaño, Supr elimina.
 */
export function BoxOverlay({
  rect,
  onChange,
  onRemove,
  label,
  aspect,
  className = '',
  children,
}: {
  rect: VisualRect;
  onChange: (r: VisualRect) => void;
  onRemove: () => void;
  label: string;
  /** Si se indica, mantiene la proporción ancho/alto (en coordenadas normalizadas) */
  aspect?: number;
  className?: string;
  children?: ReactNode;
}) {
  const L = useL();
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; start: VisualRect; parent: DOMRect } | null>(null);

  const begin = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const parent = (e.currentTarget as HTMLElement).closest('[data-testid="page-stage"]')!.getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: rect, parent };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const du = (e.clientX - d.x) / d.parent.width;
    const dv = (e.clientY - d.y) / d.parent.height;
    if (d.mode === 'move') {
      onChange({ ...d.start, u: clamp(d.start.u + du, 0, 1 - d.start.w), v: clamp(d.start.v + dv, 0, 1 - d.start.h) });
    } else {
      const w = clamp(d.start.w + du, 0.02, 1 - d.start.u);
      const h = aspect ? w / aspect : clamp(d.start.h + dv, 0.01, 1 - d.start.v);
      if (d.start.v + h <= 1) onChange({ ...d.start, w, h });
    }
  };
  const end = () => {
    drag.current = null;
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let r = { ...rect };
    if (e.key === 'ArrowLeft') r.u -= step;
    else if (e.key === 'ArrowRight') r.u += step;
    else if (e.key === 'ArrowUp') r.v -= step;
    else if (e.key === 'ArrowDown') r.v += step;
    else if (e.key === '+' || e.key === '=') {
      r.w *= 1.1;
      r.h = aspect ? r.w / aspect : r.h * 1.1;
    } else if (e.key === '-') {
      r.w /= 1.1;
      r.h = aspect ? r.w / aspect : r.h / 1.1;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove();
      return;
    } else return;
    e.preventDefault();
    r = { ...r, w: clamp(r.w, 0.02, 1), h: clamp(r.h, 0.01, 1) };
    r.u = clamp(r.u, 0, 1 - r.w);
    r.v = clamp(r.v, 0, 1 - r.h);
    onChange(r);
  };

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${label}. ${L('Flechas para mover, + y − para cambiar el tamaño, Supr para quitar.', 'Arrows to move, + and − to resize, Delete to remove.')}`}
      className={`group absolute cursor-move touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`}
      style={{ left: `${rect.u * 100}%`, top: `${rect.v * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKey}
    >
      {children}
      <button
        type="button"
        className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label={`${L('Quitar', 'Remove')}: ${label}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        className="absolute -bottom-2.5 -right-2.5 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-brand-600 shadow"
        onPointerDown={begin('resize')}
        onPointerMove={move}
        onPointerUp={end}
        aria-hidden="true"
      />
    </div>
  );
}
