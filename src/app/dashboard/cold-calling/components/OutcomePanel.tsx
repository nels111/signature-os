'use client';

import { useState } from 'react';
import {
  PhoneMissed, Phone, Users, Clock, MessageSquare,
  CalendarCheck, Calendar, XCircle, AlertTriangle, ChevronRight,
} from 'lucide-react';
import type { ColdCallingLead, ColdCallOutcome, OutcomePayload } from '@/lib/cold-calling/types';
import { NoAnswerForm } from './forms/NoAnswerForm';
import { VoicemailLeftForm } from './forms/VoicemailLeftForm';
import { GatekeeperForm } from './forms/GatekeeperForm';
import { CallbackBookedForm } from './forms/CallbackBookedForm';
import { DecisionMakerSpokeForm } from './forms/DecisionMakerSpokeForm';
import { SiteVisitBookedForm } from './forms/SiteVisitBookedForm';
import { ContractRenewalDateForm } from './forms/ContractRenewalDateForm';
import { NotInterestedForm } from './forms/NotInterestedForm';
import { BadDataForm } from './forms/BadDataForm';

interface OutcomeOption {
  value: ColdCallOutcome;
  label: string;
  color: string;
  icon: React.ElementType;
  description: string;
}

const OUTCOMES: OutcomeOption[] = [
  { value: 'no_answer',           label: 'No Answer',          color: '#6b7280', icon: PhoneMissed,    description: 'Nobody picked up' },
  { value: 'voicemail_left',      label: 'Voicemail Left',     color: '#8b5cf6', icon: Phone,          description: 'Left a voicemail' },
  { value: 'gatekeeper',         label: 'Gatekeeper',         color: '#3b82f6', icon: Users,          description: 'Spoke to receptionist or PA' },
  { value: 'callback_booked',    label: 'Callback Booked',    color: '#f59e0b', icon: Clock,          description: 'Set a specific time to call back' },
  { value: 'decision_maker_spoke', label: 'DM Spoke',         color: '#22c55e', icon: MessageSquare,  description: 'Got through to the right person' },
  { value: 'site_visit_booked',  label: 'Site Visit Booked',  color: '#10b981', icon: CalendarCheck,  description: 'Nick booked in to visit the site' },
  { value: 'contract_renewal_date', label: 'Renewal Date',    color: '#06b6d4', icon: Calendar,       description: 'Got their contract renewal date' },
  { value: 'not_interested',     label: 'Not Interested',     color: '#ef4444', icon: XCircle,        description: 'Not a fit right now' },
  { value: 'bad_data',           label: 'Bad Data',           color: '#94a3b8', icon: AlertTriangle,  description: 'Wrong number / company doesn\'t exist' },
];

interface OutcomeFormProps {
  lead: ColdCallingLead;
  onCancel: () => void;
  onSubmit: (payload: OutcomePayload) => void;
  isSaving: boolean;
}

function renderForm(outcome: ColdCallOutcome, props: OutcomeFormProps) {
  switch (outcome) {
    case 'no_answer': return <NoAnswerForm {...props} />;
    case 'voicemail_left': return <VoicemailLeftForm {...props} />;
    case 'gatekeeper': return <GatekeeperForm {...props} />;
    case 'callback_booked': return <CallbackBookedForm {...props} />;
    case 'decision_maker_spoke': return <DecisionMakerSpokeForm {...props} />;
    case 'site_visit_booked': return <SiteVisitBookedForm {...props} />;
    case 'contract_renewal_date': return <ContractRenewalDateForm {...props} />;
    case 'not_interested': return <NotInterestedForm {...props} />;
    case 'bad_data': return <BadDataForm {...props} />;
  }
}

interface Props {
  lead: ColdCallingLead | null;
  disabled: boolean;
  saving: boolean;
  onSubmit: (payload: OutcomePayload) => Promise<void>;
}

export function OutcomePanel({ lead, disabled, saving, onSubmit }: Props) {
  const [selected, setSelected] = useState<ColdCallOutcome | null>(null);

  const handleSubmit = async (payload: OutcomePayload) => {
    await onSubmit(payload);
    setSelected(null);
  };

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full p-5">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select a lead to log an outcome</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {selected ? 'Complete the details' : 'Select outcome'}
      </p>

      {selected ? (
        <>
          {renderForm(selected, {
            lead,
            isSaving: saving,
            onCancel: () => setSelected(null),
            onSubmit: handleSubmit,
          })}
        </>
      ) : (
        <div className="space-y-1.5">
          {OUTCOMES.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => !disabled && setSelected(opt.value)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `${opt.color}10`, border: `1px solid ${opt.color}20` }}
              >
                <Icon size={15} style={{ color: opt.color, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: opt.color }}>{opt.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{opt.description}</p>
                </div>
                <ChevronRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}

      {disabled && !selected && (
        <p className="text-xs text-center pt-2" style={{ color: 'var(--text-secondary)' }}>
          {saving ? 'Saving...' : 'Start or complete a call to log an outcome'}
        </p>
      )}
    </div>
  );
}
