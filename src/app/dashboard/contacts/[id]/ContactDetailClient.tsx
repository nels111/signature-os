'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { ContactForm } from '../ContactForm';
import type { ContactFormData } from '@/lib/schemas/contact';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  accountId: string | null;
  source: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  account: { id: string; name: string } | null;
  leads: Array<{ id: string; companyName: string; stage: string; source: string }>;
  deals: Array<{ id: string; name: string; stage: string; value: string | null }>;
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

export function ContactDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'linked' | 'activity'>('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    fetch(`/api/contacts/${id}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not found');
      })
      .then((data) => {
        if (mountRef.current) {
          setContact(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountRef.current) router.push('/dashboard/contacts');
      });
    return () => { mountRef.current = false; };
  }, [id, router]);

  const refetchContact = () => {
    fetch(`/api/contacts/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setContact(data); })
      .catch(() => {});
  };

  const handleUpdate = async (data: ContactFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowEditModal(false);
        refetchContact();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/contacts');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        Loading contact...
      </div>
    );
  }

  if (!contact) return null;

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    { key: 'linked' as const, label: 'Linked Entities' },
    { key: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-2">
          <button
            onClick={() => router.push('/dashboard/contacts')}
            className="p-1 mt-1 hover:bg-gray-100 rounded shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {contact.firstName} {contact.lastName}
            </h1>
            {contact.company && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {contact.company}
              </p>
            )}
          </div>
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

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailField label="First Name" value={contact.firstName} />
            <DetailField label="Last Name" value={contact.lastName} />
            <DetailField label="Email" value={contact.email} />
            <DetailField label="Phone" value={contact.phone} />
            <DetailField label="Company" value={contact.company} />
            <DetailField
              label="Account"
              value={contact.account?.name}
              link={
                contact.account
                  ? `/dashboard/accounts/${contact.account.id}`
                  : undefined
              }
            />
            <div>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Source
              </span>
              {contact.source ? (
                <Badge
                  label={SOURCE_LABELS[contact.source] || contact.source}
                  variant={SOURCE_VARIANTS[contact.source] || 'default'}
                />
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
            <DetailField label="Created" value={formatDate(contact.createdAt)} />
          </div>
          {contact.notes && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {contact.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'linked' && (
        <div className="space-y-6">
          {/* Linked Account */}
          {contact.account && (
            <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Linked Account
              </h3>
              <button
                onClick={() => router.push(`/dashboard/accounts/${contact.account!.id}`)}
                className="text-sm hover:underline"
                style={{ color: 'var(--brand-blue)' }}
              >
                {contact.account.name}
              </button>
            </div>
          )}

          {/* Leads */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Leads ({contact.leads?.length || 0})
            </h3>
            {contact.leads && contact.leads.length > 0 ? (
              <div className="space-y-2">
                {contact.leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded border hover:bg-gray-50"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {lead.companyName}
                    </span>
                    <Badge label={lead.stage.replace(/_/g, ' ')} variant="info" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No leads linked to this contact.
              </p>
            )}
          </div>

          {/* Deals */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Deals ({contact.deals?.length || 0})
            </h3>
            {contact.deals && contact.deals.length > 0 ? (
              <div className="space-y-2">
                {contact.deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-3 rounded border hover:bg-gray-50"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {deal.name}
                    </span>
                    <Badge
                      label={deal.stage.replace(/_/g, ' ')}
                      variant={deal.stage === 'closed_won' ? 'success' : deal.stage === 'closed_lost' ? 'danger' : 'warning'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No deals linked to this contact.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityTimeline entityType="contact" entityId={contact.id} />
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Contact"
        maxWidth="600px"
      >
        <ContactForm
          initialData={{
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email || '',
            phone: contact.phone || '',
            company: contact.company || '',
            accountId: contact.accountId || '',
            notes: contact.notes || '',
            source: contact.source || '',
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditModal(false)}
          loading={saving}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Contact"
      >
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {contact.firstName} {contact.lastName}
          </strong>
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
            Delete Contact
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
