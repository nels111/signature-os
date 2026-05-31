'use client';

import { Phone, Mail, Globe, Clock, User, Building2, ChevronRight } from 'lucide-react';
import type { ColdCallingLead, DiallerState } from '@/lib/cold-calling/types';

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  cold_call: 'Cold Call',
  follow_up_sequence: 'Follow-up',
  contact_when_contract_up: 'Contract Renewal',
  meeting_scheduled: 'Meeting Booked',
  dormant: 'Dormant',
};

const OUTCOME_LABELS: Record<string, string> = {
  no_answer: 'No Answer',
  voicemail_left: 'Voicemail',
  gatekeeper: 'Gatekeeper',
  callback_booked: 'Callback Booked',
  decision_maker_spoke: 'DM Spoke',
  site_visit_booked: 'Site Visit',
  contract_renewal_date: 'Renewal Date',
  not_interested: 'Not Interested',
  bad_data: 'Bad Data',
};

function daysAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

interface Props {
  lead: ColdCallingLead | null;
  diallerState: DiallerState;
}

export function LeadContextPanel({ lead, diallerState }: Props) {
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--surface)' }}>
          <Phone size={22} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Queue empty</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>No leads available right now</p>
      </div>
    );
  }

  const isActive = diallerState === 'dialling' || diallerState === 'ringing' || diallerState === 'in_call';

  return (
    <div className="p-5 space-y-4">
      {/* Company header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
          style={{ background: isActive ? '#22c55e18' : 'color-mix(in srgb, var(--brand-blue) 10%, transparent)', color: isActive ? '#16a34a' : 'var(--brand-blue)' }}>
          {lead.companyName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{lead.companyName}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
              {STAGE_LABELS[lead.stage] ?? lead.stage}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {lead.coldCallAttempts} call{lead.coldCallAttempts !== 1 ? 's' : ''} total
            </span>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {lead.contactName && (
          <div className="flex items-center gap-2">
            <User size={13} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{lead.contactName}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone size={13} style={{ color: 'var(--brand-blue)' }} />
            <span className="text-sm font-mono" style={{ color: 'var(--brand-blue)' }}>{lead.phone}</span>
          </div>
        )}
        {lead.directNumber && lead.directNumber !== lead.phone && (
          <div className="flex items-center gap-2">
            <Phone size={13} style={{ color: '#22c55e' }} />
            <span className="text-sm font-mono" style={{ color: '#22c55e' }}>{lead.directNumber}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#22c55e18', color: '#16a34a' }}>Direct</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail size={13} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{lead.email}</span>
          </div>
        )}
        {lead.website && (
          <div className="flex items-center gap-2">
            <Globe size={13} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{lead.website}</span>
          </div>
        )}
        {lead.bestTimeToCall && (
          <div className="flex items-center gap-2">
            <Clock size={13} style={{ color: '#f59e0b' }} />
            <span className="text-sm" style={{ color: '#f59e0b' }}>Best time: {lead.bestTimeToCall}</span>
          </div>
        )}
      </div>

      {/* Decision maker info */}
      {(lead.decisionMakerName || lead.decisionMakerTitle) && (
        <div className="rounded-xl p-3 space-y-1" style={{ background: '#22c55e0a', border: '1px solid #22c55e20' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#16a34a' }}>Decision Maker</p>
          {lead.decisionMakerName && <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{lead.decisionMakerName}</p>}
          {lead.decisionMakerTitle && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.decisionMakerTitle}</p>}
        </div>
      )}

      {/* Gatekeeper info */}
      {lead.gatekeeperName && (
        <div className="rounded-xl p-3 space-y-1" style={{ background: '#3b82f60a', border: '1px solid #3b82f620' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2563eb' }}>Gatekeeper</p>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{lead.gatekeeperName}</p>
        </div>
      )}

      {/* Notes / cold call notes */}
      {lead.coldCallNotes && (
        <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{lead.coldCallNotes}</p>
        </div>
      )}

      {/* Call history */}
      {lead.recentAttempts.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Call History</p>
          <div className="space-y-1.5">
            {lead.recentAttempts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'var(--surface)' }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.outcome ? 'var(--brand-blue)' : 'var(--text-secondary)' }} />
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {a.outcome ? OUTCOME_LABELS[a.outcome] ?? a.outcome : 'No outcome'}
                </span>
                {a.durationSeconds && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {Math.floor(a.durationSeconds / 60)}:{(a.durationSeconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{daysAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'No Answer', value: lead.noAnswerAttempts, color: '#6b7280' },
          { label: 'Voicemail', value: lead.voicemailAttempts, color: '#8b5cf6' },
          { label: 'Gatekeeper', value: lead.gatekeeperAttempts, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: 'var(--surface)' }}>
            <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        Last called: {daysAgo(lead.lastCalledAt)}
      </p>
    </div>
  );
}
