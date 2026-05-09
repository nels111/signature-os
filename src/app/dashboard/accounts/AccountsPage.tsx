'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { AccountForm } from './AccountForm';
import type { AccountFormData } from './AccountForm';

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  _count?: { contacts: number };
  [key: string]: unknown;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debounce search
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
    });
    fetch(`/api/accounts?${p}`)
      .then((res) => res.json())
      .then((json) => {
        if (id !== fetchRef.current) return;
        setAccounts(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchRef.current) setLoading(false);
      });
  }, [page, limit, sortBy, sortDir, debouncedSearch]);

  const refetchAccounts = () => {
    fetchRef.current++;
    const p = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortDir,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    setLoading(true);
    fetch(`/api/accounts?${p}`)
      .then((res) => res.json())
      .then((json) => {
        setAccounts(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async (data: AccountFormData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowCreateModal(false);
        refetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: 'name',
      label: 'Account Name',
      sortable: false,
      render: (item: Account) => (
        <span className="font-medium" style={{ color: '#1a1a1a' }}>
          {item.name}
        </span>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      sortable: false,
      render: (item: Account) => item.industry || <span className="text-gray-400">—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (item: Account) => item.phone || <span className="text-gray-400">—</span>,
    },
    {
      key: 'website',
      label: 'Website',
      sortable: false,
      render: (item: Account) =>
        item.website ? (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: '#2c5f2d' }}
            onClick={(e) => e.stopPropagation()}
          >
            {item.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'contacts',
      label: 'Contacts',
      sortable: false,
      render: (item: Account) => (
        <span className="text-sm" style={{ color: '#64748b' }}>
          {item._count?.contacts ?? 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      render: (item: Account) => (
        <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {total} account{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90"
          style={{ backgroundColor: '#2c5f2d' }}
        >
          + New Account
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
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
            <option value="industry">Industry</option>
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
          Loading accounts...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={accounts}
          onRowClick={(item) => router.push(`/dashboard/accounts/${item.id}`)}
          emptyMessage="No accounts found. Create your first account to get started."
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Account"
        maxWidth="600px"
      >
        <AccountForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          loading={saving}
        />
      </Modal>
    </div>
  );
}
