'use client';

import { useRouter } from 'next/navigation';

const SOURCE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  cold_email: 'Cold Email',
  referral: 'Referral',
  website: 'Website',
  mark_walker: 'Mark Walker',
  direct_mail: 'Direct Mail',
  other: 'Other',
};

interface LeadItem {
  id: string;
  companyName: string;
  contactName: string;
  source: string;
  stage: string;
  owner: { id: string; name: string | null } | null;
}

interface DealItem {
  id: string;
  name: string;
  stage: string;
  value: string | number | null;
  owner: { id: string; name: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export function LeadKanbanCard({ item }: { item: LeadItem }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/dashboard/leads/${item.id}`)}
      className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#1a1a1a' }}>
            {item.companyName}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
            {item.contactName}
          </p>
        </div>
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: '#2c5f2d' }}
          title={item.owner?.name || 'Unassigned'}
        >
          {getInitial(item.owner?.name)}
        </div>
      </div>
      <div className="mt-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
        >
          {SOURCE_LABELS[item.source] || item.source}
        </span>
      </div>
    </div>
  );
}

export function DealKanbanCard({ item }: { item: DealItem }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/dashboard/deals/${item.id}`)}
      className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#1a1a1a' }}>
            {item.name}
          </p>
          {item.contact && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
              {item.contact.firstName} {item.contact.lastName}
            </p>
          )}
        </div>
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: '#2c5f2d' }}
          title={item.owner?.name || 'Unassigned'}
        >
          {getInitial(item.owner?.name)}
        </div>
      </div>
      {item.value && (
        <div className="mt-2">
          <span className="text-sm font-semibold" style={{ color: '#2c5f2d' }}>
            {formatCurrency(item.value)}
          </span>
        </div>
      )}
    </div>
  );
}
