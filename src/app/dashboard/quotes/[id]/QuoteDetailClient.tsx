'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';

interface Quote {
  id: string;
  status: string;
  companyName: string | null;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  siteType: string | null;
  hoursPerDay: string | number | null;
  frequency: number | null;
  days: string[] | null;
  weeklyHours: string | number;
  sellRate: string | number;
  labourRate: string | number;
  weeksPerMonth: string | number;
  isPilot: boolean;
  pilotDiscount: string | number | null;
  productCost: string | number | null;
  overheadCost: string | number | null;
  monthlyTotal: string | number | null;
  annualTotal: string | number | null;
  margin: string | number | null;
  emailSubject: string | null;
  emailHtml: string | null;
  pdfPath: string | null;
  trackingId: string | null;
  openCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  supersededById: string | null;
  createdAt: string;
  updatedAt: string;
  deal: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
  creator: { id: string; name: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  superseded: 'Superseded',
};

const STATUS_COLOURS: Record<string, string> = {
  draft: '#6b7280',
  sent: '#2056A4',
  viewed: '#0ea5e9',
  accepted: '#6B8E23',
  rejected: '#dc2626',
  expired: '#f59e0b',
  superseded: '#9ca3af',
};

const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(val: string | number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return num.toFixed(decimals);
}

export function QuoteDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendOpen, setResendOpen] = useState(false);
  const [resendNote, setResendNote] = useState('');
  const [confirmAction, setConfirmAction] = useState<null | 'accepted' | 'rejected' | 'clone' | 'send'>(null);
  const mountRef = useRef(true);

  const fetchQuote = () => {
    fetch(`/api/quotes/${id}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (mountRef.current) {
          setQuote(data.quote);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountRef.current) {
          setError('Quote not found');
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    mountRef.current = true;
    fetchQuote();
    return () => { mountRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const callApi = async (path: string, method: string, body?: Record<string, unknown>) => {
    setBusy(path);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        return null;
      }
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    setConfirmAction(null);
    const result = await callApi(`/api/quotes/${id}/send`, 'POST', {});
    if (result) fetchQuote();
  };

  const handleResend = async () => {
    const result = await callApi(`/api/quotes/${id}/resend`, 'POST', { note: resendNote || undefined });
    if (result) {
      setResendOpen(false);
      setResendNote('');
      fetchQuote();
    }
  };

  const handleClone = async () => {
    setConfirmAction(null);
    const result = await callApi(`/api/quotes/${id}/clone`, 'POST');
    if (result?.quote?.id) {
      router.push(`/dashboard/quotes/${result.quote.id}`);
    }
  };

  const handleMark = async (newStatus: 'accepted' | 'rejected') => {
    setConfirmAction(null);
    const result = await callApi(`/api/quotes/${id}`, 'PATCH', { status: newStatus });
    if (result) fetchQuote();
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        Loading quote...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        {error || 'Quote not found'}
        <div className="mt-4">
          <button
            onClick={() => router.push('/dashboard/quotes/list')}
            className="px-4 py-2 text-sm border rounded-lg"
            style={{ borderColor: 'var(--border)' }}
          >
            Back to quotes
          </button>
        </div>
      </div>
    );
  }

  const isDraft = quote.status === 'draft';
  const isLive = quote.status === 'sent' || quote.status === 'viewed';
  const isTerminal = ['accepted', 'rejected', 'expired', 'superseded'].includes(quote.status);
  const isSuperseded = !!quote.supersededById || quote.status === 'superseded';

  // Determine which timeline steps are reached
  const reached = new Set<string>();
  reached.add('draft');
  if (quote.sentAt || ['sent', 'viewed', 'accepted', 'rejected', 'expired', 'superseded'].includes(quote.status)) reached.add('sent');
  if (quote.viewedAt || ['viewed', 'accepted'].includes(quote.status)) reached.add('viewed');
  if (quote.acceptedAt || quote.status === 'accepted') reached.add('accepted');
  const isRejected = quote.status === 'rejected' || !!quote.rejectedAt;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => router.push('/dashboard/quotes/list')}
          className="p-1 hover:bg-gray-100 rounded"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {quote.companyName || 'Untitled Quote'}
          </h1>
          <div className="flex items-center gap-3 mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {quote.trackingId && <span className="font-mono">{quote.trackingId}</span>}
            {quote.contactName && <span>{quote.contactName}</span>}
            {quote.contactEmail && <span>{quote.contactEmail}</span>}
          </div>
        </div>
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: STATUS_COLOURS[quote.status] || '#6b7280' }}
        >
          {STATUS_LABELS[quote.status] || quote.status}
        </span>
        {quote.isPilot && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: '#fff3cd', color: '#856404' }}
          >
            Pilot Pricing
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {isDraft && (
          <button
            onClick={() => setConfirmAction('send')}
            disabled={!!busy}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            Send Quote
          </button>
        )}
        {isLive && (
          <>
            <button
              onClick={() => setResendOpen(true)}
              disabled={!!busy}
              className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              Resend
            </button>
            <button
              onClick={() => setConfirmAction('accepted')}
              disabled={!!busy}
              className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#6B8E23' }}
            >
              Mark Accepted
            </button>
            <button
              onClick={() => setConfirmAction('rejected')}
              disabled={!!busy}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
              style={{ borderColor: '#fca5a5' }}
            >
              Mark Rejected
            </button>
          </>
        )}
        {!isDraft && !isSuperseded && (
          <button
            onClick={() => setConfirmAction('clone')}
            disabled={!!busy}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            Clone to New Draft
          </button>
        )}
        {isSuperseded && quote.supersededById && (
          <button
            onClick={() => router.push(`/dashboard/quotes/${quote.supersededById}`)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--brand-blue)' }}
          >
            → View Latest Version
          </button>
        )}
        {quote.pdfPath && (
          <a
            href={`/api/quotes/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            View PDF
          </a>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Status Timeline */}
      <div className="rounded-xl border p-6 mb-6" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Status Timeline</h3>
        <div className="flex items-center justify-between gap-2">
          {TIMELINE_STEPS.map((step, idx) => {
            const isReached = reached.has(step.key);
            const isAcceptedRejected = step.key === 'accepted' && isRejected;
            const colour = isAcceptedRejected ? STATUS_COLOURS.rejected : (isReached ? STATUS_COLOURS[step.key] : '#e5e7eb');
            const label = isAcceptedRejected ? 'Rejected' : step.label;
            const datetime = step.key === 'draft' ? quote.createdAt
              : step.key === 'sent' ? quote.sentAt
              : step.key === 'viewed' ? quote.viewedAt
              : isRejected ? quote.rejectedAt
              : quote.acceptedAt;

            return (
              <div key={step.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: colour }}
                  >
                    {isReached ? '✓' : idx + 1}
                  </div>
                  <span className="text-xs mt-1 font-medium" style={{ color: isReached ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {datetime ? formatDate(datetime) : '—'}
                  </span>
                </div>
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2" style={{
                    background: reached.has(TIMELINE_STEPS[idx + 1].key) ? STATUS_COLOURS[TIMELINE_STEPS[idx + 1].key] : '#e5e7eb',
                  }} />
                )}
              </div>
            );
          })}
        </div>
        {isSuperseded && !quote.supersededById && (
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>This quote was superseded.</p>
        )}
        {quote.expiresAt && !isTerminal && (
          <p className="text-xs mt-4" style={{ color: '#f59e0b' }}>
            Expires {formatDate(quote.expiresAt)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Details */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Client</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailField label="Company" value={quote.companyName} />
            <DetailField label="Site Type" value={quote.siteType} />
            <DetailField
              label="Contact"
              value={quote.contactName}
              link={quote.contact ? `/dashboard/contacts/${quote.contact.id}` : undefined}
            />
            <DetailField label="Email" value={quote.contactEmail} />
            <DetailField label="Phone" value={quote.contactPhone} />
            <DetailField
              label="Account"
              value={quote.account?.name ?? null}
              link={quote.account ? `/dashboard/accounts/${quote.account.id}` : undefined}
            />
            <DetailField
              label="Deal"
              value={quote.deal?.name ?? null}
              link={quote.deal ? `/dashboard/deals/${quote.deal.id}` : undefined}
            />
            <DetailField label="Address" value={quote.address} />
          </div>
        </div>

        {/* Service Schedule */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Schedule</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailField label="Hours / Day" value={formatNumber(quote.hoursPerDay)} />
            <DetailField label="Frequency / Week" value={quote.frequency ? `${quote.frequency} visits` : null} />
            <DetailField label="Weekly Hours" value={formatNumber(quote.weeklyHours)} />
            <DetailField label="Days" value={quote.days?.length ? quote.days.join(', ') : null} />
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border p-6 col-span-1 md:col-span-2" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Pricing</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <DetailField label="Sell Rate" value={`${formatCurrency(quote.sellRate)}/hr`} />
            <DetailField label="Labour Rate" value={`${formatCurrency(quote.labourRate)}/hr`} />
            <DetailField label="Weekly Hours" value={formatNumber(quote.weeklyHours)} />
            <DetailField label="Weeks / Month" value={formatNumber(quote.weeksPerMonth, 2)} />
            <DetailField label="Product Cost" value={quote.productCost ? formatCurrency(quote.productCost) : null} />
            <DetailField label="Overhead Cost" value={quote.overheadCost ? formatCurrency(quote.overheadCost) : null} />
            <DetailField
              label="Pilot Discount"
              value={quote.isPilot && quote.pilotDiscount ? `${quote.pilotDiscount}%` : null}
            />
            <DetailField label="Margin" value={quote.margin != null ? `${formatNumber(quote.margin)}%` : null} />
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderColor: 'var(--border)' }}>
            <div className="rounded-lg p-4" style={{ background: 'var(--surface-accent)' }}>
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Monthly Total</div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--brand-blue)' }}>
                {formatCurrency(quote.monthlyTotal)}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--surface-accent)' }}>
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Annual Value</div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--brand-blue)' }}>
                {formatCurrency(quote.annualTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Email Tracking */}
        <div className="rounded-xl border p-6 col-span-1 md:col-span-2" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Email Tracking</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <DetailField label="Subject" value={quote.emailSubject} />
            <DetailField label="Opens" value={String(quote.openCount)} />
            <DetailField label="Sent" value={formatDateTime(quote.sentAt)} />
            <DetailField label="First Viewed" value={formatDateTime(quote.viewedAt)} />
            <DetailField label="Created" value={formatDateTime(quote.createdAt)} />
            <DetailField label="Creator" value={quote.creator?.name} />
            {quote.acceptedAt && <DetailField label="Accepted" value={formatDateTime(quote.acceptedAt)} />}
            {quote.rejectedAt && <DetailField label="Rejected" value={formatDateTime(quote.rejectedAt)} />}
          </div>
          {quote.trackingId && quote.status !== 'draft' && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Public accept link</div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs px-2 py-1 rounded font-mono" style={{ background: 'var(--surface-accent)', color: 'var(--text-primary)' }}>
                  /api/quotes/track/{quote.trackingId}/accept
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/quotes/track/${quote.trackingId}/accept`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Copy link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resend Modal */}
      <Modal
        open={resendOpen}
        onClose={() => { setResendOpen(false); setResendNote(''); }}
        title="Resend Quote"
        maxWidth="480px"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Re-sends the same PDF and content to <strong>{quote.contactEmail}</strong>.
          Status stays as <strong>{STATUS_LABELS[quote.status]}</strong>; tracking and accept link are preserved.
        </p>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Optional note (shown to the recipient)
        </label>
        <textarea
          value={resendNote}
          onChange={(e) => setResendNote(e.target.value)}
          rows={3}
          placeholder="e.g. Just bumping this back to the top of your inbox."
          className="w-full px-3 py-2 text-sm border rounded-lg focus-brand"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => { setResendOpen(false); setResendNote(''); }}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleResend}
            disabled={busy === `/api/quotes/${id}/resend`}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            {busy === `/api/quotes/${id}/resend` ? 'Sending...' : 'Send Again'}
          </button>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction === 'send' ? 'Send Quote'
          : confirmAction === 'accepted' ? 'Mark as Accepted'
          : confirmAction === 'rejected' ? 'Mark as Rejected'
          : confirmAction === 'clone' ? 'Clone Quote'
          : ''
        }
      >
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {confirmAction === 'send' && <>Send this quote to <strong>{quote.contactEmail}</strong>? PDF + tracking will be attached.</>}
          {confirmAction === 'accepted' && <>Mark <strong>{quote.companyName}</strong> as accepted? Use this when the client has confirmed by phone, email, or in person.</>}
          {confirmAction === 'rejected' && <>Mark <strong>{quote.companyName}</strong> as rejected? The deal will still be in the pipeline, this just flags the quote outcome.</>}
          {confirmAction === 'clone' && <>Create a new draft based on this quote? {isLive || isTerminal ? <>This quote will be marked as <strong>superseded</strong>.</> : null}</>}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmAction(null)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (confirmAction === 'send') handleSend();
              if (confirmAction === 'accepted') handleMark('accepted');
              if (confirmAction === 'rejected') handleMark('rejected');
              if (confirmAction === 'clone') handleClone();
            }}
            disabled={!!busy}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: confirmAction === 'rejected' ? '#dc2626'
                : confirmAction === 'accepted' ? '#6B8E23'
                : 'var(--brand-blue)',
            }}
          >
            {busy ? 'Working...' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function DetailField({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  const router = useRouter();
  return (
    <div>
      <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {value ? (
        link ? (
          <button
            onClick={() => router.push(link)}
            className="text-sm hover:underline text-left"
            style={{ color: 'var(--brand-blue)' }}
          >
            {value}
          </button>
        ) : (
          <span className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>
            {value}
          </span>
        )
      ) : (
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          —
        </span>
      )}
    </div>
  );
}
