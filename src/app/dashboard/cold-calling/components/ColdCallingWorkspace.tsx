'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { ColdCallingLead, ColdCallingStats, DiallerState, OutcomePayload, QueueResponse } from '@/lib/cold-calling/types';
import { ColdCallingShell } from './ColdCallingShell';
import { LeadForm } from '../../leads/LeadForm';
import { Modal } from '@/components/ui/Modal';
import type { LeadFormData } from '@/lib/schemas/lead';

interface CallSession {
  state: DiallerState;
  activeLead: ColdCallingLead | null;
  attemptId: string | null;
  selectedOutcome: string | null;
  error?: string;
}

export function ColdCallingWorkspace() {
  const { data: session } = useSession();
  const isVa = session?.user?.role === 'va';

  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);

  const [stats, setStats] = useState<ColdCallingStats | null>(null);
  const [statsRange, setStatsRange] = useState<'today' | 'week' | 'month'>('week');

  const [callSession, setCallSession] = useState<CallSession>({
    state: 'loading',
    activeLead: null,
    attemptId: null,
    selectedOutcome: null,
  });

  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadLoading, setNewLeadLoading] = useState(false);

  // ── Fetch queue ────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/cold-calling/queue?limit=100');
      if (!res.ok) throw new Error('Queue fetch failed');
      const data: QueueResponse = await res.json();
      setQueue(data);
      const autoLead =
        data.activeLead ??
        data.queues.callbacks[0] ??
        data.queues.fresh[0] ??
        data.queues.followUps[0] ??
        data.queues.recycle[0] ??
        null;
      setCallSession(prev => ({
        ...prev,
        state: prev.state === 'loading' ? 'ready' : prev.state,
        activeLead: prev.activeLead ?? autoLead,
      }));
    } catch {
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
      selectedOutcome: null,
    }));
  }, []);

  // ── Log outcome (creates the attempt on submit; VA calls from their own phone) ─
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

      setCallSession({
        state: 'ready',
        activeLead: data.nextLead ?? null,
        attemptId: null,
        selectedOutcome: null,
      });

      fetchQueue();
      fetchStats(statsRange);
      window.dispatchEvent(new CustomEvent('sigos:call-logged'));
    } catch (err) {
      setCallSession(prev => ({
        ...prev,
        state: 'ready',
        error: err instanceof Error ? err.message : 'Failed to save outcome',
      }));
    }
  }, [fetchQueue, fetchStats, statsRange]);

  const handleOutcomeSubmit = useCallback(async (payload: OutcomePayload) => {
    if (callSession.attemptId) {
      await submitOutcome(callSession.attemptId, payload);
      return;
    }
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
      await submitOutcome(attemptId, payload);
    } catch (err) {
      setCallSession(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Failed' }));
    }
  }, [callSession.attemptId, callSession.activeLead, submitOutcome]);

  const handleCreateLead = async (data: LeadFormData) => {
    setNewLeadLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, stage: 'cold_call', source: data.source || 'cold_call' }),
      });
      if (!res.ok) throw new Error('Failed to create lead');
      setNewLeadOpen(false);
      setCallSession(prev => ({ ...prev, activeLead: null }));
      await fetchQueue();
    } catch (err) {
      console.error(err);
    } finally {
      setNewLeadLoading(false);
    }
  };

  return (
    <>
      <ColdCallingShell
        session={callSession}
        queue={queue}
        queueLoading={queueLoading}
        stats={stats}
        statsRange={statsRange}
        isVa={isVa}
        onSelectLead={selectLead}
        onOutcomeSubmit={handleOutcomeSubmit}
        onStatsRangeChange={setStatsRange}
        onNewLeadClick={() => setNewLeadOpen(true)}
        onRefresh={() => { fetchQueue(); fetchStats(statsRange); }}
      />
      {newLeadOpen && (
        <Modal open={newLeadOpen} title="Add Lead to Queue" onClose={() => setNewLeadOpen(false)}>
          <LeadForm
            initialData={{ stage: 'cold_call', source: 'cold_call' }}
            onSubmit={handleCreateLead}
            onCancel={() => setNewLeadOpen(false)}
            loading={newLeadLoading}
          />
        </Modal>
      )}
    </>
  );
}
