'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ContactForm } from './ContactForm';
import type { ContactFormData } from './ContactForm';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  accountId: string | null;
  source: string | null;
  createdAt: string;
  account: { id: string; name: string } | null;
  [key: string]: unknown;
}

const SOURCE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  referral: 'Referral',
  website: 'Website',
  mark_walker: 'Mark Walker',
  direct_mail: 'Direct Mail',
  other: 'Other',
};

const SOURCE_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  cold_call: 'info',
  cold_email: 'info',
  referral: 'success',
  website: 'warning',
  mark_walker: 'success',
  direct_mail: 'default',
  other: 'default',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
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
    fetch(`/api/contacts?${p}`)
      .then((res) => res.json())
      .then((json) => {
        if (id !== fetchRef.current) return;
        setContacts(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchRef.current) setLoading(false);
      });
  }, [page, limit, sortBy, sortDir, debouncedSearch]);

  const refetchContacts = () => {
    fetchRef.current++;
    const p = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortDir,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    setLoading(true);
    fetch(`/api/contacts?${p}`)
      .then((res) => res.json())
      .then((json) => {
        setContacts(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async (data: ContactFormData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowCreateModal(false);
        refetchContacts();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: 'firstName',
      label: 'First Name',
      sortable: false,
      render: (item: Contact) => (
        <span className="font-medium">{item.firstName}</span>
      ),
    },
    {
      key: 'lastName',
      label: 'Last Name',
      sortable: false,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      render: (item: Contact) => item.email || <span className="text-gray-400">—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (item: Contact) => item.phone || <span className="text-gray-400">—</span>,
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (item: Contact) => item.company || <span className="text-gray-400">—</span>,
    },
    {
      key: 'account',
      label: 'Account',
      sortable: false,
      render: (item: Contact) =>
        item.account ? (
          <span className="text-sm" style={{ color: '#2c5f2d' }}>
            {item.account.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: false,
      render: (item: Contact) =>
        item.source ? (
          <Badge
            label={SOURCE_LABELS[item.source] || item.source}
            variant={SOURCE_VARIANTS[item.source] || 'default'}
          />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      render: (item: Contact) => (
        <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            Contacts
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {total} contact{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90"
          style={{ backgroundColor: '#2c5f2d' }}
        >
          + New Contact
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
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
            <option value="firstName">First Name</option>
            <option value="lastName">Last Name</option>
            <option value="email">Email</option>
            <option value="company">Company</option>
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
          Loading contacts...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={contacts}
          onRowClick={(item) => router.push(`/dashboard/contacts/${item.id}`)}
          emptyMessage="No contacts found. Create your first contact to get started."
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Contact"
        maxWidth="600px"
      >
        <ContactForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          loading={saving}
        />
      </Modal>
    </div>
  );
}
