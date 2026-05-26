'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';

interface Quote {
  id: string;
  status: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  weeklyHours: string | number | null;
  sellRate: string | number | null;
  monthlyTotal: string | number | null;
  annualTotal: string | number | null;
  margin: string | number | null;
  isPilot: boolean;
  trackingId: string | null;
  openCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  supersededById: string | null;
  deal: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  creator: { id: string; name: string | null } | null;
  [key: string]: unknown;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  superseded: 'Superseded',
};

const STATUS_COLOURS: Record<string, string> = {
  draft: '#6b7280',
  sent: '#2056A4',
  viewed: '#0ea5e9',
  accepted: '#6B8E23',
  rejected: '#dc2626',
  expired: '#f59e0b',
  superseded: '#9ca3af',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function QuotesListPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRef = useRef(0);

  useEffect(() => {
    const id = ++fetchRef.current;
    const p = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    setLoading(true);
    fetch(`/api/quotes?${p}`)
      .then((res) => res.json())
      .then((json) => {
        if (id !== fetchRef.current) return;
        setQuotes(json.quotes || []);
        setTotal(json.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchRef.current) setLoading(false);
      });
  }, [page, limit, debouncedSearch, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (item: Quote) => (
        <div className="flex flex-col">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.companyName || item.account?.name || item.deal?.name || '—'}
          </span>
          {item.contactName && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {item.contactName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (item: Quote) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: STATUS_COLOURS[item.status] || '#6b7280' }}
          >
            {STATUS_LABELS[item.status] || item.status}
          </span>
          {item.isPilot && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#fff3cd', color: '#856404' }}
            >
              Pilot
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'monthlyTotal',
      label: 'Monthly',
      sortable: false,
      render: (item: Quote) =>
        item.monthlyTotal ? (
          <span className="text-sm font-bold" style={{ color: 'var(--brand-blue)' }}>
            {formatCurrency(item.monthlyTotal)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'opens',
      label: 'Opens',
      sortable: false,
      mobileHidden: true,
      render: (item: Quote) => (
        <span className="text-sm" style={{ color: item.openCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {item.openCount > 0 ? item.openCount : '—'}
        </span>
      ),
    },
    {
      key: 'sentAt',
      label: 'Sent',
      sortable: false,
      mobileHidden: true,
      render: (item: Quote) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(item.sentAt)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      mobileHidden: true,
      render: (item: Quote) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'creator',
      label: 'Creator',
      sortable: false,
      mobileHidden: true,
      render: (item: Quote) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {item.creator?.name || '—'}
        </span>
      ),
    },
  ];

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const metaText = total > 0 ? `Showing ${startItem}–${endItem} of ${total}` : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Quotes
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} quote{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/quotes')}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          + New Quote
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus-brand"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4"
            style={{ color: 'var(--text-muted)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={quotes}
        onRowClick={(item) => router.push(`/dashboard/quotes/${item.id}`)}
        emptyMessage="No quotes found. Generate your first quote to get started."
        isLoading={loading}
        meta={metaText}
        mobileCard={(item) => (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-sm font-bold"
              style={{ width: 40, height: 40, backgroundColor: STATUS_COLOURS[item.status] || '#6b7280' }}
            >
              {(item.companyName || item.account?.name || item.deal?.name || 'Q').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {item.companyName || item.account?.name || item.deal?.name || '—'}
              </div>
              {item.contactName && (
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {item.contactName}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: STATUS_COLOURS[item.status] || '#6b7280' }}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
                {item.isPilot && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: '#fff3cd', color: '#856404' }}
                  >
                    Pilot
                  </span>
                )}
              </div>
              {item.sentAt && (
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Sent {formatDate(item.sentAt)}
                </div>
              )}
            </div>
            {item.monthlyTotal && (
              <div className="flex-shrink-0 font-bold text-sm" style={{ color: 'var(--brand-blue)' }}>
                {formatCurrency(item.monthlyTotal)}/mo
              </div>
            )}
          </div>
        )}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
