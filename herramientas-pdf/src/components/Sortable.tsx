import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  layout = 'grid',
  className,
  children,
  describe,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  layout?: 'grid' | 'list';
  className?: string;
  children: ReactNode;
  /** Nombre legible del elemento para los anuncios del lector de pantalla */
  describe: (item: T, index: number) => string;
}) {
  const { lang } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) => {
    const i = items.findIndex((x) => x.id === id);
    return i >= 0 ? describe(items[i], i) : '';
  };
  const posOf = (id: string | number | undefined) => items.findIndex((x) => x.id === id) + 1;

  const es: Announcements = {
    onDragStart: ({ active }) => `Has tomado ${nameOf(active.id)}. Usa las flechas para moverlo y Espacio para soltarlo.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} está ahora en la posición ${posOf(over.id)} de ${items.length}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} se soltó en la posición ${posOf(over.id)}.` : `${nameOf(active.id)} se soltó.`),
    onDragCancel: ({ active }) => `Movimiento cancelado. ${nameOf(active.id)} volvió a su lugar.`,
  };
  const en: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is at position ${posOf(over.id)} of ${items.length}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${posOf(over.id)}.` : `${nameOf(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} returned.`,
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((x) => x.id === active.id);
    const to = items.findIndex((x) => x.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: lang === 'es' ? es : en,
        screenReaderInstructions: {
          draggable:
            lang === 'es'
              ? 'Para reordenar, pulsa Espacio o Intro, muévelo con las flechas y vuelve a pulsar Espacio para soltarlo. Escape cancela.'
              : 'To reorder, press Space or Enter, move with arrow keys, then press Space again to drop. Escape cancels.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>{children}</ul>
      </SortableContext>
    </DndContext>
  );
}

/** Elemento ordenable; el asa (grip) es lo único que inicia el arrastre para no impedir el scroll en celulares */
export function SortableItem({
  id,
  children,
  handleLabel,
  className = '',
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
  handleLabel: string;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      className="btn-icon-sm cursor-grab touch-none active:cursor-grabbing"
    >
      <GripVertical className="h-5 w-5" aria-hidden="true" />
    </button>
  );
  return (
    <li ref={setNodeRef} style={style} className={`${className} ${isDragging ? 'opacity-80 shadow-xl' : ''}`}>
      {children(handle)}
    </li>
  );
}
