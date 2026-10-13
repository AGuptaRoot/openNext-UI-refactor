import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSwapSensors } from './useSwapSensors';

export type SwapDropItem = {
  id: UniqueIdentifier;
};

export type SwapDropGridProps<T extends SwapDropItem> = {
  items: T[];
  /** Called after two items swap places by index. */
  onSwap: (fromIndex: number, toIndex: number) => void;
  /** Render each grid cell. `listeners` / `attributes` belong on the drag handle. */
  renderItem: (
    item: T,
    index: number,
    ctx: {
      isDragging: boolean;
      isOver: boolean;
      attributes: ReturnType<typeof useSortable>['attributes'];
      listeners: ReturnType<typeof useSortable>['listeners'];
      setNodeRef: (node: HTMLElement | null) => void;
      style: React.CSSProperties;
    }
  ) => React.ReactNode;
  /** Optional overlay while dragging. Defaults to a simple placeholder. */
  renderOverlay?: (item: T, index: number) => React.ReactNode;
  className?: string;
  /** Accessible label for the grid. */
  label?: string;
};

function SortableCell<T extends SwapDropItem>({
  item,
  index,
  renderItem,
}: {
  item: T;
  index: number;
  renderItem: SwapDropGridProps<T>['renderItem'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <>
      {renderItem(item, index, {
        isDragging,
        isOver,
        attributes,
        listeners,
        setNodeRef,
        style,
      })}
    </>
  );
}

/**
 * Grid drag-and-drop where dropping one item on another **swaps** their places
 * (does not shift/insert like classic sortable lists).
 */
export function SwapDropGrid<T extends SwapDropItem>({
  items,
  onSwap,
  renderItem,
  renderOverlay,
  className,
  label = 'Reorderable grid',
}: SwapDropGridProps<T>) {
  const sensors = useSwapSensors();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const activeIndex = activeId == null ? -1 : items.findIndex((item) => item.id === activeId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const fromIndex = items.findIndex((item) => item.id === active.id);
    const toIndex = items.findIndex((item) => item.id === over.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    onSwap(fromIndex, toIndex);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Picked up item ${String(active.id)}.`;
          },
          onDragOver({ active, over }) {
            if (!over) return;
            return `Item ${String(active.id)} is over ${String(over.id)}. Release to swap.`;
          },
          onDragEnd({ active, over }) {
            if (!over) return `Item ${String(active.id)} was dropped.`;
            return `Swapped ${String(active.id)} with ${String(over.id)}.`;
          },
          onDragCancel({ active }) {
            return `Dragging cancelled for ${String(active.id)}.`;
          },
        },
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div
          role="list"
          aria-label={label}
          className={className}
        >
          {items.map((item, index) => (
            <SortableCell
              key={String(item.id)}
              item={item}
              index={index}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem && activeIndex >= 0
          ? renderOverlay
            ? renderOverlay(activeItem, activeIndex)
            : (
              <div className="rounded-xl border-2 border-slate-900 bg-white px-4 py-3 text-sm font-semibold shadow-lg">
                Step {activeIndex + 1}
              </div>
            )
          : null}
      </DragOverlay>
    </DndContext>
  );
}
