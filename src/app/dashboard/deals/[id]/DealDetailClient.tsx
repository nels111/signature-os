'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { DealForm } from '../DealForm';
import type { DealFormData } from '@/lib/schemas/deal';

const SECTOR_LABELS: Record<string, string> = {
  hospitality: 'Hospitality',
  automotive: 'Automotive',
  education: 'Education',
  construction_property: 'Construction / Property',
  healthcare: 'Healthcare',
  office_professional: 'Office / Professional',
  retail: 'Retail',
  other: 'Other',
};

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: string | null;
  ownerId: string;
  notes: string | null;
  lossReason: string | null;
  sector: string | null;
  closingDate: string | null;
  probability: number | null;
  contactId: string | null;
  accountId: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
  owner: { id: string; name: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  account: { id: string; name: string } | null;
  convertedFrom: {
    id: string;
    companyName: string;
    contactName: string;
    stage: string;
    source: string;
  } | null;
}

const STAGE_LABELS: Record<string, string> = {
  quote_sent: 'Quote Sent',
  follow_up_from_quote: 'Follow-up from Quote',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_COLOURS: Record<string, string> = {
  quote_sent: '#3b82f6',
  follow_up_from_quote: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
};

const SOURCE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  referral: 'Referral',
  website: 'Website',
  mark_walker: 'Mark Walker',
  direct_mail: 'Direct Mail',
  other: 'Other',
};

const LEAD_STAGE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  follow_up_sequence: 'Follow-up Sequence',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_attended: 'Meeting Attended',
  quote_delivered: 'Quote Delivered',
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

export function DealDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'converted' | 'activity'>('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    fetch(`/api/deals/${id}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not found');
      })
      .then((data) => {
        if (mountRef.current) {
          setDeal(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountRef.current) router.push('/dashboard/deals');
      });
    return () => { mountRef.current = false; };
  }, [id, router]);

  const refetchDeal = () => {
    fetch(`/api/deals/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setDeal(data); })
      .catch(() => {});
  };

  const handleUpdate = async (data: DealFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowEditModal(false);
        refetchDeal();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/deals');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        Loading deal...
      </div>
    );
  }

  if (!deal) return null;

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    ...(deal.convertedFrom
      ? [{ key: 'converted' as const, label: 'Converted From' }]
      : []),
    { key: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-2">
          <button
            onClick={() => router.push('/dashboard/deals')}
            className="p-1 mt-1 hover:bg-gray-100 rounded shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {deal.name}
            </h1>
            {deal.value && (
              <p className="text-sm mt-0.5 font-semibold" style={{ color: 'var(--brand-blue)' }}>
                {formatCurrency(deal.value)}
              </p>
            )}
          </div>
          <span
            className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white mt-1"
            style={{ backgroundColor: STAGE_COLOURS[deal.stage] || '#6b7280' }}
          >
            {STAGE_LABELS[deal.stage] || deal.stage}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
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
            <DetailField label="Deal Name" value={deal.name} />
            <div>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Stage
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: STAGE_COLOURS[deal.stage] || '#6b7280' }}
              >
                {STAGE_LABELS[deal.stage] || deal.stage}
              </span>
            </div>
            <DetailField label="Value" value={deal.value ? formatCurrency(deal.value) : null} />
            <DetailField label="Owner" value={deal.owner?.name} />
            {deal.contact && (
              <DetailField
                label="Contact"
                value={`${deal.contact.firstName} ${deal.contact.lastName}`}
                link={`/dashboard/contacts/${deal.contact.id}`}
              />
            )}
            <DetailField
              label="Account"
              value={deal.account?.name}
              link={deal.account ? `/dashboard/accounts/${deal.account.id}` : undefined}
            />
            {deal.sector && (
              <DetailField label="Sector" value={SECTOR_LABELS[deal.sector] || deal.sector} />
            )}
            {deal.closingDate && (
              <DetailField label="Expected Close" value={formatDate(deal.closingDate)} />
            )}
            {deal.probability !== null && deal.probability !== undefined && (
              <DetailField label="Probability" value={`${deal.probability}%`} />
            )}
            <DetailField label="Created" value={formatDate(deal.createdAt)} />
            <DetailField label="Stage Changed" value={formatDate(deal.stageChangedAt)} />
            {deal.wonAt && (
              <DetailField label="Won Date" value={formatDate(deal.wonAt)} />
            )}
            {deal.lostAt && (
              <DetailField label="Lost Date" value={formatDate(deal.lostAt)} />
            )}
            {deal.lossReason && (
              <div className="col-span-2">
                <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Loss Reason
                </span>
                <p className="text-sm" style={{ color: '#ef4444' }}>
                  {deal.lossReason}
                </p>
              </div>
            )}
          </div>
          {deal.notes && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {deal.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Converted From Tab */}
      {activeTab === 'converted' && deal.convertedFrom && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Converted from Lead
          </h3>
          <div
            className="p-4 rounded-xl border hover:bg-gray-50 cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => router.push(`/dashboard/leads/${deal.convertedFrom!.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {deal.convertedFrom.companyName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {deal.convertedFrom.contactName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={SOURCE_LABELS[deal.convertedFrom.source] || deal.convertedFrom.source}
                  variant="info"
                />
                <Badge
                  label={LEAD_STAGE_LABELS[deal.convertedFrom.stage] || deal.convertedFrom.stage}
                  variant="success"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <ActivityTimeline entityType="deal" entityId={deal.id} />
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Deal"
        maxWidth="600px"
      >
        <DealForm
          initialData={{
            name: deal.name,
            stage: deal.stage,
            value: deal.value ? String(deal.value) : '',
            ownerId: deal.ownerId,
            contactId: deal.contactId || '',
            accountId: deal.accountId || '',
            notes: deal.notes || '',
            lossReason: deal.lossReason || '',
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={saving}
          isEdit
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Deal"
      >
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{deal.name}</strong>
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
            Delete Deal
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
