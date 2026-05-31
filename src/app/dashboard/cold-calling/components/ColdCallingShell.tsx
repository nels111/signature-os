'use client';

import { Phone, RefreshCw } from 'lucide-react';
import type { ColdCallingLead, ColdCallingStats, DiallerState, OutcomePayload, QueueResponse } from '@/lib/cold-calling/types';
import { LeadContextPanel } from './LeadContextPanel';
import { BrowserDiallerPanel } from './BrowserDiallerPanel';
import { OutcomePanel } from './OutcomePanel';
import { QueueSidebar } from './QueueSidebar';
import { AdminStatsPanel } from './AdminStatsPanel';

interface CallSession {
  state: DiallerState;
  activeLead: ColdCallingLead | null;
  attemptId: string | null;
  twilioCallSid: string | null;
  selectedOutcome: string | null;
  durationSeconds: number;
  error?: string;
}

interface Props {
  session: CallSession;
  queue: QueueResponse | null;
  queueLoading: boolean;
  stats: ColdCallingStats | null;
  statsRange: 'today' | 'week' | 'month';
  isVa: boolean;
  onSelectLead: (lead: ColdCallingLead) => void;
  onStartCall: () => void;
  onHangUp: () => void;
  onCallStateChange: (state: 'ringing' | 'in_call' | 'ended', callSid?: string) => void;
  onOutcomeSubmit: (payload: OutcomePayload) => Promise<void>;
  onStatsRangeChange: (range: 'today' | 'week' | 'month') => void;
  onRefresh: () => void;
}

export function ColdCallingShell({
  session,
  queue,
  queueLoading,
  stats,
  statsRange,
  isVa,
  onSelectLead,
  onStartCall,
  onHangUp,
  onCallStateChange,
  onOutcomeSubmit,
  onStatsRangeChange,
  onRefresh,
}: Props) {
  const { state, activeLead, attemptId, durationSeconds, error } = session;
  const canLog = state === 'ended' || (state === 'ready' && !activeLead?.phone);
  const isActiveCall = state === 'dialling' || state === 'ringing' || state === 'in_call';
  const isSaving = state === 'saving_outcome';

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--brand-blue) 12%, transparent)' }}>
            <Phone size={16} style={{ color: 'var(--brand-blue)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Cold Calling</h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isVa ? 'Your queue' : 'Team queue'} · {queue?.counts.callbacks ?? 0} callbacks · {queue?.counts.fresh ?? 0} fresh · {queue?.counts.followUps ?? 0} follow-ups
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={queueLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={12} className={queueLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-5 py-2 text-xs font-medium flex-shrink-0" style={{ background: '#ef444415', color: '#ef4444', borderBottom: '1px solid #ef444430' }}>
          {error}
        </div>
      )}

      {/* 3-column layout on desktop, stacked on mobile */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* Left: Queue sidebar (desktop only — shown as bottom sheet on mobile) */}
        <div className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
          <QueueSidebar
            queue={queue}
            loading={queueLoading}
            activeLead={activeLead}
            onSelectLead={onSelectLead}
          />
        </div>

        {/* Centre: Lead context + dialler */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {/* Lead context */}
          <div className="flex-shrink-0">
            <LeadContextPanel lead={activeLead} diallerState={state} />
          </div>

          {/* Dialler */}
          <div className="flex-shrink-0 px-5 pb-4">
            <BrowserDiallerPanel
              lead={activeLead}
              state={state}
              durationSeconds={durationSeconds}
              onStartCall={onStartCall}
              onHangUp={onHangUp}
              onCallStateChange={onCallStateChange}
              attemptId={attemptId}
            />
          </div>
        </div>

        {/* Right: Outcome panel */}
        <div className="lg:w-80 flex-shrink-0 overflow-y-auto" style={{ borderLeft: '1px solid var(--border)' }}>
          <OutcomePanel
            lead={activeLead}
            disabled={!canLog || isSaving}
            saving={isSaving}
            onSubmit={onOutcomeSubmit}
          />
        </div>
      </div>
      {/* Admin stats panel */}
      {!isVa && <AdminStatsPanel />}
    </div>
  );
}
