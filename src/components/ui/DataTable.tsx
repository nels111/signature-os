'use client';

import { useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found',
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

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center" style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: '#e2e8f0' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left px-4 py-3 font-medium ${col.sortable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                style={{ color: '#64748b' }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr
              key={i}
              className={`border-b last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                i % 2 === 1 ? 'bg-gray-50/50' : ''
              }`}
              style={{ borderColor: '#e2e8f0' }}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3" style={{ color: '#1a1a1a' }}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
