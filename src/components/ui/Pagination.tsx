'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm" style={{ color: '#64748b' }}>
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
          style={{ borderColor: '#e2e8f0' }}
        >
          Prev
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
          style={{ borderColor: '#e2e8f0' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
