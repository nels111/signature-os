'use client';
import { useState } from 'react';
import type { ColdCallingLead, OutcomePayload, DecisionMakerSubOutcome } from '@/lib/cold-calling/types';
import { FormActions } from './FormActions';

interface Props { lead: ColdCallingLead; onCancel: () => void; onSubmit: (p: OutcomePayload) => void; isSaving: boolean; }

const SUB_OUTCOMES: { value: DecisionMakerSubOutcome; label: string; description: string }[] = [
  { value: 'send_info',        label: 'Send info',         description: 'Email them our overview now, follow up in 7 days' },
  { value: 'follow_up_1_week', label: 'Follow up in 1 week', description: 'Call back next week' },
  { value: 'follow_up_1_month', label: 'Follow up in 1 month', description: 'Not urgent — call back in a month' },
];

export function DecisionMakerSpokeForm({ lead, onCancel, onSubmit, isSaving }: Props) {
  const [subOutcome, setSubOutcome] = useState<DecisionMakerSubOutcome>('send_info');
  const [dmName, setDmName] = useState(lead.decisionMakerName ?? '');
  const [dmTitle, setDmTitle] = useState(lead.decisionMakerTitle ?? '');
  const [directNumber, setDirectNumber] = useState(lead.directNumber ?? '');
  const [estimatedSiteSize, setEstimatedSiteSize] = useState(lead.estimatedSiteSize ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!subOutcome) { setError('Select a follow-up action'); return; }
    setError('');
    onSubmit({
      outcome: 'decision_maker_spoke',
      decisionMakerSubOutcome: subOutcome,
      decisionMakerName: dmName.trim() || undefined,
      decisionMakerTitle: dmTitle.trim() || undefined,
      directNumber: directNumber.trim() || undefined,
      estimatedSiteSize: estimatedSiteSize.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const input = (label: string, value: string, setter: (v: string) => void, ph: string) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input value={value} onChange={e => setter(e.target.value)} placeholder={ph}
        className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text-secondary)' }}>What happens next? *</label>
        <div className="space-y-1.5">
          {SUB_OUTCOMES.map(so => (
            <button key={so.value} onClick={() => setSubOutcome(so.value)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: subOutcome === so.value ? '#22c55e18' : 'var(--surface)',
                border: `1px solid ${subOutcome === so.value ? '#22c55e' : 'var(--border)'}`,
              }}>
              <p className="text-sm font-semibold" style={{ color: subOutcome === so.value ? '#16a34a' : 'var(--text-primary)' }}>{so.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{so.description}</p>
            </button>
          ))}
        </div>
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      {input('Decision maker name', dmName, setDmName, 'e.g. James Turner')}
      {input('Job title', dmTitle, setDmTitle, 'e.g. Facilities Manager')}
      {input('Direct number', directNumber, setDirectNumber, 'e.g. 07700 xxxxxx')}
      {input('Estimated site size', estimatedSiteSize, setEstimatedSiteSize, 'e.g. 3 floors, ~50 staff')}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="What did they say? Any useful intel..."
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
      </div>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} isSaving={isSaving} label="Log conversation" />
    </div>
  );
}
