'use client';

import { useState, useEffect } from 'react';
import { Phone, RefreshCw, List, X, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import type { ColdCallingLead, ColdCallingStats, DiallerState, OutcomePayload, QueueResponse } from '@/lib/cold-calling/types';
import { LeadContextPanel } from './LeadContextPanel';
import { CallPanel } from './CallPanel';
import { OutcomePanel } from './OutcomePanel';
import { QueueSidebar } from './QueueSidebar';
import { AdminStatsPanel } from './AdminStatsPanel';

interface CallSession {
  state: DiallerState;
  activeLead: ColdCallingLead | null;
  attemptId: string | null;
  selectedOutcome: string | null;
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
  onOutcomeSubmit: (payload: OutcomePayload) => Promise<void>;
  onStatsRangeChange: (range: 'today' | 'week' | 'month') => void;
  onNewLeadClick: () => void;
  onRefresh: () => void;
}

export function ColdCallingShell({
  session,
  queue,
  queueLoading,
  stats,
  isVa,
  onSelectLead,
  onStartCall,
  onOutcomeSubmit,
  onNewLeadClick,
  onRefresh,
}: Props) {
  const { state, activeLead, attemptId, error } = session;
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const [mobileOutcomeOpen, setMobileOutcomeOpen] = useState(false);
  const [leadDetailsOpen, setLeadDetailsOpen] = useState(false);

  const isSaving = state === 'saving_outcome';
  // The VA calls on their own phone, so the outcome is always loggable once a
  // lead is active (no in-app dialler gating it behind a "call ended" state).
  const canLog = !!activeLead && !isSaving;
  const callStarted = !!attemptId;

  // Close lead details + mobile outcome sheet when the active lead changes.
  useEffect(() => {
    setLeadDetailsOpen(false);
    setMobileOutcomeOpen(false);
  }, [activeLead?.id]);

  const handleOutcomeSubmit = async (payload: OutcomePayload) => {
    setMobileOutcomeOpen(false);
    await onOutcomeSubmit(payload);
  };

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
        <div className="flex items-center gap-2">
          {/* Mobile-only queue toggle */}
          <button
            onClick={() => setMobileQueueOpen(true)}
            className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <List size={12} />
            <span>Queue</span>
            {queue && (queue.counts.callbacks + queue.counts.fresh + queue.counts.followUps) > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white"
                style={{ background: 'var(--brand-blue)' }}
              >
                {queue.counts.callbacks + queue.counts.fresh + queue.counts.followUps}
              </span>
            )}
          </button>
          <button
            onClick={onNewLeadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--brand-blue)', border: '1px solid var(--brand-blue)', color: '#fff' }}
          >
            <UserPlus size={12} />
            New Lead
          </button>
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
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-5 py-2 text-xs font-medium flex-shrink-0" style={{ background: '#ef444415', color: '#ef4444', borderBottom: '1px solid #ef444430' }}>
          {error}
        </div>
      )}

      {/* ── MOBILE LAYOUT (lg:hidden) ── */}
      <div className="flex-1 overflow-y-auto flex-col lg:hidden flex">
        {activeLead ? (
          <>
            {/* Compact lead card */}
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{ background: callStarted ? '#22c55e18' : 'color-mix(in srgb, var(--brand-blue) 10%, transparent)', color: callStarted ? '#16a34a' : 'var(--brand-blue)' }}
                >
                  {activeLead.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{activeLead.companyName}</p>
                  {activeLead.phone && (
                    <p className="text-xs font-mono" style={{ color: 'var(--brand-blue)' }}>{activeLead.phone}</p>
                  )}
                  {activeLead.decisionMakerName && (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>DM: {activeLead.decisionMakerName}</p>
                  )}
                </div>
                <button
                  onClick={() => setLeadDetailsOpen(v => !v)}
                  className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {leadDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {/* Collapsible lead details */}
            {leadDetailsOpen && (
              <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <LeadContextPanel lead={activeLead} diallerState={state} />
              </div>
            )}

            {/* Call panel — number + start (VA dials on own phone) */}
            <div className="flex-shrink-0 px-4 pb-4">
              <CallPanel lead={activeLead} attemptId={attemptId} onStartCall={onStartCall} />
            </div>

            {/* Log outcome — always available */}
            {!mobileOutcomeOpen && (
              <div className="flex-shrink-0 px-4 pb-4">
                <button
                  onClick={() => setMobileOutcomeOpen(true)}
                  disabled={!canLog}
                  className="w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'color-mix(in srgb, var(--brand-blue) 15%, transparent)', color: 'var(--brand-blue)', border: '1px solid color-mix(in srgb, var(--brand-blue) 30%, transparent)' }}
                >
                  Log Outcome
                </button>
              </div>
            )}
          </>
        ) : (
          <LeadContextPanel lead={null} diallerState={state} />
        )}
      </div>

      {/* ── DESKTOP LAYOUT (hidden lg:flex) ── */}
      <div className="flex-1 overflow-hidden hidden lg:flex lg:flex-row">
        {/* Left: Queue sidebar */}
        <div className="flex flex-col w-64 flex-shrink-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
          <QueueSidebar
            queue={queue}
            loading={queueLoading}
            activeLead={activeLead}
            onSelectLead={onSelectLead}
          />
        </div>

        {/* Centre: Lead context + call panel */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          <div className="flex-shrink-0">
            <LeadContextPanel lead={activeLead} diallerState={state} />
          </div>
          {activeLead && (
            <div className="flex-shrink-0 px-5 pb-4">
              <CallPanel lead={activeLead} attemptId={attemptId} onStartCall={onStartCall} />
            </div>
          )}
        </div>

        {/* Right: Outcome panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto" style={{ borderLeft: '1px solid var(--border)' }}>
          <OutcomePanel
            lead={activeLead}
            disabled={!canLog}
            saving={isSaving}
            onSubmit={onOutcomeSubmit}
          />
        </div>
      </div>

      {/* Admin stats panel (desktop only) */}
      {!isVa && <AdminStatsPanel />}

      {/* ── MOBILE: Queue bottom sheet ── */}
      {mobileQueueOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 bg-black" onClick={() => setMobileQueueOpen(false)} />
          <div className="relative rounded-t-2xl max-h-[90vh] flex flex-col" style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.12)', '--text-primary': '#ffffff', '--text-secondary': 'rgba(255,255,255,0.55)', '--border': 'rgba(255,255,255,0.1)', '--surface': 'rgba(255,255,255,0.07)' } as React.CSSProperties}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <List size={15} style={{ color: 'var(--brand-blue)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Call Queue</h3>
              </div>
              <button onClick={() => setMobileQueueOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <QueueSidebar
                queue={queue}
                loading={queueLoading}
                activeLead={activeLead}
                onSelectLead={(lead) => { onSelectLead(lead); setMobileQueueOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE: Outcome bottom sheet ── */}
      {mobileOutcomeOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 bg-black" onClick={() => setMobileOutcomeOpen(false)} />
          <div className="relative rounded-t-2xl max-h-[85vh] flex flex-col" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Log Outcome</h3>
                {activeLead && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{activeLead.companyName}</p>
                )}
              </div>
              <button onClick={() => setMobileOutcomeOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <OutcomePanel
                lead={activeLead}
                disabled={!canLog}
                saving={isSaving}
                onSubmit={handleOutcomeSubmit}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
