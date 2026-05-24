'use client';

import { useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  mobileHidden?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  meta?: string;
  mobileCard?: (item: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found',
  isLoading = false,
  meta,
  mobileCard,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = String(a[sortKey] ?? '');
    const bVal = String(b[sortKey] ?? '');
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  if (!isLoading && data.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center text-sm"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {/* Mobile card list — shown only when mobileCard prop provided */}
      {mobileCard && (
        <div
          className="sm:hidden rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div
                  className="rounded-full animate-pulse flex-shrink-0"
                  style={{ width: 40, height: 40, background: 'var(--border)' }}
                />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border)', width: '60%' }} />
                  <div className="h-3 rounded animate-pulse" style={{ background: 'var(--border)', width: '40%' }} />
                </div>
              </div>
            ))
          ) : sorted.map((item, i) => (
            <div
              key={i}
              style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : undefined }}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer active:opacity-80' : ''}
            >
              {mobileCard(item)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table — hidden on mobile when mobileCard is provided */}
      <div className={mobileCard ? 'hidden sm:block' : ''}>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      role={col.sortable ? 'columnheader button' : 'columnheader'}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === 'asc' ? 'ascending' : 'descending'
                          : col.sortable ? 'none' : undefined
                      }
                      tabIndex={col.sortable ? 0 : undefined}
                      className={`text-left px-5 py-3.5 font-semibold text-xs uppercase ${
                        col.sortable ? 'cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1' : ''
                      } ${col.mobileHidden ? 'hidden sm:table-cell' : ''}`}
                      style={{
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.05em',
                        background: 'var(--surface-accent)',
                      }}
                      onClick={() => col.sortable && handleSort(col.key)}
                      onKeyDown={(e) => {
                        if (!col.sortable) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSort(col.key);
                        }
                      }}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="ml-1" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        {columns.map((col) => (
                          <td key={col.key} className={`px-5 py-3.5 ${col.mobileHidden ? 'hidden sm:table-cell' : ''}`}>
                            <div
                              className="h-4 rounded animate-pulse"
                              style={{ background: 'var(--border)', width: '70%' }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : sorted.map((item, i) => (
                      <tr
                        key={i}
                        tabIndex={onRowClick ? 0 : undefined}
                        role={onRowClick ? 'button' : undefined}
                        className={`transition-colors ${onRowClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset' : ''}`}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                        onClick={() => onRowClick?.(item)}
                        onKeyDown={(e) => {
                          if (!onRowClick) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(item);
                          }
                        }}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-5 py-3.5 ${col.mobileHidden ? 'hidden sm:table-cell' : ''}`}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {col.render ? col.render(item) : String(item[col.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {meta && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {meta}
        </p>
      )}
    </div>
  );
}
