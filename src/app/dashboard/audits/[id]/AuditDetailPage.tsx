'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  FileEdit,
  Send,
  ImageIcon,
  PenLine,
} from 'lucide-react';

interface ScoredCategory {
  key: string;
  label: string;
  score: number;
  note?: string;
}

interface Audit {
  id: string;
  siteId: string;
  formType: string;
  siteVariant: string | null;
  categories: ScoredCategory[];
  rawScore: number;
  maxScore: number;
  overallScore: number;
  binsEmptied: boolean | null;
  issuesSpotted: string | null;
  needsReview: string | null;
  headlineNotes: string | null;
  signatureData: string | null;
  photos: string[] | null;
  status: 'draft' | 'published';
  auditedAt: string;
  publishedAt: string | null;
  dropboxPdfPath: string | null;
  auditedBy: { id: string; name: string | null } | null;
  site: { id: string; name: string; cellTier?: string } | null;
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
function overallBand(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 70) return 'Action plan required';
  return 'Immediate intervention';
}
function catColor(score: number): string {
  if (score >= 8) return 'var(--status-success)';
  if (score >= 6) return 'var(--brand-gold)';
  if (score >= 4) return 'var(--status-warning)';
  return 'var(--status-danger)';
}
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AuditDetailPage({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audits/${auditId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load audit');
      }
      const data = await res.json();
      setAudit({
        ...data,
        categories: Array.isArray(data.categories) ? data.categories : [],
        photos: Array.isArray(data.photos) ? data.photos : [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handlePublish = async () => {
    if (!audit) return;
    setPublishing(true);
    setError('');
    try {
      const res = await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to publish');
      }
      await fetchAudit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse" style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div className="h-6 rounded w-40" style={{ background: 'var(--border)' }} />
        <div className="h-24 rounded" style={{ background: 'var(--surface)' }} />
        <div className="h-64 rounded" style={{ background: 'var(--surface)' }} />
      </div>
    );
  }

  if (error && !audit) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '24px' }}>
        <Link
          href="/dashboard/audits"
          className="inline-flex items-center gap-1.5"
          style={{ fontSize: '13px', color: 'var(--brand-blue)', textDecoration: 'none', marginBottom: '16px' }}
        >
          <ArrowLeft size={15} /> Back to audits
        </Link>
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ border: '1px dashed var(--border)' }}
        >
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Could not load this audit</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!audit) return null;

  const photos = audit.photos ?? [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4">
          <button
            onClick={() => router.push('/dashboard/audits')}
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: '13px', color: 'var(--brand-blue)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '12px', padding: 0 }}
          >
            <ArrowLeft size={15} /> Back to audits
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {audit.site?.name ?? 'Site audit'}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {audit.formType === 'small' ? 'Small site audit' : 'Large site audit'}
                {' · '}
                {formatDateTime(audit.auditedAt)}
                {audit.auditedBy?.name ? ` · ${audit.auditedBy.name}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full font-medium"
                style={{
                  fontSize: '12px',
                  padding: '5px 11px',
                  background: audit.status === 'published' ? 'var(--status-success-bg)' : 'var(--surface-hover)',
                  color: audit.status === 'published' ? 'var(--status-success)' : 'var(--text-secondary)',
                }}
              >
                {audit.status === 'published' ? <CheckCircle2 size={13} /> : <FileEdit size={13} />}
                {audit.status === 'published' ? 'Published' : 'Draft'}
              </span>
              {audit.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="inline-flex items-center gap-1.5 rounded-lg font-medium"
                  style={{
                    fontSize: '13px',
                    padding: '7px 13px',
                    background: 'var(--brand-blue)',
                    color: '#fff',
                    border: 'none',
                    cursor: publishing ? 'default' : 'pointer',
                    opacity: publishing ? 0.7 : 1,
                  }}
                >
                  <Send size={14} />
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5" style={{ maxWidth: '760px' }}>
        {error && (
          <p style={{ fontSize: '13px', color: 'var(--status-danger)', marginBottom: '12px' }}>{error}</p>
        )}

        {/* Overall score card */}
        <div
          className="rounded-xl p-5 mb-5 flex items-center justify-between gap-4"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Overall score
            </div>
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '34px', fontWeight: 700, color: scoreColor(audit.overallScore), lineHeight: 1 }}>
                {audit.overallScore}
              </span>
              <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {audit.rawScore}/{audit.maxScore} raw
            </div>
          </div>
          <span
            className="rounded-lg font-semibold"
            style={{
              fontSize: '13px',
              padding: '7px 13px',
              background: scoreBg(audit.overallScore),
              color: scoreColor(audit.overallScore),
            }}
          >
            {overallBand(audit.overallScore)}
          </span>
        </div>

        {/* Categories */}
        <div
          className="rounded-xl overflow-hidden mb-5"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Category scores
          </div>
          {audit.categories.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>No categories recorded.</div>
          ) : (
            audit.categories.map((c, idx) => (
              <div
                key={c.key}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < audit.categories.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.label}</span>
                  <span
                    className="font-semibold rounded"
                    style={{ fontSize: '13px', padding: '2px 8px', color: catColor(c.score), background: 'var(--surface-hover)' }}
                  >
                    {c.score}/10
                  </span>
                </div>
                {c.note && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                    {c.note}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary fields */}
        <div
          className="rounded-xl overflow-hidden mb-5"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <DetailRow label="Bins emptied" value={audit.binsEmptied === null ? '—' : audit.binsEmptied ? 'Yes' : 'No'} />
          <DetailRow label="Issues spotted" value={audit.issuesSpotted || '—'} multiline last={!audit.needsReview && !audit.headlineNotes} />
          {audit.needsReview && <DetailRow label="Needs review by next audit" value={audit.needsReview} multiline last={!audit.headlineNotes} />}
          {audit.headlineNotes && <DetailRow label="Headline notes (client summary)" value={audit.headlineNotes} multiline last />}
        </div>

        {/* Photos + signature indicators */}
        <div className="flex flex-wrap gap-3 mb-5">
          {photos.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg" style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <ImageIcon size={15} style={{ color: 'var(--brand-blue)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'} attached
              </span>
            </div>
          )}
          {audit.signatureData && (
            <div className="flex items-center gap-2 rounded-lg" style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <PenLine size={15} style={{ color: 'var(--brand-blue)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Auditor signature captured</span>
            </div>
          )}
        </div>

        {/* Photo grid */}
        {photos.length > 0 && (
          <div
            className="mb-5"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}
          >
            {photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`Audit photo ${i + 1}`}
                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        )}

        {/* Dropbox PDF */}
        {audit.status === 'published' && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <CheckCircle2 size={16} style={{ color: 'var(--status-success)', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Published {audit.publishedAt ? `· ${formatDateTime(audit.publishedAt)}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                {audit.dropboxPdfPath
                  ? `PDF saved to Dropbox: ${audit.dropboxPdfPath}`
                  : 'No Dropbox PDF path recorded (client may not have a Dropbox folder configured).'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, multiline, last }: { label: string; value: string; multiline?: boolean; last?: boolean }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        display: multiline ? 'block' : 'flex',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          marginTop: multiline ? '4px' : 0,
          display: 'block',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
          textAlign: multiline ? 'left' : 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}
