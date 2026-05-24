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
      label: 'Contact',
      sortable: false,
      render: (item: Contact) => {
        const initials = `${item.firstName.charAt(0)}${item.lastName.charAt(0)}`.toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ width: 32, height: 32, backgroundColor: 'var(--brand-blue)' }}
            >
              {initials}
            </div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {item.firstName} {item.lastName}
            </span>
          </div>
        );
      },
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      mobileHidden: true,
      render: (item: Contact) =>
        item.email || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      mobileHidden: true,
      render: (item: Contact) =>
        item.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      mobileHidden: true,
      render: (item: Contact) =>
        item.company || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'account',
      label: 'Account',
      sortable: false,
      mobileHidden: true,
      render: (item: Contact) =>
        item.account ? (
          <span className="text-sm" style={{ color: 'var(--brand-blue)' }}>
            {item.account.name}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
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
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      mobileHidden: true,
      render: (item: Contact) => (
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
            Contacts
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} contact{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          + New Contact
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
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
            <option value="firstName">First Name</option>
            <option value="lastName">Last Name</option>
            <option value="email">Email</option>
            <option value="company">Company</option>
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
        data={contacts}
        onRowClick={(item) => router.push(`/dashboard/contacts/${item.id}`)}
        emptyMessage="No contacts found. Create your first contact to get started."
        isLoading={loading}
        meta={metaText}
        mobileCard={(item) => {
          const initials = `${item.firstName.charAt(0)}${item.lastName.charAt(0)}`.toUpperCase();
          return (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-sm font-bold"
                style={{ width: 40, height: 40, backgroundColor: 'var(--brand-blue)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {item.firstName} {item.lastName}
                </div>
                {item.company && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {item.company}
                  </div>
                )}
                {item.email && (
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {item.email}
                  </div>
                )}
                {item.phone && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.phone}
                  </div>
                )}
                {item.source && (
                  <div className="mt-1">
                    <Badge
                      label={SOURCE_LABELS[item.source] || item.source}
                      variant={SOURCE_VARIANTS[item.source] || 'default'}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

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
