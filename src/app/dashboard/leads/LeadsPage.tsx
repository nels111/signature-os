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
  cold_call: '#6b7280',
  cold_email: '#3b82f6',
  follow_up_sequence: '#f59e0b',
  meeting_scheduled: '#8b5cf6',
  meeting_attended: '#10b981',
  quote_delivered: '#2c5f2d',
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
      label: 'Company Name',
      sortable: false,
      render: (item: Lead) => (
        <span className="font-medium">{item.companyName}</span>
      ),
    },
    {
      key: 'contactName',
      label: 'Contact Name',
      sortable: false,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: false,
      render: (item: Lead) => item.email || <span className="text-gray-400">—</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: false,
      render: (item: Lead) => item.phone || <span className="text-gray-400">—</span>,
    },
    {
      key: 'source',
      label: 'Source',
      sortable: false,
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
      render: (item: Lead) =>
        item.owner?.name ? (
          <span className="text-sm">{item.owner.name}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: false,
      render: (item: Lead) => (
        <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {total} lead{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90"
          style={{ backgroundColor: '#2c5f2d' }}
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
          <option value="cold_call">Cold Call</option>
          <option value="cold_email">Cold Email</option>
          <option value="follow_up_sequence">Follow-up Sequence</option>
          <option value="meeting_scheduled">Meeting Scheduled</option>
          <option value="meeting_attended">Meeting Attended</option>
          <option value="quote_delivered">Quote Delivered</option>
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
            <option value="companyName">Company Name</option>
            <option value="contactName">Contact Name</option>
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
          Loading leads...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={leads}
          onRowClick={(item) => router.push(`/dashboard/leads/${item.id}`)}
          emptyMessage="No leads found. Create your first lead to get started."
        />
      )}

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
