'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Mail, Building2, AlertCircle, CheckCircle2, Clock, Ban, ChevronRight } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  cellTier: string;
  active: boolean;
}

interface ClientAccount {
  id: string;
  contactName: string;
  contactEmail: string;
  portalStatus: 'not_invited' | 'invited' | 'active' | 'suspended';
  invitedAt: string | null;
  lastLoginAt: string | null;
  sites: Site[];
  openTickets: number;
  pendingRequests: number;
  latestAudit: { overallScore: number; auditedAt: string; siteId: string } | null;
}

const PORTAL_STATUS_CONFIG = {
  not_invited: { label: 'Not invited', color: 'var(--text-muted)', bg: 'var(--surface-hover)', icon: Clock },
  invited: { label: 'Invite sent', color: 'var(--brand-gold)', bg: 'var(--brand-gold-subtle)', icon: Mail },
  active: { label: 'Active', color: 'var(--status-success)', bg: 'var(--status-success-bg)', icon: CheckCircle2 },
  suspended: { label: 'Suspended', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)', icon: Ban },
};

function auditScoreColor(score: number): string {
  if (score >= 80) return 'var(--status-success)';
  if (score >= 70) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

function auditScoreBg(score: number): string {
  if (score >= 80) return 'var(--status-success-bg)';
  if (score >= 70) return 'var(--status-warning-bg)';
  return 'var(--status-danger-bg)';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const STATUS_FILTERS = [
  { value: '', label: 'All clients' },
  { value: 'active', label: 'Active portal' },
  { value: 'invited', label: 'Invite sent' },
  { value: 'not_invited', label: 'Not invited' },
  { value: 'suspended', label: 'Suspended' },
];

export function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchClients, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchClients, search]);

  const openTicketsTotal = clients.reduce((s, c) => s + c.openTickets, 0);
  const pendingRequestsTotal = clients.reduce((s, c) => s + c.pendingRequests, 0);
  const activeClients = clients.filter((c) => c.portalStatus === 'active').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Page header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Clients
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {total} {total === 1 ? 'client account' : 'client accounts'}
                {openTicketsTotal > 0 && (
                  <span style={{ color: 'var(--status-danger)', marginLeft: '8px' }}>
                    · {openTicketsTotal} open {openTicketsTotal === 1 ? 'ticket' : 'tickets'}
                  </span>
                )}
                {pendingRequestsTotal > 0 && (
                  <span style={{ color: 'var(--status-warning)', marginLeft: '8px' }}>
                    · {pendingRequestsTotal} pending {pendingRequestsTotal === 1 ? 'request' : 'requests'}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--brand-blue)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-blue-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-blue)'; }}
            >
              <Plus size={16} />
              Add client
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 mt-4">
            {/* Search */}
            <div className="relative w-full max-w-xs">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search clients or sites..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Status filter pills — horizontally scrollable, no visible scrollbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
                overflowY: 'hidden',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                paddingBottom: '2px',
              }}
            >
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: statusFilter === f.value ? 'var(--brand-blue)' : 'var(--surface-hover)',
                    color: statusFilter === f.value ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: statusFilter === f.value ? 'var(--brand-blue)' : 'transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {loading && clients.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg animate-pulse"
                style={{ background: 'var(--surface)', opacity: 1 - i * 0.15 }}
              />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-xl"
            style={{ border: '1px dashed var(--border)' }}
          >
            <Building2 size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>
              {search || statusFilter ? 'No clients match' : 'No client accounts yet'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {search || statusFilter ? 'Try clearing filters' : 'Add a client to get started'}
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {/* Table header */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: '1fr 180px 140px 80px 100px 40px',
                padding: '0 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {['Client', 'Site', 'Portal status', 'Tickets', 'Latest audit', ''].map((h, i) => (
                <div key={i} className="py-3 flex items-center">{h}</div>
              ))}
            </div>

            {/* Rows */}
            {clients.map((client, idx) => {
              const statusCfg = PORTAL_STATUS_CONFIG[client.portalStatus];
              const StatusIcon = statusCfg.icon;
              const primarySite = client.sites[0];
              const audit = client.latestAudit;

              return (
                <div
                  key={client.id}
                  className="grid cursor-pointer transition-colors duration-100"
                  style={{
                    gridTemplateColumns: '1fr 180px 140px 80px 100px 40px',
                    padding: '0 16px',
                    borderBottom: idx < clients.length - 1 ? '1px solid var(--border)' : 'none',
                    background: 'transparent',
                  }}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Client name + email */}
                  <div className="py-4 flex flex-col justify-center min-w-0">
                    <span
                      style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}
                      className="truncate"
                    >
                      {client.contactName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }} className="truncate">
                      {client.contactEmail}
                    </span>
                  </div>

                  {/* Site */}
                  <div className="py-4 flex items-center min-w-0">
                    {primarySite ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--surface-accent)', color: 'var(--brand-blue)', fontSize: '10px' }}
                        >
                          {primarySite.cellTier}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }} className="truncate">
                          {primarySite.name}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No site linked</span>
                    )}
                  </div>

                  {/* Portal status */}
                  <div className="py-4 flex items-center">
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}
                    >
                      <StatusIcon size={12} strokeWidth={2} />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Open tickets */}
                  <div className="py-4 flex items-center">
                    {client.openTickets > 0 ? (
                      <span
                        className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: client.openTickets >= 3 ? 'var(--status-danger)' : 'var(--status-warning)' }}
                      >
                        <AlertCircle size={13} />
                        {client.openTickets}
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>0</span>
                    )}
                  </div>

                  {/* Latest audit score */}
                  <div className="py-4 flex items-center">
                    {audit ? (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded"
                        style={{
                          background: auditScoreBg(audit.overallScore),
                          color: auditScoreColor(audit.overallScore),
                        }}
                      >
                        {audit.overallScore}
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No audit</span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="py-4 flex items-center justify-end">
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between mt-4">
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page === 1 ? 'default' : 'pointer',
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: page * 20 >= total ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page * 20 >= total ? 'default' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchClients(); }}
        />
      )}
    </div>
  );
}

// Inline create modal — lightweight form
function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ contactName: '', contactEmail: '', dropboxFolderPath: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dropbox folder picker state
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Dropbox folders on mount
  useEffect(() => {
    fetch('/api/dropbox/client-folders')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setFolders(d.folders ?? []);
      })
      .catch((e: unknown) => setFoldersError(e instanceof Error ? e.message : 'Failed to load folders'))
      .finally(() => setFoldersLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(folderSearch.toLowerCase())
  );

  const selectFolder = (folder: { name: string; path: string }) => {
    setSelectedFolderName(folder.name);
    setForm((f) => ({ ...f, dropboxFolderPath: folder.path }));
    setFolderSearch('');
    setDropdownOpen(false);
  };

  const clearFolder = () => {
    setSelectedFolderName('');
    setForm((f) => ({ ...f, dropboxFolderPath: '' }));
    setFolderSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create client');
      }
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-modal)' }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
          Add client account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact name */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Contact name<span style={{ color: 'var(--status-danger)', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Jane Smith"
              required
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>

          {/* Contact email */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Contact email<span style={{ color: 'var(--status-danger)', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="email"
              placeholder="jane@example.com"
              required
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>

          {/* Dropbox folder picker */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Dropbox folder
            </label>

            {foldersError ? (
              <p style={{ fontSize: '12px', color: 'var(--status-danger)' }}>
                Could not load folders: {foldersError}
              </p>
            ) : foldersLoading ? (
              <div
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-muted)' }}
              >
                Loading folders...
              </div>
            ) : selectedFolderName ? (
              /* Selected state */
              <div
                className="w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2"
                style={{ border: '1px solid var(--brand-blue)', background: 'var(--background)', color: 'var(--text-primary)' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFolderName}
                </span>
                <button
                  type="button"
                  onClick={clearFolder}
                  style={{ flexShrink: 0, fontSize: '16px', lineHeight: 1, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            ) : (
              /* Combobox */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={folderSearch}
                  onChange={(e) => { setFolderSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                  onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredFolders.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        No folders match
                      </div>
                    ) : (
                      filteredFolders.map((folder) => (
                        <button
                          key={folder.path}
                          type="button"
                          onClick={() => selectFolder(folder)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 12px',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-subtle, var(--border))',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-accent)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          {folder.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: 'var(--status-danger)' }}>{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--brand-blue)', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
