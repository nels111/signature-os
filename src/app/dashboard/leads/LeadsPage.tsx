'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  new_lead: 'New Lead',
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  linkedin: 'LinkedIn',
  follow_up_sequence: 'Follow-up Sequence',
  not_interested_for_now: 'Not Interested for Now',
  contact_when_contract_up: 'Contact When Contract Up',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_attended: 'Meeting Attended',
  quote_delivered: 'Quote Delivered',
  foad: 'FOAD',
};

const STAGE_COLOURS: Record<string, string> = {
  new_lead: '#6b7280',
  cold_call: 'var(--stage-cold-call)',
  cold_email: 'var(--stage-cold-email)',
  linkedin: 'var(--stage-linkedin)',
  follow_up_sequence: 'var(--stage-follow-up)',
  not_interested_for_now: 'var(--stage-not-interested)',
  contact_when_contract_up: 'var(--stage-cwccu)',
  meeting_scheduled: 'var(--stage-meeting)',
  meeting_attended: 'var(--stage-attended)',
  quote_delivered: 'var(--status-success)',
  foad: 'var(--stage-foad)',
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Proper CSV line parser — handles quoted fields containing commas and escaped quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCsvImport = useCallback(async (file: File) => {
    setImportStatus('parsing');
    setImportMessage('');
    try {
      // Strip UTF-8 BOM if present, normalise CRLF → LF
      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = cleanText.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

      // Find the real header row — Apollo exports have a label row before it.
      // Scan up to 3 rows and pick the first one containing 'Company Name' or 'First Name'.
      const HEADER_SIGNALS = ['company name', 'first name', 'last name', 'companyname'];
      let headerLineIdx = 0;
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const cells = parseCSVLine(lines[i]).map(c => c.toLowerCase());
        if (HEADER_SIGNALS.some(s => cells.includes(s))) { headerLineIdx = i; break; }
      }
      if (lines.length < headerLineIdx + 2) throw new Error('CSV must have a header row and at least one data row');

      const headers = parseCSVLine(lines[headerLineIdx]);
      const leads = lines.slice(headerLineIdx + 1).filter(l => l.trim()).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });

        // Apollo split-name columns: merge First Name + Last Name → Contact Name
        if (!row['contactName'] && !row['Contact Name'] && (row['First Name'] || row['Last Name'])) {
          row['Contact Name'] = [row['First Name'], row['Last Name']].filter(Boolean).join(' ').trim();
        }
        return row;
      });

      setImportStatus('importing');
      setImportMessage(`Importing ${leads.length} leads...`);

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportStatus('done');
      setImportMessage(`${data.imported} leads imported successfully`);
      refetchLeads();
    } catch (err) {
      setImportStatus('error');
      setImportMessage(err instanceof Error ? err.message : 'Import failed');
    }
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Leads
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {total} lead{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setImportStatus('idle'); setImportMessage(''); setShowImportModal(true); }}
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
          <option value="cold_call">Cold Call</option>
          <option value="cold_email">Cold Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="follow_up_sequence">Follow-up Sequence</option>
          <option value="not_interested_for_now">Not Interested for Now</option>
          <option value="contact_when_contract_up">Contact When Contract Up</option>
          <option value="meeting_scheduled">Meeting Scheduled</option>
          <option value="meeting_attended">Meeting Attended</option>
          <option value="quote_delivered">Quote Delivered</option>
          <option value="foad">FOAD</option>
          <option value="all">All (inc. FOAD)</option>
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

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Leads from CSV"
        maxWidth="480px"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Upload a CSV file. Apollo exports are supported natively. Required columns: <strong>Company Name</strong>, <strong>Contact Name</strong> (or <strong>First Name</strong> + <strong>Last Name</strong>). Optional: email, phone, industry, notes.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            All imported leads will be created with stage: <strong>New Lead</strong>.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvImport(file);
              e.target.value = '';
            }}
          />

          {importStatus === 'idle' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 text-sm rounded-lg border-2 border-dashed hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Click to select CSV file
            </button>
          )}

          {(importStatus === 'parsing' || importStatus === 'importing') && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
              {importStatus === 'parsing' ? 'Parsing CSV...' : importMessage}
            </div>
          )}

          {importStatus === 'done' && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: '#22c55e' }}>{importMessage}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setImportStatus('idle'); fileInputRef.current?.click(); }}
                  className="flex-1 py-2 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Import another file
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-2 text-sm text-white rounded-lg"
                  style={{ backgroundColor: 'var(--brand-blue)' }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {importStatus === 'error' && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: '#ef4444' }}>{importMessage}</p>
              <button
                onClick={() => { setImportStatus('idle'); setImportMessage(''); }}
                className="w-full py-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
