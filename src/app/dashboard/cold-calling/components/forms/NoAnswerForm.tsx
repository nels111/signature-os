'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function NoAnswerForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [notes, setNotes] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Nobody picked up at <strong>{lead.companyName}</strong>. They&apos;ll be recycled into the queue automatically.
        {lead.noAnswerAttempts >= 4 && <span className="text-red-400"> Warning: 5th no answer — will go dormant for 90 days.</span>}
      </p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. tried morning, try afternoon next time"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={() => onSubmit({ outcome: 'no_answer', notes: notes.trim() || undefined })} isSaving={isSaving} />
    </div>
  );
}
