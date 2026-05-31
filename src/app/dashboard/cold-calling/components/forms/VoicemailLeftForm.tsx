'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function VoicemailLeftForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [notes, setNotes] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Left a voicemail at <strong>{lead.companyName}</strong>. Will be recycled in 3-5 days.
        {lead.voicemailAttempts >= 2 && <span className="text-red-400"> Warning: 3rd voicemail — will go dormant for 90 days.</span>}
      </p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. left message with reception number"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={() => onSubmit({ outcome: 'voicemail_left', notes: notes.trim() || undefined })} isSaving={isSaving} />
    </div>
  );
}
