'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function BadDataForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [notes, setNotes] = useState('');
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#94a3b815', border: '1px solid #94a3b830' }}>
        <p className="text-xs font-semibold" style={{ color: '#64748b' }}>This lead will be removed from the queue permanently.</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Use this for wrong numbers, companies that no longer exist, or completely unreachable data.</p>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>What was wrong?</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. number disconnected, company closed down"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={() => onSubmit({ outcome: 'bad_data', notes: notes.trim() || undefined })} isSaving={isSaving} label="Remove from queue" submitColor="#94a3b8" />
    </div>
  );
}
