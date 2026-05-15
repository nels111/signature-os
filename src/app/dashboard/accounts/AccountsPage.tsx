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

function accountInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
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
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ width: 32, height: 32, backgroundColor: 'var(--brand-blue)' }}
          >
            {accountInitials(item.name)}
          </div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.name}
          </span>
        </div>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      sortable: false,
      mobileHidden: true,
      render: (item: Account) =>
        item.industry || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      mobileHidden: true,
      render: (item: Account) =>
        item.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'website',
      label: 'Website',
      sortable: false,
      mobileHidden: true,
      render: (item: Account) =>
        item.website ? (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: 'var(--brand-blue)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {item.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'contacts',
      label: 'Contacts',
      sortable: false,
      render: (item: Account) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {item._count?.contacts ?? 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      mobileHidden: true,
      render: (item: Account) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(item.createdAt)}
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
            Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} account{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          + New Account
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
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
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="createdAt">Date Created</option>
            <option value="name">Name</option>
            <option value="industry">Industry</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="border rounded px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={accounts}
        onRowClick={(item) => router.push(`/dashboard/accounts/${item.id}`)}
        emptyMessage="No accounts found. Create your first account to get started."
        isLoading={loading}
        meta={metaText}
      />

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
