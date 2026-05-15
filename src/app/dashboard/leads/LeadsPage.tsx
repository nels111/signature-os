'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LeadForm } from './LeadForm';
import type { LeadFormData } from './LeadForm';

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string | null } | null;
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

const STAGE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  follow_up_sequence: 'Follow-up Sequence',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_attended: 'Meeting Attended',
  quote_delivered: 'Quote Delivered',
};

const STAGE_COLOURS: Record<string, string> = {
  cold_call: 'var(--stage-cold-call)',
  cold_email: 'var(--stage-cold-email)',
  follow_up_sequence: 'var(--stage-follow-up)',
  meeting_scheduled: 'var(--stage-meeting)',
  meeting_attended: 'var(--stage-attended)',
  quote_delivered: 'var(--status-success)',
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
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

export function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
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
    fetch(`/api/leads?${p}`)
      .then((res) => res.json())
      .then((json) => {
        if (id !== fetchRef.current) return;
        setLeads(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchRef.current) setLoading(false);
      });
  }, [page, limit, sortBy, sortDir, debouncedSearch, stageFilter]);

  const refetchLeads = () => {
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
    fetch(`/api/leads?${p}`)
      .then((res) => res.json())
      .then((json) => {
        setLeads(json.data || []);
        setTotal(json.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async (data: LeadFormData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowCreateModal(false);
        refetchLeads();
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: 'companyName',
      label: 'Company',
      sortable: false,
      render: (item: Lead) => (
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ width: 32, height: 32, backgroundColor: 'var(--brand-blue)' }}
          >
            {companyInitials(item.companyName)}
          </div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.companyName}
          </span>
        </div>
      ),
    },
    {
      key: 'contactName',
      label: 'Contact Name',
      sortable: false,
      mobileHidden: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      mobileHidden: true,
      render: (item: Lead) =>
        item.email || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      mobileHidden: true,
      render: (item: Lead) =>
        item.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'source',
      label: 'Source',
      sortable: false,
      mobileHidden: true,
      render: (item: Lead) => (
        <Badge
          label={SOURCE_LABELS[item.source] || item.source}
          variant={SOURCE_VARIANTS[item.source] || 'default'}
        />
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      sortable: false,
      render: (item: Lead) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: STAGE_COLOURS[item.stage] || '#6b7280' }}
        >
          {STAGE_LABELS[item.stage] || item.stage}
        </span>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      sortable: false,
      mobileHidden: true,
      render: (item: Lead) =>
        item.owner?.name ? (
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {item.owner.name}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      mobileHidden: true,
      render: (item: Lead) => (
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
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} lead{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          + New Lead
        </button>
      </div>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
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
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Stages</option>
          <option value="cold_call">Cold Call</option>
          <option value="cold_email">Cold Email</option>
          <option value="follow_up_sequence">Follow-up Sequence</option>
          <option value="meeting_scheduled">Meeting Scheduled</option>
          <option value="meeting_attended">Meeting Attended</option>
          <option value="quote_delivered">Quote Delivered</option>
        </select>
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
            <option value="companyName">Company Name</option>
            <option value="contactName">Contact Name</option>
            <option value="stage">Stage</option>
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
        data={leads}
        onRowClick={(item) => router.push(`/dashboard/leads/${item.id}`)}
        emptyMessage="No leads found. Create your first lead to get started."
        isLoading={loading}
        meta={metaText}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Lead"
        maxWidth="600px"
      >
        <LeadForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
          loading={saving}
        />
      </Modal>
    </div>
  );
}
