'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

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
  const [isMobile, setIsMobile] = useState(false);
  const dragRef = useRef<{ itemId: string; fromCol: string } | null>(null);
  const touchRef = useRef<{
    itemId: string;
    fromCol: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
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
      const touch = e.touches[0];
      touchRef.current = {
        itemId,
        fromCol: columnId,
        startX: touch.clientX,
        startY: touch.clientY,
        dragging: false,
      };
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const ref = touchRef.current;
      if (!ref) return;
      const touch = e.touches[0];
      const dx = touch.clientX - ref.startX;
      const dy = touch.clientY - ref.startY;

      if (!ref.dragging) {
        if (Math.abs(dy) > Math.abs(dx) + 8) {
          touchRef.current = null;
          setDragItemId(null);
          setDragFromCol(null);
          setDragOverCol(null);
          return;
        }
        if (Math.abs(dx) < 8) return;

        ref.dragging = true;
        setDragItemId(ref.itemId);
        setDragFromCol(ref.fromCol);
      }

      e.preventDefault();
      const colId = getColumnIdFromPoint(touch.clientX, touch.clientY);
      setDragOverCol(colId);
    },
    [getColumnIdFromPoint]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const ref = touchRef.current;
      if (!ref) return;
      if (!ref.dragging) {
        touchRef.current = null;
        return;
      }
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

  // Column width: narrower on mobile so more columns are visible
  const colWidth = isMobile ? 200 : 288;

  return (
    <div style={{ position: 'relative' }}>
      {/* Scroll hint on mobile when there are many columns */}
      {isMobile && columns.length > 2 && (
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>Swipe to see all {columns.length} stages</span>
          <span style={{ opacity: 0.6 }}>→</span>
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: isMobile ? 10 : 16,
          overflowX: 'auto',
          paddingBottom: 16,
          minHeight: 360,
        }}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            data-column-id={column.id}
            style={{
              flexShrink: 0,
              width: colWidth,
              borderRadius: 14,
              background: dragOverCol === column.id ? `${column.color}0A` : '#f8f8f6',
              boxShadow: dragOverCol === column.id
                ? `0 0 0 2px ${column.color}, 0 4px 16px rgba(0,0,0,0.08)`
                : '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.18s cubic-bezier(0.23,1,0.32,1), background 0.18s',
            }}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div style={{
              padding: isMobile ? '10px 12px' : '10px 14px',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              borderRadius: '14px 14px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: column.color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: isMobile ? 11 : 13, fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: isMobile ? 130 : 200,
                }}>
                  {column.label}
                </span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: `${column.color}18`, color: column.color,
                flexShrink: 0,
              }}>
                {column.items.length}
              </span>
            </div>

            {/* Column body */}
            <div style={{
              padding: 8,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
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
                    style={{
                      touchAction: 'pan-y',
                      opacity: dragItemId === itemId && dragFromCol === column.id ? 0.4 : 1,
                      cursor: 'grab',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {renderCard(item)}
                  </div>
                );
              })}
              {column.items.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px 8px',
                  fontSize: 11, color: 'var(--text-muted)',
                  border: `1.5px dashed ${column.color}40`, borderRadius: 10,
                }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
