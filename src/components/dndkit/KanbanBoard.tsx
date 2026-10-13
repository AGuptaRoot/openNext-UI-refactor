import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useKanbanSensors } from './useKanbanSensors';

const COLUMN_PREFIX = 'kanban-column:';
const CARD_PREFIX = 'kanban-card:';

export function kanbanColumnId(columnId: string): string {
  return `${COLUMN_PREFIX}${columnId}`;
}

export function kanbanCardId(cardId: string): string {
  return `${CARD_PREFIX}${cardId}`;
}

export function parseKanbanColumnId(id: UniqueIdentifier | null | undefined): string | null {
  const raw = String(id || '');
  return raw.startsWith(COLUMN_PREFIX) ? raw.slice(COLUMN_PREFIX.length) : null;
}

export function parseKanbanCardId(id: UniqueIdentifier | null | undefined): string | null {
  const raw = String(id || '');
  return raw.startsWith(CARD_PREFIX) ? raw.slice(CARD_PREFIX.length) : null;
}

type KanbanContextValue = {
  activeCardId: string | null;
  overColumnId: string | null;
  disabled: boolean;
};

const KanbanContext = createContext<KanbanContextValue>({
  activeCardId: null,
  overColumnId: null,
  disabled: false,
});

export function useKanbanContext() {
  return useContext(KanbanContext);
}

export type KanbanBoardProps = {
  /** Map of columnId → ordered card ids currently in that column. */
  columns: Record<string, string[]>;
  /** Fired when a card is dropped onto a different column. */
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Optional drag overlay content for the active card id. */
  renderOverlay?: (cardId: string) => React.ReactNode;
  'data-tour'?: string;
};

function findColumnForCard(columns: Record<string, string[]>, cardId: string): string | null {
  for (const [columnId, cardIds] of Object.entries(columns)) {
    if (cardIds.includes(cardId)) return columnId;
  }
  return null;
}

/**
 * Multi-container collision detection that prefers the column under the pointer,
 * then falls back to closest corners (works when hovering another card).
 */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

  const overColumn = getFirstCollision(
    intersections.filter((c) => String(c.id).startsWith(COLUMN_PREFIX)),
    'id'
  );
  if (overColumn) return [{ id: overColumn }];

  const overCard = getFirstCollision(
    intersections.filter((c) => String(c.id).startsWith(CARD_PREFIX)),
    'id'
  );
  if (overCard) return [{ id: overCard }];

  return closestCorners(args);
};

/**
 * Kanban DnD board powered by @dnd-kit.
 * Dropping a card onto another column (or a card in that column) moves it there.
 */
export function KanbanBoard({
  columns,
  onMoveCard,
  disabled = false,
  className,
  children,
  renderOverlay,
  'data-tour': dataTour,
}: KanbanBoardProps) {
  const sensors = useKanbanSensors();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const contextValue = useMemo(
    () => ({ activeCardId, overColumnId, disabled }),
    [activeCardId, overColumnId, disabled]
  );

  const resolveOverColumn = (overId: UniqueIdentifier | undefined | null): string | null => {
    if (overId == null) return null;
    const asColumn = parseKanbanColumnId(overId);
    if (asColumn) return asColumn;
    const asCard = parseKanbanCardId(overId);
    if (asCard) return findColumnForCard(columns, asCard);
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = parseKanbanCardId(event.active.id);
    setActiveCardId(cardId);
    if (cardId) setOverColumnId(findColumnForCard(columns, cardId));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverColumnId(resolveOverColumn(event.over?.id ?? null));
  };

  const handleDragCancel = () => {
    setActiveCardId(null);
    setOverColumnId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const cardId = parseKanbanCardId(event.active.id);
    const toColumnId = resolveOverColumn(event.over?.id ?? null);
    setActiveCardId(null);
    setOverColumnId(null);
    if (!cardId || !toColumnId || disabled) return;

    const fromColumnId = findColumnForCard(columns, cardId);
    if (!fromColumnId || fromColumnId === toColumnId) return;

    await onMoveCard(cardId, fromColumnId, toColumnId);
  };

  return (
    <KanbanContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => {
          void handleDragEnd(event);
        }}
        onDragCancel={handleDragCancel}
      >
        <div className={className} data-tour={dataTour}>
          {children}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCardId && renderOverlay ? renderOverlay(activeCardId) : null}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  );
}

export type KanbanColumnProps = {
  columnId: string;
  className?: string;
  children: React.ReactNode;
  'data-tour'?: string;
};

/** Droppable kanban column. Highlights when a card is dragged over it. */
export function KanbanColumn({ columnId, className, children, 'data-tour': dataTour }: KanbanColumnProps) {
  const { overColumnId, activeCardId } = useKanbanContext();
  const { setNodeRef, isOver } = useDroppable({
    id: kanbanColumnId(columnId),
    data: { type: 'column', columnId },
  });

  const highlighted = Boolean(activeCardId) && (isOver || overColumnId === columnId);

  return (
    <div
      ref={setNodeRef}
      data-tour={dataTour}
      data-kanban-column={columnId}
      data-kanban-over={highlighted ? 'true' : 'false'}
      className={className}
    >
      {children}
    </div>
  );
}

export type KanbanCardProps = {
  cardId: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  /** When true, drag listeners attach to the whole card (default). */
  dragEntireCard?: boolean;
  'data-tour'?: string;
};

/** Draggable kanban card. */
export function KanbanCard({
  cardId,
  disabled = false,
  className,
  style,
  onClick,
  children,
  dragEntireCard = true,
  'data-tour': dataTour,
}: KanbanCardProps) {
  const { activeCardId, disabled: boardDisabled } = useKanbanContext();
  const isDisabled = disabled || boardDisabled;
  const skipClickRef = React.useRef(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: kanbanCardId(cardId),
    disabled: isDisabled,
    data: { type: 'card', cardId },
  });

  React.useEffect(() => {
    if (isDragging) skipClickRef.current = true;
  }, [isDragging]);

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging || activeCardId === cardId ? 0.35 : style?.opacity,
    cursor: isDisabled ? style?.cursor : isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      data-tour={dataTour}
      data-kanban-card={cardId}
      style={dragStyle}
      className={className}
      onClick={() => {
        if (skipClickRef.current) {
          skipClickRef.current = false;
          return;
        }
        onClick?.();
      }}
      {...(dragEntireCard && !isDisabled ? { ...listeners, ...attributes } : {})}
    >
      {!dragEntireCard && !isDisabled ? (
        <button
          type="button"
          className="kanban-drag-handle"
          aria-label="Drag card"
          {...listeners}
          {...attributes}
        />
      ) : null}
      {children}
    </div>
  );
}

export function KanbanColumnDropHint({
  columnId,
  label,
}: {
  columnId: string;
  label: string;
}) {
  const { activeCardId, overColumnId } = useKanbanContext();
  if (!activeCardId || overColumnId !== columnId) return null;
  return (
    <div className="border-2 border-dashed border-zinc-950 bg-white rounded-xl p-3 text-center text-xs font-bold text-zinc-950 animate-pulse flex items-center justify-center gap-1.5 pointer-events-none">
      <span>⬇</span>
      <span>Drop to move to {label}</span>
    </div>
  );
}
