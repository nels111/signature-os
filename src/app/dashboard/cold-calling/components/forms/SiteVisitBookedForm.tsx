'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function SiteVisitBookedForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [siteVisitAt, setSiteVisitAt] = useState('');
  const [siteVisitAddress, setSiteVisitAddress] = useState('');
  const [siteVisitContact, setSiteVisitContact] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!siteVisitAt) { setError('Set the visit date and time'); return; }
    setError('');
    onSubmit({
      outcome: 'site_visit_booked',
      siteVisitAt: new Date(siteVisitAt).toISOString(),
      siteVisitAddress: siteVisitAddress.trim() || undefined,
      siteVisitContact: siteVisitContact.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const input = (label: string, value: string, setter: (v: string) => void, ph: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type={type} value={value} onChange={e => setter(e.target.value)} placeholder={ph}
        className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#10b98110', border: '1px solid #10b98130' }}>
        <p className="text-xs font-semibold" style={{ color: '#059669' }}>Nick will be notified automatically</p>
        <p className="text-xs mt-0.5" style={{ color: '#065f46' }}>A confirmation email will also be sent to {lead.companyName}.</p>
      </div>
      {input('Visit date & time *', siteVisitAt, setSiteVisitAt, '', 'datetime-local')}
      {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      {input('Site address', siteVisitAddress, setSiteVisitAddress, 'e.g. 14 Marsh Barton Road, Exeter')}
      {input('Contact on arrival', siteVisitContact, setSiteVisitContact, 'e.g. James Turner, Facilities Manager')}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes for Nick</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything Nick should know before the visit..."
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} label="Confirm site visit" />
    </div>
  );
}
