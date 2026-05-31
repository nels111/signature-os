'use client';

import { Clock, Star, RefreshCw, TrendingUp } from 'lucide-react';
import type { ColdCallingLead, QueueResponse } from '@/lib/cold-calling/types';

interface Props {
  queue: QueueResponse | null;
  loading: boolean;
  activeLead: ColdCallingLead | null;
  onSelectLead: (lead: ColdCallingLead) => void;
}

const SECTION_CONFIG = [
  { key: 'callbacks', label: 'Callbacks', color: '#f59e0b', icon: Clock },
  { key: 'fresh', label: 'Fresh', color: '#22c55e', icon: Star },
  { key: 'followUps', label: 'Follow-ups', color: '#3b82f6', icon: TrendingUp },
  { key: 'recycle', label: 'Recycle', color: '#8b5cf6', icon: RefreshCw },
] as const;

function LeadRow({ lead, active, onSelect }: { lead: ColdCallingLead; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-3 py-2 rounded-lg transition-all hover:opacity-80"
      style={{
        background: active ? 'color-mix(in srgb, var(--brand-blue) 10%, transparent)' : 'transparent',
        border: active ? '1px solid color-mix(in srgb, var(--brand-blue) 20%, transparent)' : '1px solid transparent',
      }}
    >
      <p className="text-xs font-semibold truncate" style={{ color: active ? 'var(--brand-blue)' : 'var(--text-primary)' }}>
        {lead.companyName}
      </p>
      {lead.contactName && (
        <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{lead.contactName}</p>
      )}
    </button>
  );
}

export function QueueSidebar({ queue, loading, activeLead, onSelectLead }: Props) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
        ))}
      </div>
    );
  }

  if (!queue) return null;

  const sections = SECTION_CONFIG.map(s => ({
    ...s,
    leads: queue.queues[s.key] as ColdCallingLead[],
  }));

  const hasLeads = sections.some(s => s.leads.length > 0);

  if (!hasLeads) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Queue empty</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Counts */}
      <div className="grid grid-cols-2 gap-1.5">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="rounded-lg p-2 text-center" style={{ background: `${s.color}10` }}>
              <p className="text-sm font-bold" style={{ color: s.color }}>{s.leads.length}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Lead lists by section */}
      {sections.map(s => {
        if (s.leads.length === 0) return null;
        const Icon = s.icon;
        return (
          <div key={s.key}>
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <Icon size={11} style={{ color: s.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>
                {s.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {s.leads.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  active={activeLead?.id === lead.id}
                  onSelect={() => onSelectLead(lead)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {queue.counts.dormant > 0 && (
        <p className="text-[10px] text-center px-1" style={{ color: 'var(--text-secondary)' }}>
          {queue.counts.dormant} dormant (not shown)
        </p>
      )}
    </div>
  );
}
