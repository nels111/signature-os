'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { ColdCallingLead, ColdCallingStats, DiallerState, OutcomePayload, QueueResponse } from '@/lib/cold-calling/types';
import { ColdCallingShell } from './ColdCallingShell';

interface CallSession {
  state: DiallerState;
  activeLead: ColdCallingLead | null;
  attemptId: string | null;
  twilioCallSid: string | null;
  selectedOutcome: string | null;
  durationSeconds: number;
  error?: string;
}

export function ColdCallingWorkspace() {
  const { data: session } = useSession();
  const isVa = session?.user?.role === 'va';

  // Queue state
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);

  // Stats state
  const [stats, setStats] = useState<ColdCallingStats | null>(null);
  const [statsRange, setStatsRange] = useState<'today' | 'week' | 'month'>('week');

  // Call session state machine
  const [callSession, setCallSession] = useState<CallSession>({
    state: 'loading',
    activeLead: null,
    attemptId: null,
    twilioCallSid: null,
    selectedOutcome: null,
    durationSeconds: 0,
  });

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch queue ────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/cold-calling/queue');
      if (!res.ok) throw new Error('Queue fetch failed');
      const data: QueueResponse = await res.json();
      setQueue(data);
      setCallSession(prev => ({
        ...prev,
        state: prev.state === 'loading' ? 'ready' : prev.state,
        activeLead: prev.activeLead ?? data.activeLead,
      }));
    } catch (err) {
      setCallSession(prev => ({ ...prev, state: 'error', error: 'Failed to load queue' }));
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async (range: 'today' | 'week' | 'month' = 'week') => {
    try {
      const res = await fetch(`/api/cold-calling/stats?range=${range}`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchStats(statsRange);
  }, [fetchQueue, fetchStats, statsRange]);

  // ── Select a lead from queue ───────────────────────────────────────────────
  const selectLead = useCallback((lead: ColdCallingLead) => {
    setCallSession(prev => ({
      ...prev,
      state: 'ready',
      activeLead: lead,
      attemptId: null,
      twilioCallSid: null,
      selectedOutcome: null,
      durationSeconds: 0,
    }));
  }, []);

  // ── Start call ────────────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    const lead = callSession.activeLead;
    if (!lead) return;

    setCallSession(prev => ({ ...prev, state: 'dialling', error: undefined }));

    try {
      // Create attempt record
      const res = await fetch('/api/cold-calling/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error('Failed to start call');
      const { attemptId } = await res.json();

      setCallSession(prev => ({ ...prev, attemptId, state: 'ringing' }));

      // Twilio browser dialler handled by BrowserDiallerPanel — it calls back with state updates
    } catch (err) {
      setCallSession(prev => ({
        ...prev,
        state: 'error',
        error: err instanceof Error ? err.message : 'Failed to start call',
      }));
    }
  }, [callSession.activeLead]);

  // ── Call state callbacks from dialler ────────────────────────────────────
  const handleCallStateChange = useCallback((state: 'ringing' | 'in_call' | 'ended', callSid?: string) => {
    setCallSession(prev => {
      const next = { ...prev };
      if (state === 'ringing') next.state = 'ringing';
      if (state === 'in_call') {
        next.state = 'in_call';
        if (callSid) {
          next.twilioCallSid = callSid;
          // Attach SID to attempt
          if (prev.attemptId) {
            fetch(`/api/cold-calling/calls/${prev.attemptId}/twilio`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ twilioCallSid: callSid, status: 'in_progress', startedAt: new Date().toISOString() }),
            }).catch(console.error);
          }
        }
        // Start duration timer
        let secs = 0;
        durationRef.current = setInterval(() => {
          secs++;
          setCallSession(p => ({ ...p, durationSeconds: secs }));
        }, 1000);
      }
      if (state === 'ended') {
        next.state = 'ended';
        if (durationRef.current) clearInterval(durationRef.current);
      }
      return next;
    });
  }, []);

  const handleHangUp = useCallback(() => {
    handleCallStateChange('ended');
  }, [handleCallStateChange]);

  // ── Log outcome ───────────────────────────────────────────────────────────
  const handleOutcomeSubmit = useCallback(async (payload: OutcomePayload) => {
    if (!callSession.attemptId) {
      // No attempt was created (manual log without dialler) — create one now
      const lead = callSession.activeLead;
      if (!lead) return;
      try {
        const res = await fetch('/api/cold-calling/calls/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id }),
        });
        if (!res.ok) throw new Error('Failed to create attempt');
        const { attemptId } = await res.json();
        setCallSession(prev => ({ ...prev, attemptId }));
        await submitOutcome(attemptId, payload);
      } catch (err) {
        setCallSession(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Failed' }));
      }
      return;
    }
    await submitOutcome(callSession.attemptId, payload);
  }, [callSession.attemptId, callSession.activeLead]);

  const submitOutcome = useCallback(async (attemptId: string, payload: OutcomePayload) => {
    setCallSession(prev => ({ ...prev, state: 'saving_outcome' }));
    try {
      const res = await fetch(`/api/cold-calling/calls/${attemptId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save outcome');
      }
      const data = await res.json();

      // Advance to next lead
      setCallSession({
        state: data.nextLead ? 'ready' : 'ready',
        activeLead: data.nextLead ?? null,
        attemptId: null,
        twilioCallSid: null,
        selectedOutcome: null,
        durationSeconds: 0,
      });

      // Refresh queue and stats silently
      fetchQueue();
      fetchStats(statsRange);

      window.dispatchEvent(new CustomEvent('sigos:call-logged'));
    } catch (err) {
      setCallSession(prev => ({
        ...prev,
        state: 'ended',
        error: err instanceof Error ? err.message : 'Failed to save outcome',
      }));
    }
  }, [fetchQueue, fetchStats, statsRange]);

  return (
    <ColdCallingShell
      session={callSession}
      queue={queue}
      queueLoading={queueLoading}
      stats={stats}
      statsRange={statsRange}
      isVa={isVa}
      onSelectLead={selectLead}
      onStartCall={handleStartCall}
      onHangUp={handleHangUp}
      onCallStateChange={handleCallStateChange}
      onOutcomeSubmit={handleOutcomeSubmit}
      onStatsRangeChange={setStatsRange}
      onRefresh={() => { fetchQueue(); fetchStats(statsRange); }}
    />
  );
}
