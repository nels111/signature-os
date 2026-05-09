'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { DealForm } from './DealForm';
import type { DealFormData } from './DealForm';

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: string | null;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  account: { id: string; name: string } | null;
  convertedFrom: { id: string; companyName: string } | null;
  [key: string]: unknown;
}

const STAGE_LABELS: Record<string, string> = {
  quote_sent: 'Quote Sent',
  follow_up_from_quote: 'Follow-up from Quote',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_COLOURS: Record<string, string> = {
  quote_sent: '#3b82f6',
  follow_up_from_quote: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
};

function formatDate(dateStr: string): string {
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

export function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [stageFilter, setStageFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
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
      sortBy,
      sortDir,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(stageFilter ? { stage: stageFilter } : {}),
    });
    fetch(`/api/deals?${p}`)
      .then((res) => res.json())
      .then((json) => {
        if (id !== fetchRef.current) return;
        setDeals(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchRef.current) setLoading(false);
      });
  }, [page, limit, sortBy, sortDir, debouncedSearch, stageFilter]);

  const refetchDeals = () => {
    fetchRef.current++;
    const p = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortDir,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(stageFilter ? { stage: stageFilter } : {}),
    });
    setLoading(true);
    fetch(`/api/deals?${p}`)
      .then((res) => res.json())
      .then((json) => {
        setDeals(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async (data: DealFormData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowCreateModal(false);
        refetchDeals();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: false,
      render: (item: Deal) => (
        <span className="font-medium">{item.name}</span>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      sortable: false,
      render: (item: Deal) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: STAGE_COLOURS[item.stage] || '#6b7280' }}
        >
          {STAGE_LABELS[item.stage] || item.stage}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      sortable: false,
      render: (item: Deal) =>
        item.value ? (
          <span className="text-sm font-medium" style={{ color: '#2c5f2d' }}>
            {formatCurrency(item.value)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'owner',
      label: 'Owner',
      sortable: false,
      render: (item: Deal) =>
        item.owner?.name ? (
          <span className="text-sm">{item.owner.name}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'contact',
      label: 'Contact',
      sortable: false,
      render: (item: Deal) =>
        item.contact ? (
          <span className="text-sm">
            {item.contact.firstName} {item.contact.lastName}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'account',
      label: 'Account',
      sortable: false,
      render: (item: Deal) =>
        item.account ? (
          <span className="text-sm" style={{ color: '#2c5f2d' }}>
            {item.account.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      render: (item: Deal) => (
        <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            Deals
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {total} deal{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90"
          style={{ backgroundColor: '#2c5f2d' }}
        >
          + New Deal
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            style={{ borderColor: '#e2e8f0' }}
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
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
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1 text-sm"
          style={{ borderColor: '#e2e8f0' }}
        >
          <option value="">All Stages</option>
          <option value="quote_sent">Quote Sent</option>
          <option value="follow_up_from_quote">Follow-up from Quote</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            style={{ borderColor: '#e2e8f0' }}
          >
            <option value="createdAt">Date Created</option>
            <option value="name">Name</option>
            <option value="value">Value</option>
            <option value="stage">Stage</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="border rounded px-2 py-1 text-sm hover:bg-gray-50"
            style={{ borderColor: '#e2e8f0' }}
          >
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border p-8 text-center" style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
          Loading deals...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={deals}
          onRowClick={(item) => router.push(`/dashboard/deals/${item.id}`)}
          emptyMessage="No deals found. Create your first deal to get started."
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Deal"
        maxWidth="600px"
      >
        <DealForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          loading={saving}
        />
      </Modal>
    </div>
  );
}
