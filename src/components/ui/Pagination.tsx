'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const btnStyle = {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-sm disabled:opacity-40 transition-colors"
          style={btnStyle}
        >
          Prev
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm disabled:opacity-40 transition-colors"
          style={btnStyle}
        >
          Next
        </button>
      </div>
    </div>
  );
}
