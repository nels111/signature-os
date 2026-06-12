'use client';

import { useRouter } from 'next/navigation';

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
  stageChangedAt: string | null;
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

function staleDays(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  const then = new Date(isoDate).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export function LeadKanbanCard({ item }: { item: LeadItem }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/dashboard/leads/${item.id}`)}
      className="rounded-xl border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {item.companyName}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {item.contactName}
          </p>
        </div>
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: 'var(--brand-blue)' }}
          title={item.owner?.name || 'Unassigned'}
        >
          {getInitial(item.owner?.name)}
        </div>
      </div>
      <div className="mt-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
        >
          {SOURCE_LABELS[item.source] || item.source}
        </span>
      </div>
    </div>
  );
}

export function DealKanbanCard({ item }: { item: DealItem }) {
  const router = useRouter();
  const days = staleDays(item.stageChangedAt);

  // Only flag stale for active (not closed) stages
  const isClosed = item.stage === 'closed_won' || item.stage === 'closed_lost';
  const isStaleAmber = !isClosed && days >= 7 && days < 14;
  const isStaleRed = !isClosed && days >= 14;

  const staleBorderColor = isStaleRed ? '#dc2626' : isStaleAmber ? '#f59e0b' : 'var(--border)';

  return (
    <div
      onClick={() => router.push(`/dashboard/deals/${item.id}`)}
      className="rounded-xl border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer"
      style={{ borderColor: staleBorderColor, backgroundColor: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {item.name}
            </p>
            {isStaleRed && (
              <span
                className="flex-shrink-0 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#dc2626' }}
                title={`Stale: ${days} days in this stage`}
              />
            )}
            {isStaleAmber && (
              <span
                className="flex-shrink-0 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#f59e0b' }}
                title={`${days} days in this stage`}
              />
            )}
          </div>
          {item.contact && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
              {item.contact.firstName} {item.contact.lastName}
            </p>
          )}
        </div>
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: 'var(--brand-blue)' }}
          title={item.owner?.name || 'Unassigned'}
        >
          {getInitial(item.owner?.name)}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {item.value && (
          <span className="text-sm font-semibold" style={{ color: 'var(--brand-blue)' }}>
            {formatCurrency(item.value)}
          </span>
        )}
        {(isStaleAmber || isStaleRed) && (
          <span
            className="text-[10px] font-semibold ml-auto"
            style={{ color: isStaleRed ? '#dc2626' : '#f59e0b' }}
          >
            {days}d stale
          </span>
        )}
      </div>
    </div>
  );
}
