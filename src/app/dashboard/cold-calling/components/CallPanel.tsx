'use client';

import { Phone, PhoneOff } from 'lucide-react';
import type { ColdCallingLead } from '@/lib/cold-calling/types';

interface Props {
  lead: ColdCallingLead | null;
  attemptId: string | null;
  onStartCall: () => void;
  starting?: boolean;
}

/**
 * Call panel — the VA calls on their own phone (no in-app dialler).
 * Shows the number as a tap-to-call link and a Start-call button that opens an
 * attempt to log the outcome against. Outcome logging is always available.
 */
export function CallPanel({ lead, attemptId, onStartCall, starting }: Props) {
  if (!lead) return null;

  const number = lead.phone ?? lead.directNumber ?? null;
  const started = !!attemptId;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
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
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <PhoneOff size={16} />
          No phone number — log as bad data
        </div>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
        {started
          ? 'Call in progress on your phone — log the outcome when you’re done.'
          : 'Call this number on your phone, then log the outcome.'}
      </p>

      {!started && number && (
        <button
          onClick={onStartCall}
          disabled={starting}
          className="w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--brand-blue)', color: '#fff', border: '1px solid var(--brand-blue)' }}
        >
          <Phone size={14} />
          {starting ? 'Starting…' : 'Start call'}
        </button>
      )}

      {started && (
        <div
          className="w-full py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
          style={{
            background: 'color-mix(in srgb, #22c55e 14%, transparent)',
            color: '#16a34a',
            border: '1px solid color-mix(in srgb, #22c55e 30%, transparent)',
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          Call started
        </div>
      )}
    </div>
  );
}
