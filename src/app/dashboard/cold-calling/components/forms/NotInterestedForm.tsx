'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload, NotInterestedReason } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

const REASONS: { value: NotInterestedReason; label: string; note: string }[] = [
  { value: 'happy_with_supplier', label: 'Happy with current supplier', note: 'Will re-queue in 6 months' },
  { value: 'in_house_team',       label: 'In-house cleaning team',      note: 'Archived — not a prospect' },
  { value: 'no_budget',           label: 'No budget',                   note: 'Archived — revisit if they reach out' },
  { value: 'not_responsible',     label: 'Not the right person',        note: 'Archived — try to get a referral' },
  { value: 'never_outsource',     label: 'Never outsource cleaning',    note: 'Archived permanently' },
  { value: 'other',               label: 'Other',                       note: 'Archived' },
];

export function NotInterestedForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [reason, setReason] = useState<NotInterestedReason | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!reason) { setError('Select a reason'); return; }
    setError('');
    onSubmit({ outcome: 'not_interested', notInterestedReason: reason as NotInterestedReason, notes: notes.trim() || undefined });
  };

  const selected = REASONS.find(r => r.value === reason);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text-secondary)' }}>Reason *</label>
        <div className="space-y-1.5">
          {REASONS.map(r => (
            <button key={r.value} onClick={() => setReason(r.value)}
              className="w-full text-left px-3 py-2 rounded-lg transition-all"
              style={{
                background: reason === r.value ? '#ef444415' : 'var(--surface)',
                border: `1px solid ${reason === r.value ? '#ef4444' : 'var(--border)'}`,
              }}>
              <p className="text-sm font-medium" style={{ color: reason === r.value ? '#ef4444' : 'var(--text-primary)' }}>{r.label}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{r.note}</p>
            </button>
          ))}
        </div>
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} label="Mark not interested" />
    </div>
  );
}
