'use client';

import React, { useState, useCallback, useRef } from 'react';

export interface KanbanColumn<T> {
  id: string;
  label: string;
  color: string;
  items: T[];
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  onDragEnd: (itemId: string, fromColumn: string, toColumn: string) => void;
  renderCard: (item: T) => React.ReactNode;
  getItemId: (item: T) => string;
}

export function KanbanBoard<T>({
  columns,
  onDragEnd,
  renderCard,
  getItemId,
}: KanbanBoardProps<T>) {
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragFromCol, setDragFromCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragRef = useRef<{ itemId: string; fromCol: string } | null>(null);
  const touchRef = useRef<{ itemId: string; fromCol: string } | null>(null);

  // ── HTML5 Drag (desktop) ──────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string, columnId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
      dragRef.current = { itemId, fromCol: columnId };
      setDragItemId(itemId);
      setDragFromCol(columnId);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toColumn: string) => {
      e.preventDefault();
      setDragOverCol(null);
      const ref = dragRef.current;
      if (ref && ref.fromCol !== toColumn) {
        onDragEnd(ref.itemId, ref.fromCol, toColumn);
      }
      setDragItemId(null);
      setDragFromCol(null);
      dragRef.current = null;
    },
    [onDragEnd]
  );

  const handleDragEndCleanup = useCallback(() => {
    setDragItemId(null);
    setDragFromCol(null);
    setDragOverCol(null);
    dragRef.current = null;
  }, []);

  // ── Touch Drag (mobile) ───────────────────────────────────────────────────

  const getColumnIdFromPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    // Walk up the DOM tree to find the nearest [data-column-id] ancestor
    let node: Element | null = el;
    while (node) {
      const colId = node.getAttribute('data-column-id');
      if (colId) return colId;
      node = node.parentElement;
    }
    return null;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, itemId: string, columnId: string) => {
      touchRef.current = { itemId, fromCol: columnId };
      setDragItemId(itemId);
      setDragFromCol(columnId);
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.touches[0];
      const colId = getColumnIdFromPoint(touch.clientX, touch.clientY);
      setDragOverCol(colId);
    },
    [getColumnIdFromPoint]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const ref = touchRef.current;
      if (!ref) return;
      const touch = e.changedTouches[0];
      const toColId = getColumnIdFromPoint(touch.clientX, touch.clientY);
      if (toColId && toColId !== ref.fromCol) {
        onDragEnd(ref.itemId, ref.fromCol, toColId);
      }
      setDragItemId(null);
      setDragFromCol(null);
      setDragOverCol(null);
      touchRef.current = null;
    },
    [getColumnIdFromPoint, onDragEnd]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
      {columns.map((column) => (
        <div
          key={column.id}
          data-column-id={column.id}
          className={`flex-shrink-0 w-72 rounded-xl border transition-colors ${
            dragOverCol === column.id ? 'ring-2 ring-offset-1' : ''
          }`}
          style={{
            borderColor: dragOverCol === column.id ? column.color : 'var(--border)',
            backgroundColor: dragOverCol === column.id ? 'var(--surface-accent)' : 'var(--background)',
            outline: dragOverCol === column.id ? `2px solid ${column.color}` : 'none',
          }}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          {/* Column header */}
          <div
            className="px-3 py-2 rounded-t-lg border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {column.label}
              </span>
            </div>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {column.items.length}
            </span>
          </div>

          {/* Column body */}
          <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {column.items.map((item) => {
              const itemId = getItemId(item);
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, itemId, column.id)}
                  onDragEnd={handleDragEndCleanup}
                  onTouchStart={(e) => handleTouchStart(e, itemId, column.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ touchAction: 'none' }}
                  className={`transition-opacity cursor-grab active:cursor-grabbing ${
                    dragItemId === itemId && dragFromCol === column.id
                      ? 'opacity-40'
                      : 'opacity-100'
                  }`}
                >
                  {renderCard(item)}
                </div>
              );
            })}
            {column.items.length === 0 && (
              <div
                className="text-center py-8 text-xs rounded border border-dashed"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
              >
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
