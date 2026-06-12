'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Mail, Send, FileText, AlertCircle, Wrench,
  ClipboardList, Building2, ExternalLink, Plus, Folder, File,
  ChevronRight, ChevronLeft, RefreshCw, CheckCircle2, Clock,
  AlertTriangle, Ban, Eye, EyeOff, Lock
} from 'lucide-react';

type Tab = 'overview' | 'documents' | 'tickets' | 'requests' | 'audits' | 'portal-folders';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'portal-folders', label: 'Portal visibility', icon: Lock },
  { key: 'tickets', label: 'Tickets', icon: AlertCircle },
  { key: 'requests', label: 'Service requests', icon: Wrench },
  { key: 'audits', label: 'Audits', icon: ClipboardList },
];

const PORTAL_STATUS_CONFIG = {
  not_invited: { label: 'Not invited', color: 'var(--text-muted)', bg: 'var(--surface-hover)', icon: Clock },
  invited: { label: 'Invite sent', color: 'var(--brand-gold)', bg: 'var(--brand-gold-subtle)', icon: Mail },
  active: { label: 'Active', color: 'var(--status-success)', bg: 'var(--status-success-bg)', icon: CheckCircle2 },
  suspended: { label: 'Suspended', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)', icon: Ban },
};

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'var(--text-muted)', bg: 'var(--surface-hover)' },
  medium: { label: 'Medium', color: 'var(--status-info)', bg: 'var(--status-info-bg)' },
  high: { label: 'High', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  critical: { label: 'Critical', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' },
};

const TICKET_STATUS_CONFIG = {
  open: { label: 'Open', color: 'var(--status-info)' },
  in_progress: { label: 'In progress', color: 'var(--status-warning)' },
  resolved: { label: 'Resolved', color: 'var(--status-success)' },
  closed: { label: 'Closed', color: 'var(--text-muted)' },
};

const SERVICE_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'var(--status-warning)' },
  reviewing: { label: 'Reviewing', color: 'var(--status-info)' },
  approved: { label: 'Approved', color: 'var(--status-success)' },
  completed: { label: 'Completed', color: 'var(--text-muted)' },
  declined: { label: 'Declined', color: 'var(--status-danger)' },
};

function auditScoreColor(score: number) {
  if (score >= 80) return 'var(--status-success)';
  if (score >= 70) return 'var(--status-warning)';
  return 'var(--status-danger)';
}
function auditScoreBg(score: number) {
  if (score >= 80) return 'var(--status-success-bg)';
  if (score >= 70) return 'var(--status-warning-bg)';
  return 'var(--status-danger-bg)';
}

function formatDate(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface ClientData {
  id: string;
  contactName: string;
  contactEmail: string;
  dropboxFolderPath: string | null;
  hiddenFolders: string[];
  portalStatus: 'not_invited' | 'invited' | 'active' | 'suspended';
  invitedAt: string | null;
  lastLoginAt: string | null;
  sites: Array<{
    id: string;
    name: string;
    cellTier: string;
    active: boolean;
    regularHoursSheetRow: { avgWeeklyHours: string; avgWeeklyEarnings: string; avgMonthlyEarnings: string } | null;
  }>;
  tickets: Array<{
    id: string; title: string; description: string; severity: string; status: string;
    createdAt: string; resolvedAt: string | null; assignedTo: { name: string } | null;
  }>;
  serviceRequests: Array<{
    id: string; serviceType: string; description: string; status: string;
    createdAt: string; adminNotes: string | null;
  }>;
  audits: Array<{
    id: string; overallScore: number; auditedAt: string; status: string;
    auditedBy: { name: string }; site: { name: string };
    formType?: string; siteVariant?: string | null;
    categories?: Array<{ key: string; label: string; score: number; note?: string }>;
    rawScore?: number; maxScore?: number;
    binsEmptied?: boolean | null; issuesSpotted?: string | null; needsReview?: string | null;
    photos?: string[]; signatureData?: string | null;
    scorePresentation: number | null; scoreCleanliness: number | null; scoreCompliance: number | null;
    scoreEquipment: number | null; scoreTeamConduct: number | null; headlineNotes: string | null;
  }>;
}

interface DropboxEntry {
  type: 'file' | 'folder';
  name: string;
  pathDisplay: string;
  relativePath: string;
  size?: number;
  modified?: string;
  id: string;
}

export function ClientDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'overview');
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  // Documents state
  const [dropboxPath, setDropboxPath] = useState('');
  const [dropboxEntries, setDropboxEntries] = useState<DropboxEntry[]>([]);
  const [dropboxLoading, setDropboxLoading] = useState(false);
  const [dropboxError, setDropboxError] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((d) => { setClient(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const loadDropbox = useCallback(async (path: string) => {
    setDropboxLoading(true);
    setDropboxError('');
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : '';
      const res = await fetch(`/api/clients/${id}/dropbox${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDropboxEntries(data.entries ?? []);
      setDropboxPath(path);
    } catch (err: unknown) {
      setDropboxError(err instanceof Error ? err.message : 'Failed to load folder');
    } finally {
      setDropboxLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'documents' && client?.dropboxFolderPath) {
      loadDropbox('');
    }
  }, [activeTab, client, loadDropbox]);

  const navigateDropbox = (relativePath: string) => {
    setPathHistory((h) => [...h, dropboxPath]);
    loadDropbox(relativePath);
  };
  const dropboxBack = () => {
    const prev = pathHistory[pathHistory.length - 1] ?? '';
    setPathHistory((h) => h.slice(0, -1));
    loadDropbox(prev);
  };

  const handleInvite = async () => {
    if (!client) return;
    setInviting(true);
    setInviteMsg('');
    try {
      const res = await fetch(`/api/clients/${id}/invite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteMsg(data.warning ?? 'Invite sent successfully');
      setClient((c) => c ? { ...c, portalStatus: 'invited' } : c);
    } catch (err: unknown) {
      setInviteMsg(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  if (loading) return null;
  if (!client) {
    return (
      <div className="p-12 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Client not found.</p>
        <button onClick={() => router.push('/dashboard/clients')} style={{ color: 'var(--brand-blue)', fontSize: '14px', marginTop: '8px' }}>
          Back to clients
        </button>
      </div>
    );
  }

  const statusCfg = PORTAL_STATUS_CONFIG[client.portalStatus];
  const StatusIcon = statusCfg.icon;
  const openTickets = client.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const latestAudit = client.audits[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-6 pt-4 pb-0">
          {/* Back nav */}
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="flex items-center gap-1.5 mb-4"
            style={{ color: 'var(--text-muted)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={14} />
            All clients
          </button>

          {/* Client identity */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {client.contactName}
                </h1>
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                >
                  <StatusIcon size={11} />
                  {statusCfg.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <a
                  href={`mailto:${client.contactEmail}`}
                  style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Mail size={12} />
                  {client.contactEmail}
                </a>
                {client.sites[0] && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={12} />
                    {client.sites[0].name}
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-semibold"
                      style={{ background: 'var(--surface-accent)', color: 'var(--brand-blue)', marginLeft: '4px' }}
                    >
                      Cell {client.sites[0].cellTier}
                    </span>
                  </span>
                )}
                {latestAudit && (
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded"
                    style={{ background: auditScoreBg(latestAudit.overallScore), color: auditScoreColor(latestAudit.overallScore) }}
                  >
                    Audit: {latestAudit.overallScore}/100
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {client.portalStatus !== 'suspended' && (
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: client.portalStatus === 'active' ? 'var(--surface-hover)' : 'var(--brand-blue)',
                    color: client.portalStatus === 'active' ? 'var(--text-secondary)' : '#fff',
                    border: '1px solid',
                    borderColor: client.portalStatus === 'active' ? 'var(--border)' : 'var(--brand-blue)',
                    cursor: inviting ? 'default' : 'pointer',
                    opacity: inviting ? 0.7 : 1,
                  }}
                >
                  <Send size={14} />
                  {client.portalStatus === 'active' ? 'Resend invite' : 'Send invite'}
                </button>
              )}
              {client.portalStatus === 'active' && (
                <a
                  href={process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.signature-cleans.co.uk'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}
                >
                  <ExternalLink size={14} />
                  Portal
                </a>
              )}
            </div>
          </div>

          {inviteMsg && (
            <div
              className="mb-3 px-3 py-2 rounded-lg text-sm"
              style={{
                background: inviteMsg.includes('failed') || inviteMsg.includes('error') ? 'var(--status-danger-bg)' : 'var(--status-success-bg)',
                color: inviteMsg.includes('failed') || inviteMsg.includes('error') ? 'var(--status-danger)' : 'var(--status-success)',
              }}
            >
              {inviteMsg}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-0">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              // Badge counts
              let badge = 0;
              if (key === 'tickets') badge = openTickets.length;
              if (key === 'requests') badge = client.serviceRequests.filter((r) => r.status === 'pending').length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium relative"
                  style={{
                    color: isActive ? 'var(--brand-blue)' : 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: isActive ? '2px solid var(--brand-blue)' : '2px solid transparent',
                    marginBottom: '-1px',
                    transition: 'color 150ms',
                  }}
                >
                  <Icon size={15} />
                  {label}
                  {badge > 0 && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)', minWidth: '18px', textAlign: 'center' }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {activeTab === 'overview' && <OverviewTab client={client} />}
        {activeTab === 'documents' && (
          <DocumentsTab
            client={client}
            entries={dropboxEntries}
            loading={dropboxLoading}
            error={dropboxError}
            currentPath={dropboxPath}
            canGoBack={pathHistory.length > 0}
            onNavigate={navigateDropbox}
            onBack={dropboxBack}
            onRefresh={() => loadDropbox(dropboxPath)}
          />
        )}
        {activeTab === 'portal-folders' && (
          <PortalFoldersTab
            client={client}
            onSaved={(hiddenFolders) => setClient((c) => (c ? { ...c, hiddenFolders } : c))}
          />
        )}
        {activeTab === 'tickets' && <TicketsTab client={client} onRefresh={() => fetch(`/api/clients/${id}`).then(r => r.json()).then(setClient)} />}
        {activeTab === 'requests' && <RequestsTab client={client} />}
        {activeTab === 'audits' && <AuditsTab client={client} />}
      </div>
    </div>
  );
}

// ---- Overview Tab ----
function OverviewTab({ client }: { client: ClientData }) {
  const site = client.sites[0];
  const latestAudit = client.audits[0];
  const scoreCategories = latestAudit
    ? (latestAudit.categories && latestAudit.categories.length > 0
        ? latestAudit.categories.map((c) => ({ label: c.label, score: c.score }))
        : [
            { label: 'Presentation', score: latestAudit.scorePresentation },
            { label: 'Cleanliness', score: latestAudit.scoreCleanliness },
            { label: 'Compliance', score: latestAudit.scoreCompliance },
            { label: 'Equipment', score: latestAudit.scoreEquipment },
            { label: 'Conduct', score: latestAudit.scoreTeamConduct },
          ].filter((c): c is { label: string; score: number } => c.score != null))
    : [];

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: '900px' }}>
      {/* Contract details */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Contract
        </h3>
        {site ? (
          <div className="space-y-3">
            {[
              { label: 'Site', value: site.name },
              { label: 'Cell tier', value: `Cell ${site.cellTier}` },
              { label: 'Status', value: site.active ? 'Active' : 'Inactive' },
              site.regularHoursSheetRow && { label: 'Weekly hours', value: `${parseFloat(site.regularHoursSheetRow.avgWeeklyHours).toFixed(1)} hrs` },
              site.regularHoursSheetRow && { label: 'Weekly revenue', value: `£${parseFloat(site.regularHoursSheetRow.avgWeeklyEarnings).toFixed(2)}` },
              site.regularHoursSheetRow && { label: 'Monthly revenue', value: `£${parseFloat(site.regularHoursSheetRow.avgMonthlyEarnings).toFixed(2)}` },
            ].filter(Boolean).map((row) => {
              const r = row as { label: string; value: string };
              return (
                <div key={r.label} className="flex justify-between items-baseline">
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{r.value}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No site linked to this client account.</p>
        )}
      </div>

      {/* Portal details */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
          Portal access
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Status', value: PORTAL_STATUS_CONFIG[client.portalStatus].label },
            { label: 'Invited', value: client.invitedAt ? new Date(client.invitedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not yet' },
            { label: 'Last login', value: client.lastLoginAt ? new Date(client.lastLoginAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never' },
            { label: 'Dropbox folder', value: client.dropboxFolderPath ? 'Configured' : 'Not set' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-baseline">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest audit */}
      {latestAudit && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', gridColumn: 'span 2' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Latest audit
            </h3>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {new Date(latestAudit.auditedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {latestAudit.auditedBy.name}
              </span>
              <span
                className="text-sm font-bold px-3 py-1 rounded-lg"
                style={{ background: auditScoreBg(latestAudit.overallScore), color: auditScoreColor(latestAudit.overallScore) }}
              >
                {latestAudit.overallScore}/100
              </span>
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {scoreCategories.map(({ label, score }) => (
              <div key={label} className="text-center">
                <div
                  className="mx-auto rounded-lg flex items-center justify-center text-base font-bold mb-1.5"
                  style={{
                    width: '48px', height: '48px',
                    background: auditScoreBg(score * 10),
                    color: auditScoreColor(score * 10),
                  }}
                >
                  {score}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
              </div>
            ))}
          </div>
          {latestAudit.headlineNotes && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              {latestAudit.headlineNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Documents Tab ----
function DocumentsTab({
  client, entries, loading, error, currentPath, canGoBack, onNavigate, onBack, onRefresh
}: {
  client: ClientData;
  entries: DropboxEntry[];
  loading: boolean;
  error: string;
  currentPath: string;
  canGoBack: boolean;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  if (!client.dropboxFolderPath) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-xl"
        style={{ border: '1px dashed var(--border)' }}
      >
        <Folder size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No Dropbox folder configured</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Set the Dropbox folder path in client settings to browse documents.
        </p>
      </div>
    );
  }

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div>
      {/* Breadcrumb + controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span
              className="cursor-pointer"
              style={{ color: currentPath ? 'var(--brand-blue)' : 'var(--text-primary)', fontWeight: currentPath ? 400 : 600 }}
              onClick={() => { onBack(); }}
            >
              {client.contactName}
            </span>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={12} />
                <span style={{ color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === pathParts.length - 1 ? 600 : 400 }}>
                  {part}
                </span>
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>This folder is empty</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors duration-100"
              style={{
                borderBottom: idx < entries.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: entry.type === 'folder' ? 'pointer' : 'default',
              }}
              onClick={() => entry.type === 'folder' && onNavigate(entry.relativePath)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {entry.type === 'folder' ? (
                <Folder size={16} style={{ color: 'var(--brand-gold)', flexShrink: 0 }} />
              ) : (
                <File size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', flex: 1 }}>{entry.name}</span>
              {entry.modified && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatDateShort(entry.modified)}
                </span>
              )}
              {entry.size != null && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
                  {formatBytes(entry.size)}
                </span>
              )}
              {entry.type === 'folder' && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Portal Visibility Tab ----
// Navigable Dropbox browser. Every file/folder gets a Visible/Hidden toggle.
// "Hidden" = the entry's relativePath is in the working set (saved to hiddenFolders).
function PortalFoldersTab({
  client, onSaved,
}: {
  client: ClientData;
  onSaved: (hiddenFolders: string[]) => void;
}) {
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Working set of hidden relative paths (files OR folders, at any depth).
  const [hidden, setHidden] = useState<Set<string>>(new Set(client.hiddenFolders ?? []));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : '';
      const res = await fetch(`/api/clients/${client.id}/dropbox${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries(data.entries ?? []);
      setCurrentPath(path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    if (!client.dropboxFolderPath) { setLoading(false); return; }
    loadFolder('');
  }, [client.dropboxFolderPath, loadFolder]);

  const toggle = (relativePath: string) => {
    setSavedMsg('');
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(relativePath)) next.delete(relativePath); else next.add(relativePath);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    setError('');
    try {
      const hiddenFolders = Array.from(hidden);
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenFolders }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Save failed');
      }
      onSaved(hiddenFolders);
      setSavedMsg('Visibility saved');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!client.dropboxFolderPath) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-xl"
        style={{ border: '1px dashed var(--border)' }}
      >
        <Folder size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No Dropbox folder mapped</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Map a Dropbox folder first to control what this client sees.
        </p>
      </div>
    );
  }

  const initial = new Set(client.hiddenFolders ?? []);
  const dirty = initial.size !== hidden.size || Array.from(hidden).some((f) => !initial.has(f));
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const goTo = (path: string) => { if (!loading) loadFolder(path); };
  const goUp = () => {
    if (pathParts.length === 0) return;
    goTo(pathParts.slice(0, -1).join('/'));
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
          Portal visibility
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Browse this client&apos;s Dropbox and toggle what they can see in their portal.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Hiding a folder hides everything inside it. Hiding a file hides just that file.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)' }}>
            {error}
          </div>
        )}

        {/* Breadcrumbs + up affordance */}
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
          {pathParts.length > 0 && (
            <button
              type="button"
              onClick={goUp}
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: loading ? 'default' : 'pointer', fontSize: '13px' }}
            >
              <ChevronLeft size={14} />
              Up
            </button>
          )}
          <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span
              onClick={() => goTo('')}
              style={{ color: currentPath ? 'var(--brand-blue)' : 'var(--text-primary)', fontWeight: currentPath ? 400 : 600, cursor: currentPath ? 'pointer' : 'default' }}
            >
              Home
            </span>
            {pathParts.map((part, i) => {
              const isLast = i === pathParts.length - 1;
              const target = pathParts.slice(0, i + 1).join('/');
              return (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <span
                    onClick={() => !isLast && goTo(target)}
                    style={{ color: isLast ? 'var(--text-primary)' : 'var(--brand-blue)', fontWeight: isLast ? 600 : 400, cursor: isLast ? 'default' : 'pointer' }}
                  >
                    {part}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>This folder is empty</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {entries.map((entry, idx) => {
              const isHidden = hidden.has(entry.relativePath);
              const isFolder = entry.type === 'folder';
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < entries.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  {isFolder ? (
                    <Folder size={16} style={{ color: isHidden ? 'var(--text-muted)' : 'var(--brand-gold)', flexShrink: 0 }} />
                  ) : (
                    <File size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                  <span
                    onClick={() => isFolder && goTo(entry.relativePath)}
                    style={{
                      fontSize: '14px',
                      color: isHidden ? 'var(--text-muted)' : 'var(--text-primary)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: isFolder ? 'pointer' : 'default',
                    }}
                  >
                    {entry.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(entry.relativePath)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{
                      background: isHidden ? 'var(--surface-hover)' : 'var(--status-success-bg)',
                      color: isHidden ? 'var(--text-muted)' : 'var(--status-success)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    {isHidden ? 'Hidden' : 'Visible'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--brand-blue)',
              color: '#fff',
              border: 'none',
              cursor: saving || !dirty ? 'default' : 'pointer',
              opacity: saving || !dirty ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {savedMsg && (
            <span className="flex items-center gap-1.5" style={{ fontSize: '13px', color: 'var(--status-success)' }}>
              <CheckCircle2 size={14} />
              {savedMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Tickets Tab ----
function TicketsTab({ client, onRefresh }: { client: ClientData; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium' as string, siteId: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientAccountId: client.id,
        siteId: form.siteId || client.sites[0]?.id || null,
        title: form.title,
        description: form.description,
        severity: form.severity,
      }),
    });
    setSaving(false);
    setShowNew(false);
    setForm({ title: '', description: '', severity: 'medium', siteId: '' });
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Tickets ({client.tickets.length})
        </h3>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--brand-blue)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={14} />
          New ticket
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-4 mb-4"
          style={{ border: '1px solid var(--brand-blue)', background: 'var(--surface-accent)' }}
        >
          <div className="space-y-3">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description *</label>
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Full details of the issue"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none' }}
              >
                {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--brand-blue)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Create ticket'}
            </button>
          </div>
        </form>
      )}

      {client.tickets.length === 0 ? (
        <div className="py-16 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No tickets yet</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {client.tickets.map((ticket, idx) => {
            const sev = SEVERITY_CONFIG[ticket.severity as keyof typeof SEVERITY_CONFIG];
            const stat = TICKET_STATUS_CONFIG[ticket.status as keyof typeof TICKET_STATUS_CONFIG];
            return (
              <div
                key={ticket.id}
                className="px-4 py-4"
                style={{ borderBottom: idx < client.tickets.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{ticket.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sev?.bg, color: sev?.color }}>{sev?.label}</span>
                      <span className="text-xs font-medium" style={{ color: stat?.color }}>{stat?.label}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }} className="line-clamp-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(ticket.createdAt)}</span>
                      {ticket.assignedTo && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned: {ticket.assignedTo.name}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Service Requests Tab ----
function RequestsTab({ client }: { client: ClientData }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Service requests ({client.serviceRequests.length})
        </h3>
      </div>
      {client.serviceRequests.length === 0 ? (
        <div className="py-16 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No service requests</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {client.serviceRequests.map((req, idx) => {
            const stat = SERVICE_STATUS_CONFIG[req.status as keyof typeof SERVICE_STATUS_CONFIG];
            return (
              <div
                key={req.id}
                className="px-4 py-4"
                style={{ borderBottom: idx < client.serviceRequests.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{req.serviceType}</span>
                      <span className="text-xs font-medium" style={{ color: stat?.color }}>{stat?.label}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }} className="line-clamp-2">{req.description}</p>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{formatDate(req.createdAt)}</span>
                    {req.adminNotes && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                        Note: {req.adminNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Audits Tab ----
function AuditsTab({ client }: { client: ClientData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedAudit = client.audits.find((a) => a.id === selected);

  const CATEGORY_LABELS: Record<string, string> = {
    scorePresentation: 'Presentation',
    scoreCleanliness: 'Cleanliness',
    scoreCompliance: 'Compliance',
    scoreEquipment: 'Equipment',
    scoreTeamConduct: 'Conduct',
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 1fr' : '1fr' }}>
      {/* Audit list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Audit history ({client.audits.length})
          </h3>
          <a
            href={`/dashboard/clients/${client.id}/audit/new${client.sites[0] ? `?siteId=${client.sites[0].id}` : ''}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--brand-blue)', color: '#fff', textDecoration: 'none', display: 'inline-flex' }}
          >
            <Plus size={14} />
            Start audit
          </a>
        </div>
        {client.audits.length === 0 ? (
          <div className="py-16 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No audits yet</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {client.audits.map((audit, idx) => (
              <div
                key={audit.id}
                className="flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors duration-100"
                style={{
                  borderBottom: idx < client.audits.length - 1 ? '1px solid var(--border)' : 'none',
                  background: selected === audit.id ? 'var(--surface-active)' : 'transparent',
                }}
                onClick={() => setSelected(selected === audit.id ? null : audit.id)}
                onMouseEnter={(e) => { if (selected !== audit.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (selected !== audit.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span
                  className="text-sm font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: auditScoreBg(audit.overallScore), color: auditScoreColor(audit.overallScore), minWidth: '44px', textAlign: 'center' }}
                >
                  {audit.overallScore}
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date(audit.auditedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {audit.site.name} · {audit.auditedBy.name}
                    {audit.status === 'draft' && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning)' }}>Draft</span>
                    )}
                  </div>
                </div>
                <Eye size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit detail panel */}
      {selectedAudit && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {new Date(selectedAudit.auditedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h4>
            <span
              className="text-base font-bold px-3 py-1.5 rounded-lg"
              style={{ background: auditScoreBg(selectedAudit.overallScore), color: auditScoreColor(selectedAudit.overallScore) }}
            >
              {selectedAudit.overallScore}/100
            </span>
          </div>
          {selectedAudit.headlineNotes && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {selectedAudit.headlineNotes}
            </p>
          )}
          <div className="space-y-3">
            {(
              selectedAudit.categories && selectedAudit.categories.length > 0
                ? selectedAudit.categories.map((c) => ({ label: c.label, score: c.score, note: c.note }))
                : (['scorePresentation', 'scoreCleanliness', 'scoreCompliance', 'scoreEquipment', 'scoreTeamConduct'] as const)
                    .map((field) => ({ label: CATEGORY_LABELS[field], score: selectedAudit[field], note: undefined as string | undefined }))
                    .filter((c): c is { label: string; score: number; note: string | undefined } => c.score != null)
            ).map((c, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{c.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: auditScoreColor(c.score * 10) }}>{c.score}/10</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--surface-hover)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.score * 10}%`, background: auditScoreColor(c.score * 10), transition: 'width 400ms cubic-bezier(0.23,1,0.32,1)' }}
                  />
                </div>
                {c.note && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{c.note}</p>}
              </div>
            ))}
          </div>

          {/* Issues / actions / bins */}
          {(selectedAudit.issuesSpotted || selectedAudit.needsReview || selectedAudit.binsEmptied != null) && (
            <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              {selectedAudit.binsEmptied != null && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Bins emptied:</strong> {selectedAudit.binsEmptied ? 'Yes' : 'No'}
                </p>
              )}
              {selectedAudit.issuesSpotted && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><strong>Issues:</strong> {selectedAudit.issuesSpotted}</p>
              )}
              {selectedAudit.needsReview && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><strong>Needs review:</strong> {selectedAudit.needsReview}</p>
              )}
            </div>
          )}

          {/* Photos */}
          {selectedAudit.photos && selectedAudit.photos.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Photos</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedAudit.photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`audit photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                ))}
              </div>
            </div>
          )}

          {/* Signature */}
          {selectedAudit.signatureData && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Auditor signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedAudit.signatureData} alt="signature" style={{ maxWidth: 220, height: 'auto', background: '#fff', borderRadius: 6, border: '1px solid var(--border)' }} />
            </div>
          )}
          {selectedAudit.status === 'draft' && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={async () => {
                  await fetch(`/api/audits/${selectedAudit.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'published' }),
                  });
                }}
                className="w-full py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--status-success)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Publish to client portal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
