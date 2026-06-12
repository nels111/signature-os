'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ClipboardCheck,
  Plus,
  ChevronRight,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';

interface LatestAudit {
  id: string;
  overallScore: number;
  status: 'draft' | 'published';
  auditedAt: string;
}

interface SiteRow {
  id: string;
  name: string;
  cellTier: string;
  clientAccountId: string | null;
  clientName: string | null;
  latestAudit: LatestAudit | null;
}

interface RecentRow {
  id: string;
  overallScore: number;
  status: 'draft' | 'published';
  auditedAt: string;
  formType: string;
  siteId: string;
  siteName: string;
  clientAccountId: string | null;
  auditorName: string | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--status-success)';
  if (score >= 70) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'var(--status-success-bg)';
  if (score >= 70) return 'var(--status-warning-bg)';
  return 'var(--status-danger-bg)';
}

function scoreBandLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 70) return 'Action plan';
  return 'Intervention';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FILTERS = [
  { value: '', label: 'All sites' },
  { value: 'due', label: 'Needs audit' },
  { value: 'red', label: 'Below 70' },
  { value: 'amber', label: '70–79' },
  { value: 'green', label: '80+' },
];

export function AuditsPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audits/overview');
      const data = await res.json();
      setSites(data.sites ?? []);
      setRecent(data.recent ?? []);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.clientName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const score = s.latestAudit?.overallScore;
      switch (filter) {
        case 'due':
          return !s.latestAudit;
        case 'red':
          return score !== undefined && score < 70;
        case 'amber':
          return score !== undefined && score >= 70 && score < 80;
        case 'green':
          return score !== undefined && score >= 80;
        default:
          return true;
      }
    });
  }, [sites, search, filter]);

  const auditedCount = sites.filter((s) => s.latestAudit).length;
  const needsCount = sites.length - auditedCount;

  // Every site can be audited — audits are site-based, no client account required.
  const newAuditHref = (s: SiteRow) => `/dashboard/audits/new?siteId=${s.id}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Page header */}
      <div
        className="sticky top-0 z-10"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'var(--brand-blue-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ClipboardCheck size={17} style={{ color: 'var(--brand-blue)' }} strokeWidth={2} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Audits
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {sites.length} {sites.length === 1 ? 'site' : 'sites'}
                <span style={{ marginLeft: '8px', color: 'var(--status-success)' }}>
                  · {auditedCount} audited
                </span>
                {needsCount > 0 && (
                  <span style={{ marginLeft: '8px', color: 'var(--status-warning)' }}>
                    · {needsCount} need an audit
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 mt-4">
            <div className="relative w-full max-w-xs">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search sites or clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: filter === f.value ? 'var(--brand-blue)' : 'var(--surface-hover)',
                    color: filter === f.value ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: filter === f.value ? 'var(--brand-blue)' : 'transparent',
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

      <div className="px-6 py-4" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
        {/* Sites table */}
        <section>
          <h2
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '10px',
            }}
          >
            Sites
          </h2>

          {loading && sites.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg animate-pulse"
                  style={{ background: 'var(--surface)', opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : filteredSites.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-xl"
              style={{ border: '1px dashed var(--border)' }}
            >
              <ClipboardCheck size={30} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>
                {search || filter ? 'No sites match' : 'No active sites'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                {search || filter ? 'Try clearing filters' : 'Sites appear here once they are set up'}
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {/* Tap a site to start its audit — responsive cards (mobile + desktop) */}
              {filteredSites.map((s, idx) => {
                const audit = s.latestAudit;
                const href = newAuditHref(s);
                return (
                  <Link
                    key={s.id}
                    href={href}
                    className="flex items-center gap-3 transition-colors duration-100"
                    style={{
                      padding: '14px 16px',
                      borderBottom: idx < filteredSites.length - 1 ? '1px solid var(--border)' : 'none',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Cell tier */}
                    <span
                      className="flex-shrink-0 font-semibold rounded"
                      style={{ background: 'var(--surface-accent)', color: 'var(--brand-blue)', fontSize: '10px', padding: '2px 6px' }}
                    >
                      {s.cellTier}
                    </span>

                    {/* Site name + sub */}
                    <div className="min-w-0" style={{ flex: 1 }}>
                      <div className="truncate" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {s.name || 'Unnamed site'}
                      </div>
                      <div className="truncate" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {audit ? `${scoreBandLabel(audit.overallScore)} · last audit ${formatDate(audit.auditedAt)}` : (s.clientName ?? 'Due an audit')}
                      </div>
                    </div>

                    {/* Score (or Due) + start affordance */}
                    <div className="flex-shrink-0 flex items-center" style={{ gap: '8px' }}>
                      {audit ? (
                        <span
                          className="font-semibold rounded"
                          style={{ background: scoreBg(audit.overallScore), color: scoreColor(audit.overallScore), fontSize: '13px', padding: '3px 9px' }}
                        >
                          {audit.overallScore}<span style={{ opacity: 0.7, fontWeight: 500 }}>/100</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-warning)' }}>Due</span>
                      )}
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-lg"
                        style={{ background: 'var(--brand-blue)', color: '#fff', width: 30, height: 30 }}
                        aria-label="Start audit"
                      >
                        <Plus size={16} strokeWidth={2.5} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent audit history */}
        <section>
          <h2
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '10px',
            }}
          >
            Recent audits
          </h2>

          {recent.length === 0 ? (
            <div
              className="flex items-center justify-center py-12 rounded-xl"
              style={{ border: '1px dashed var(--border)' }}
            >
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audits recorded yet</p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {recent.map((a, idx) => (
                <div
                  key={a.id}
                  className="grid items-center cursor-pointer transition-colors duration-100"
                  style={{
                    gridTemplateColumns: '1fr 90px 120px 130px 30px',
                    padding: '0 16px',
                    borderBottom: idx < recent.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onClick={() => router.push(`/dashboard/audits/${a.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="py-3 flex flex-col justify-center min-w-0">
                    <span className="truncate" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {a.siteName}
                    </span>
                    <span className="truncate" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {a.formType === 'small' ? 'Small site audit' : 'Large site audit'}
                      {a.auditorName ? ` · ${a.auditorName}` : ''}
                    </span>
                  </div>

                  <div className="py-3 flex items-center">
                    <span
                      className="font-semibold rounded"
                      style={{
                        background: scoreBg(a.overallScore),
                        color: scoreColor(a.overallScore),
                        fontSize: '12px',
                        padding: '3px 8px',
                      }}
                    >
                      {a.overallScore}
                    </span>
                  </div>

                  <div className="py-3 flex items-center">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(a.auditedAt)}
                    </span>
                  </div>

                  <div className="py-3 flex items-center">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full font-medium"
                      style={{
                        fontSize: '11px',
                        padding: '3px 9px',
                        background: a.status === 'published' ? 'var(--status-success-bg)' : 'var(--surface-hover)',
                        color: a.status === 'published' ? 'var(--status-success)' : 'var(--text-secondary)',
                      }}
                    >
                      {a.status === 'published' ? <CheckCircle2 size={11} /> : <FileEdit size={11} />}
                      {a.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-end">
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
