'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

export function GatekeeperForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [gatekeeperName, setGatekeeperName] = useState('');
  const [decisionMakerName, setDecisionMakerName] = useState('');
  const [directNumber, setDirectNumber] = useState('');
  const [bestTimeToCall, setBestTimeToCall] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => onSubmit({
    outcome: 'gatekeeper',
    gatekeeperName: gatekeeperName.trim() || undefined,
    decisionMakerName: decisionMakerName.trim() || undefined,
    directNumber: directNumber.trim() || undefined,
    bestTimeToCall: bestTimeToCall.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  const field = (label: string, value: string, setter: (v: string) => void, placeholder: string) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Capture what you learned. The more info the better for next time.</p>
      {field('Gatekeeper name', gatekeeperName, setGatekeeperName, 'e.g. Sarah')}
      {field('Decision maker name', decisionMakerName, setDecisionMakerName, 'e.g. James (Facilities Manager)')}
      {field('Direct number', directNumber, setDirectNumber, 'e.g. 01392 xxxxxx')}
      {field('Best time to call', bestTimeToCall, setBestTimeToCall, 'e.g. Tuesday morning after 9am')}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} />
    </div>
  );
}
