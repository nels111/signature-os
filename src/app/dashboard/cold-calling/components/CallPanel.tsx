'use client';

import { Phone, PhoneOff } from 'lucide-react';
import type { ColdCallingLead } from '@/lib/cold-calling/types';

interface Props {
  lead: ColdCallingLead | null;
}

/**
 * Call panel — the VA calls on their own phone (no in-app dialler, no start
 * button). Shows the number as a tap-to-call link; they ring it and log the
 * outcome + notes.
 */
export function CallPanel({ lead }: Props) {
  if (!lead) return null;

  const number = lead.phone ?? lead.directNumber ?? null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center gap-2 text-center"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {number ? (
        <a
          href={`tel:${number.replace(/\s+/g, '')}`}
          className="flex items-center justify-center gap-2 text-lg font-mono font-semibold tracking-wide"
          style={{ color: 'var(--brand-blue)' }}
        >
          <Phone size={18} />
          {number}
        </a>
      ) : (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <PhoneOff size={16} />
          No phone number — log as bad data
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Call this number from your phone, then log the outcome and any notes.
      </p>
    </div>
  );
}
