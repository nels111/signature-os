'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { PhoneLink, EmailLink } from '@/components/ContactLinks';
import { EmailThread } from '@/components/EmailThread';
import { LeadForm } from '../LeadForm';
import type { LeadFormData } from '@/lib/schemas/lead';

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  meetingOutcome: string | null;
  ownerId: string;
  notes: string | null;
  contactId: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
  owner: { id: string; name: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  account: { id: string; name: string } | null;
  deals: Array<{ id: string; name: string; stage: string; value: string | null }>;
  emails?: Array<{
    id: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    bodyText: string | null;
    bodyHtml: string | null;
    date: string;
    isRead: boolean;
    openCount: number;
    folder: string;
    attachments: Array<{ id: string; filename: string; contentType: string; size: number }>;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  website: 'Website',
  partner: 'Partner',
  mark_walker: 'Partner',   // legacy
  direct_mail: 'Direct Mail',
  other: 'Other',
};

const SOURCE_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  cold_call: 'info',
  cold_email: 'info',
  linkedin: 'info',
  referral: 'success',
  website: 'warning',
  partner: 'success',
  mark_walker: 'success',   // legacy
  direct_mail: 'default',
  other: 'default',
};

const STAGE_LABELS: Record<string, string> = {
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
  // Legacy (display as closest active equivalent)
  cold_call: 'Contacted',
  cold_email: 'Contacted',
  linkedin: 'Contacted',
  follow_up_sequence: 'Contacted',
  dormant: 'Dormant',
  bad_data: 'Bad Data',
  archived: 'Archived',
};

const STAGE_COLOURS: Record<string, string> = {
  new_lead: '#6b7280',
  contacted: '#3b82f6',
  meeting_scheduled: '#8b5cf6',
  meeting_attended: '#a78bfa',
  quote_delivered: '#f59e0b',
  negotiating: '#f97316',
  won: '#10b981',
  contact_when_contract_up: '#6366f1',
  not_interested_for_now: '#9ca3af',
  foad: '#ef4444',
  // Legacy
  cold_call: '#3b82f6',
  cold_email: '#3b82f6',
  linkedin: '#3b82f6',
  follow_up_sequence: '#3b82f6',
  dormant: '#9ca3af',
  bad_data: '#ef4444',
  archived: '#6b7280',
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  quote_sent: 'Quote Sent',
  follow_up_from_quote: 'Follow-up from Quote',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const MEETING_OUTCOME_LABELS: Record<string, string> = {
  good: 'Good',
  bad: 'Bad',
  not_interested: 'Not Interested',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function LeadDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'deals' | 'emails' | 'activity'>('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [showBookVisit, setShowBookVisit] = useState(false);
  const [bookingVisit, setBookingVisit] = useState(false);
  const [bookVisitError, setBookVisitError] = useState<string | null>(null);

  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    fetch(`/api/leads/${id}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not found');
      })
      .then((data) => {
        if (mountRef.current) {
          setLead(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountRef.current) router.push('/dashboard/leads');
      });
    return () => { mountRef.current = false; };
  }, [id, router]);

  const refetchLead = () => {
    fetch(`/api/leads/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setLead(data); })
      .catch(() => {});
  };

  const handleUpdate = async (data: LeadFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowEditModal(false);
        refetchLead();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/leads');
    }
  };

  const handleBookVisit = async (data: {
    startDate: string;
    endDate: string;
    location?: string;
    notes?: string;
  }) => {
    setBookingVisit(true);
    setBookVisitError(null);
    try {
      const res = await fetch(`/api/leads/${id}/book-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to book visit');
      }
      setShowBookVisit(false);
      refetchLead();
    } catch (e: unknown) {
      setBookVisitError(e instanceof Error ? e.message : 'Failed to book visit');
    } finally {
      setBookingVisit(false);
    }
  };

  const handleConvertToDeal = async () => {
    if (!lead) return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.companyName,
          convertedFromId: lead.id,
          contactId: lead.contactId,
          accountId: lead.accountId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create deal');
      }
      const deal = await res.json();
      router.push(`/dashboard/deals/${deal.id}`);
    } catch (e: unknown) {
      setConvertError(e instanceof Error ? e.message : 'Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        Loading lead...
      </div>
    );
  }

  if (!lead) return null;

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    { key: 'deals' as const, label: `Linked Deals (${lead.deals?.length || 0})` },
    { key: 'emails' as const, label: `Emails (${lead.emails?.length || 0})` },
    { key: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <button
            onClick={() => router.push('/dashboard/leads')}
            className="p-1 mt-1 hover:bg-gray-100 rounded shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {lead.companyName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {lead.contactName}
            </p>
          </div>
          <span
            className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white mt-1"
            style={{ backgroundColor: STAGE_COLOURS[lead.stage] || '#6b7280' }}
          >
            {STAGE_LABELS[lead.stage] || lead.stage}
          </span>
        </div>
        {/* Action buttons — wrap on mobile */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => { setShowBookVisit(true); setBookVisitError(null); }}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
            style={{ backgroundColor: '#7c3aed' }}
          >
            Book Site Visit
          </button>
          <button
            onClick={handleConvertToDeal}
            disabled={converting}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#16a34a' }}
          >
            {converting ? 'Converting...' : '+ Deal'}
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-blue)' }}
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-red-50 text-red-600"
            style={{ borderColor: '#fca5a5' }}
          >
            Delete
          </button>
          {convertError && (
            <span className="text-xs text-red-600 self-center">{convertError}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailField label="Company Name" value={lead.companyName} />
            <DetailField label="Contact Name" value={lead.contactName} />
            <DetailField label="Email" value={lead.email} type="email" />
            <DetailField label="Phone" value={lead.phone} type="phone" />
            <div>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Source
              </span>
              <Badge
                label={SOURCE_LABELS[lead.source] || lead.source}
                variant={SOURCE_VARIANTS[lead.source] || 'default'}
              />
            </div>
            <div>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Stage
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: STAGE_COLOURS[lead.stage] || '#6b7280' }}
              >
                {STAGE_LABELS[lead.stage] || lead.stage}
              </span>
            </div>
            {lead.meetingOutcome && (
              <DetailField
                label="Meeting Outcome"
                value={MEETING_OUTCOME_LABELS[lead.meetingOutcome] || lead.meetingOutcome}
              />
            )}
            <DetailField label="Owner" value={lead.owner?.name} />
            <DetailField
              label="Account"
              value={lead.account?.name}
              link={lead.account ? `/dashboard/accounts/${lead.account.id}` : undefined}
            />
            {lead.contact && (
              <DetailField
                label="Contact"
                value={`${lead.contact.firstName} ${lead.contact.lastName}`}
                link={`/dashboard/contacts/${lead.contact.id}`}
              />
            )}
            <DetailField label="Created" value={formatDate(lead.createdAt)} />
            <DetailField label="Stage Changed" value={formatDate(lead.stageChangedAt)} />
          </div>
          {lead.notes && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {lead.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Linked Deals Tab */}
      {activeTab === 'deals' && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Linked Deals ({lead.deals?.length || 0})
          </h3>
          {lead.deals && lead.deals.length > 0 ? (
            <div className="space-y-2">
              {lead.deals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-3 rounded border hover:bg-gray-50 cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {deal.name}
                    </span>
                    {deal.value && (
                      <span className="text-sm ml-2" style={{ color: 'var(--brand-blue)' }}>
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                  </div>
                  <Badge
                    label={DEAL_STAGE_LABELS[deal.stage] || deal.stage}
                    variant={deal.stage === 'closed_won' ? 'success' : deal.stage === 'closed_lost' ? 'danger' : 'warning'}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No deals linked to this lead yet.
            </p>
          )}
        </div>
      )}

      {/* Emails Tab — per-lead email thread (synced from the inboxes) */}
      {activeTab === 'emails' && <EmailThread emails={lead.emails} />}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <ActivityTimeline entityType="lead" entityId={lead.id} entityName={lead.companyName} />
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Lead"
        maxWidth="600px"
      >
        <LeadForm
          initialData={{
            companyName: lead.companyName,
            contactName: lead.contactName || '',
            email: lead.email || '',
            phone: lead.phone || '',
            source: lead.source,
            stage: lead.stage,
            meetingOutcome: lead.meetingOutcome || '',
            ownerId: lead.ownerId,
            contactId: lead.contactId || '',
            accountId: lead.accountId || '',
            notes: lead.notes || '',
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={saving}
          isEdit
        />
      </Modal>

      {/* Book Site Visit Modal */}
      <Modal
        open={showBookVisit}
        onClose={() => setShowBookVisit(false)}
        title="Book Site Visit"
        maxWidth="480px"
      >
        <BookVisitForm
          lead={lead}
          onSubmit={handleBookVisit}
          onCancel={() => setShowBookVisit(false)}
          loading={bookingVisit}
          error={bookVisitError}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Lead"
      >
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{lead.companyName}</strong>
          ? This action can be undone by an administrator.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
            style={{ backgroundColor: '#dc2626' }}
          >
            Delete Lead
          </button>
        </div>
      </Modal>
    </div>
  );
}

function BookVisitForm({
  lead,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  lead: { companyName: string; contactName: string };
  onSubmit: (data: { startDate: string; endDate: string; location?: string; notes?: string }) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  function toInput(d: Date) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da}T${h}:${mi}`;
  }

  const endDefault = new Date(tomorrow);
  endDefault.setHours(10, 0, 0, 0);

  const [startDate, setStartDate] = useState(toInput(tomorrow));
  const [endDate, setEndDate] = useState(toInput(endDefault));
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSubmit({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      location: location || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className="px-3 py-2.5 rounded-lg text-sm"
        style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
      >
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{lead.companyName}</span>
        {' '}&middot; {lead.contactName}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start *</label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              // Auto-set end 1hr later
              const start = new Date(e.target.value);
              if (!isNaN(start.getTime())) {
                start.setHours(start.getHours() + 1);
                setEndDate(toInput(start));
              }
            }}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>End *</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Location / Address</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. 12 High Street, Exeter"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={{ borderColor: 'var(--border)' }}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Parking info, access details, contact on arrival..."
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={{ borderColor: 'var(--border)' }}
        />
      </div>

      <div
        className="px-3 py-2 rounded-lg text-xs"
        style={{ background: '#7c3aed12', color: '#7c3aed', border: '1px solid #7c3aed30' }}
      >
        Books into Nick&apos;s diary · updates lead to Meeting Scheduled · sends notification to hello@
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#7c3aed' }}
        >
          {loading ? 'Booking...' : 'Book Site Visit'}
        </button>
      </div>
    </form>
  );
}

function DetailField({
  label,
  value,
  link,
  type,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
  type?: 'phone' | 'email';
}) {
  const router = useRouter();
  return (
    <div>
      <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {value ? (
        type === 'phone' ? (
          <PhoneLink phone={value} />
        ) : type === 'email' ? (
          <EmailLink email={value} />
        ) : link ? (
          <button
            onClick={() => router.push(link)}
            className="text-sm hover:underline"
            style={{ color: 'var(--brand-blue)' }}
          >
            {value}
          </button>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
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
