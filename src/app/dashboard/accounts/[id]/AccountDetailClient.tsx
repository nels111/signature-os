'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { AccountForm } from '../AccountForm';
import type { AccountFormData } from '@/lib/schemas/account';

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  }>;
  leads: Array<{ id: string; companyName: string; stage: string; source: string }>;
  deals: Array<{ id: string; name: string; stage: string; value: string | null }>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function AccountDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'linked' | 'activity'>('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    fetch(`/api/accounts/${id}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not found');
      })
      .then((data) => {
        if (mountRef.current) {
          setAccount(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountRef.current) router.push('/dashboard/accounts');
      });
    return () => { mountRef.current = false; };
  }, [id, router]);

  const refetchAccount = () => {
    fetch(`/api/accounts/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setAccount(data); })
      .catch(() => {});
  };

  const handleUpdate = async (data: AccountFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowEditModal(false);
        refetchAccount();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/dashboard/accounts');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
        Loading account...
      </div>
    );
  }

  if (!account) return null;

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    { key: 'contacts' as const, label: `Contacts (${account.contacts?.length || 0})` },
    { key: 'linked' as const, label: 'Linked Entities' },
    { key: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-2">
          <button
            onClick={() => router.push('/dashboard/accounts')}
            className="p-1 mt-1 hover:bg-gray-100 rounded shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {account.name}
            </h1>
            {account.industry && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {account.industry}
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

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailField label="Account Name" value={account.name} />
            <DetailField label="Industry" value={account.industry} />
            <DetailField label="Phone" value={account.phone} />
            <div>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Website
              </span>
              {account.website ? (
                <a
                  href={account.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                  style={{ color: 'var(--brand-blue)' }}
                >
                  {account.website}
                </a>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
            <DetailField label="Created" value={formatDate(account.createdAt)} />
            <DetailField label="Updated" value={formatDate(account.updatedAt)} />
          </div>
          {account.address && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Address
              </span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {account.address}
              </p>
            </div>
          )}
          {account.notes && (
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </span>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {account.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Contacts
          </h3>
          {account.contacts && account.contacts.length > 0 ? (
            <div className="space-y-2">
              {account.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded border hover:bg-gray-50 cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => router.push(`/dashboard/contacts/${contact.id}`)}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {contact.firstName} {contact.lastName}
                    </span>
                    {contact.email && (
                      <span className="text-sm ml-3" style={{ color: 'var(--text-secondary)' }}>
                        {contact.email}
                      </span>
                    )}
                  </div>
                  {contact.phone && (
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {contact.phone}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No contacts linked to this account.
            </p>
          )}
        </div>
      )}

      {/* Linked Entities Tab */}
      {activeTab === 'linked' && (
        <div className="space-y-6">
          {/* Leads */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Leads ({account.leads?.length || 0})
            </h3>
            {account.leads && account.leads.length > 0 ? (
              <div className="space-y-2">
                {account.leads.map((lead) => (
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
                No leads linked to this account.
              </p>
            )}
          </div>

          {/* Deals */}
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Deals ({account.deals?.length || 0})
            </h3>
            {account.deals && account.deals.length > 0 ? (
              <div className="space-y-2">
                {account.deals.map((deal) => (
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
                No deals linked to this account.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityTimeline entityType="account" entityId={account.id} />
      )}

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Account"
        maxWidth="600px"
      >
        <AccountForm
          initialData={{
            name: account.name,
            industry: account.industry || '',
            website: account.website || '',
            phone: account.phone || '',
            address: account.address || '',
            notes: account.notes || '',
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
        title="Delete Account"
      >
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{account.name}</strong>?
          This action can be undone by an administrator.
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
            Delete Account
          </button>
        </div>
      </Modal>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {value ? (
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {value}
        </span>
      ) : (
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          —
        </span>
      )}
    </div>
  );
}
