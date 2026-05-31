'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function ContractRenewalDateForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [contractRenewalDate, setContractRenewalDate] = useState('');
  const [currentSupplier, setCurrentSupplier] = useState(lead.currentSupplier ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!contractRenewalDate) { setError('Enter the renewal date'); return; }
    setError('');
    onSubmit({
      outcome: 'contract_renewal_date',
      contractRenewalDate: new Date(contractRenewalDate).toISOString(),
      currentSupplier: currentSupplier.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        We&apos;ll contact them 60 days before renewal. A follow-up task will be created automatically.
      </p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Contract renewal date *</label>
        <input type="date" value={contractRenewalDate} onChange={e => setContractRenewalDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: error ? '#ef4444' : 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Current supplier</label>
        <input value={currentSupplier} onChange={e => setCurrentSupplier(e.target.value)} placeholder="e.g. Initial Washroom Solutions"
          className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} label="Save renewal date" />
    </div>
  );
}
