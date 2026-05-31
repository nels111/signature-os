'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function CallbackBookedForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [callbackAt, setCallbackAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!callbackAt) { setError('Set a callback date and time'); return; }
    setError('');
    onSubmit({ outcome: 'callback_booked', callbackAt: new Date(callbackAt).toISOString(), notes: notes.trim() || undefined });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        A callback confirmation email will be sent to <strong>{lead.companyName}</strong> automatically.
      </p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Callback date &amp; time *</label>
        <input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: error ? '#ef4444' : 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Who will you be speaking to?"
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} label="Book callback" />
    </div>
  );
}
