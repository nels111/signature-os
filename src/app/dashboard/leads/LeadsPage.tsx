'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LeadForm } from './LeadForm';
import { LeadImportModal } from './LeadImportModal';
import type { LeadFormData } from '@/lib/schemas/lead';

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
  linkedin: 'LinkedIn',
  referral: 'Referral',
  website: 'Website',
  partner: 'Partner',
  mark_walker: 'Partner',   // legacy — display same as partner
  direct_mail: 'Direct Mail',
  other: 'Other',
};

const STAGE_LABELS: Record<string, string> = {
  // Active pipeline stages
  new_lead: 'New Lead',
  contacted: 'Contacted',
  meeting_scheduled: 'Meeting Booked',
  meeting_attended: 'Meeting Done',
  quote_delivered: 'Quote Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  contact_when_contract_up: 'On Hold',
  not_interested_for_now: 'Not Interested',
  foad: 'Dead',
  // Legacy stages (kept for backward compat)
  cold_call: 'Contacted',
  cold_email: 'Contacted',
  linkedin: 'Contacted',
  follow_up_sequence: 'Contacted',
  dormant: 'Dormant',
  bad_data: 'Bad Data',
  archived: 'Archived',
};

const STAGE_COLOURS: Record<string, string> = {
  // Active pipeline stages (funnel order)
  new_lead:                 '#6b7280',   // grey — just entered
  contacted:                '#3b82f6',   // blue — reached out
  meeting_scheduled:        '#8b5cf6',   // purple — booked
  meeting_attended:         '#a78bfa',   // light purple — attended
  quote_delivered:          '#f59e0b',   // amber — quote out
  negotiating:              '#f97316',   // orange — in play
  won:                      '#10b981',   // green — closed
  contact_when_contract_up: '#6366f1',   // indigo — future
  not_interested_for_now:   '#9ca3af',   // muted grey
  foad:                     '#ef4444',   // red — dead
  // Legacy stage colours (fallback)
  cold_call:                '#3b82f6',
  cold_email:               '#3b82f6',
  linkedin:                 '#3b82f6',
  follow_up_sequence:       '#3b82f6',
  dormant:                  '#9ca3af',
  bad_data:                 '#ef4444',
  archived:                 '#6b7280',
};

const SOURCE_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  cold_call: 'info',
  cold_email: 'info',
  linkedin: 'info',
  referral: 'success',
  website: 'warning',
  partner: 'success',
  mark_walker: 'success',  // legacy
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

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
    // 'all' shows everything; '' (default) hides FOAD; specific stage = filter to that stage
    const p = new URLSearchParams({ page: page.toString(), limit: limit.toString(), sortBy, sortDir });
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (stageFilter === 'all') { /* no stage filter */ }
    else if (stageFilter) p.set('stage', stageFilter);
    else p.set('excludeStage', 'foad');
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
    const p = new URLSearchParams({ page: page.toString(), limit: limit.toString(), sortBy, sortDir });
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (stageFilter === 'all') { /* no stage filter */ }
    else if (stageFilter) p.set('stage', stageFilter);
    else p.set('excludeStage', 'foad');
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

  // Clear selection when page/filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, stageFilter, debouncedSearch]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (leads.every(l => selectedIds.has(l.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const handleBulkStageUpdate = async (stage: string) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), stage }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        refetchLeads();
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkUpdating(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        refetchLeads();
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  const allOnPageSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const someOnPageSelected = leads.some(l => selectedIds.has(l.id));

  const totalPages = Math.ceil(total / limit);

  const columns = [
    {
      key: '_select',
      label: (
        <input
          type="checkbox"
          checked={allOnPageSelected}
          ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
          onChange={toggleSelectAll}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer"
          aria-label="Select all"
        />
      ) as unknown as string,
      sortable: false,
      render: (item: Lead) => (
        <input
          type="checkbox"
          checked={selectedIds.has(item.id)}
          onChange={() => toggleSelect(item.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer"
        />
      ),
    },
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} lead{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 text-sm rounded-lg hover:opacity-90 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--surface)' }}
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            + New Lead
          </button>
        </div>
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
          <option value="">Active Leads</option>
          <option value="new_lead">New Lead</option>
          <option value="contacted">Contacted</option>
          <option value="meeting_scheduled">Meeting Booked</option>
          <option value="meeting_attended">Meeting Done</option>
          <option value="quote_delivered">Quote Sent</option>
          <option value="negotiating">Negotiating</option>
          <option value="won">Won</option>
          <option value="contact_when_contract_up">On Hold</option>
          <option value="not_interested_for_now">Not Interested</option>
          <option value="foad">Dead</option>
          <option value="all">All</option>
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

      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg text-sm"
          style={{ background: 'var(--brand-blue)', color: '#fff' }}
        >
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkStageUpdate('cold_call')}
            disabled={bulkUpdating}
            className="px-3 py-1 rounded text-sm font-medium bg-white hover:opacity-90 disabled:opacity-50"
            style={{ color: 'var(--brand-blue)' }}
          >
            {bulkUpdating ? 'Updating...' : 'Add to call queue'}
          </button>
          <button
            onClick={() => handleBulkStageUpdate('new_lead')}
            disabled={bulkUpdating}
            className="px-3 py-1 rounded text-sm font-medium border border-white/40 hover:bg-white/10 disabled:opacity-50"
          >
            Move to New Lead
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-2 py-1 rounded text-sm opacity-70 hover:opacity-100"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={leads}
        onRowClick={(item) => router.push(`/dashboard/leads/${item.id}`)}
        emptyMessage="No leads found. Create your first lead to get started."
        isLoading={loading}
        meta={metaText}
        mobileCard={(item) => (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="flex-shrink-0 flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
            >
              {selectedIds.has(item.id) ? (
                <div
                  className="rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: 40, height: 40, backgroundColor: 'var(--brand-blue)' }}
                >
                  ✓
                </div>
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ width: 40, height: 40, backgroundColor: 'var(--brand-blue)' }}
                >
                  {companyInitials(item.companyName)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {item.companyName}
              </div>
              {item.contactName && (
                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {item.contactName}
                </div>
              )}
              {item.email && (
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {item.email}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: STAGE_COLOURS[item.stage] || '#6b7280' }}
                >
                  {STAGE_LABELS[item.stage] || item.stage}
                </span>
                <Badge
                  label={SOURCE_LABELS[item.source] || item.source}
                  variant={SOURCE_VARIANTS[item.source] || 'default'}
                />
              </div>
            </div>
          </div>
        )}
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

      <LeadImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={refetchLeads}
      />
    </div>
  );
}
