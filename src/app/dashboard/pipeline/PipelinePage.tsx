'use client';

import { useState, useEffect, useCallback } from 'react';
import { KanbanBoard } from './KanbanBoard';
import type { KanbanColumn } from './KanbanBoard';
import { LeadKanbanCard, DealKanbanCard } from './KanbanCard';
import { Modal } from '@/components/ui/Modal';

interface LeadItem {
  id: string;
  companyName: string;
  contactName: string;
  source: string;
  stage: string;
  owner: { id: string; name: string | null } | null;
  [key: string]: unknown;
}

interface DealItem {
  id: string;
  name: string;
  stage: string;
  value: string | number | null;
  owner: { id: string; name: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  [key: string]: unknown;
}

const LEAD_STAGES = [
  { id: 'cold_call', label: 'Cold Call', color: 'var(--stage-cold-call)' },
  { id: 'cold_email', label: 'Cold Email', color: 'var(--stage-cold-email)' },
  { id: 'follow_up_sequence', label: 'Follow-up Sequence', color: 'var(--stage-follow-up)' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'var(--stage-meeting)' },
  { id: 'meeting_attended', label: 'Meeting Attended', color: 'var(--stage-attended)' },
  { id: 'quote_delivered', label: 'Quote Delivered', color: 'var(--brand-blue)' },
];

const DEAL_STAGES = [
  { id: 'quote_sent', label: 'Quote Sent', color: 'var(--deal-quote-sent)' },
  { id: 'follow_up_from_quote', label: 'Follow-up from Quote', color: 'var(--deal-follow-up)' },
  { id: 'closed_won', label: 'Closed Won', color: 'var(--deal-won)' },
  { id: 'closed_lost', label: 'Closed Lost', color: 'var(--deal-lost)' },
];

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '£0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '£0';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PipelinePage() {
  const [activeTab, setActiveTab] = useState<'leads' | 'deals'>('leads');
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Loss reason modal state
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [pendingLossDealId, setPendingLossDealId] = useState<string | null>(null);

  // Meeting outcome modal state
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [meetingOutcome, setMeetingOutcome] = useState('');
  const [pendingOutcomeLeadId, setPendingOutcomeLeadId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/leads?limit=100&sortBy=createdAt&sortDir=desc');
    const json = await res.json();
    return json.data || [];
  }, []);

  const fetchDeals = useCallback(async () => {
    const res = await fetch('/api/deals?limit=100&sortBy=createdAt&sortDir=desc');
    const json = await res.json();
    return json.data || [];
  }, []);

  const reloadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch {
      // ignore
    }
  }, [fetchLeads]);

  const reloadDeals = useCallback(async () => {
    try {
      const data = await fetchDeals();
      setDeals(data);
    } catch {
      // ignore
    }
  }, [fetchDeals]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [leadsData, dealsData] = await Promise.all([fetchLeads(), fetchDeals()]);
        if (!cancelled) {
          setLeads(leadsData);
          setDeals(dealsData);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [fetchLeads, fetchDeals]);

  // Show toast
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  // Handle lead drag
  const handleLeadDragEnd = useCallback(
    async (itemId: string, _fromColumn: string, toColumn: string) => {
      // If moving to meeting_attended, show outcome modal
      if (toColumn === 'meeting_attended') {
        setPendingOutcomeLeadId(itemId);
        setMeetingOutcome('');
        setShowOutcomeModal(true);
        return;
      }

      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === itemId ? { ...l, stage: toColumn } : l))
      );

      try {
        const res = await fetch(`/api/leads/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: toColumn }),
        });

        if (res.ok) {
          const data = await res.json();
          if (toColumn === 'quote_delivered' && data.deal) {
            showToast(`Deal "${data.deal.name}" auto-created from this lead`);
            reloadDeals();
          }
          reloadLeads();
        } else {
          reloadLeads(); // Revert on error
        }
      } catch {
        reloadLeads();
      }
    },
    [reloadLeads, reloadDeals]
  );

  // Handle deal drag
  const handleDealDragEnd = useCallback(
    async (itemId: string, _fromColumn: string, toColumn: string) => {
      // If moving to closed_lost, show loss reason modal
      if (toColumn === 'closed_lost') {
        setPendingLossDealId(itemId);
        setLossReason('');
        setShowLossModal(true);
        return;
      }

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) => (d.id === itemId ? { ...d, stage: toColumn } : d))
      );

      try {
        const res = await fetch(`/api/deals/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: toColumn }),
        });

        if (res.ok) {
          if (toColumn === 'closed_won') {
            showToast('Deal marked as Won! 🎉');
          }
          reloadDeals();
        } else {
          reloadDeals();
        }
      } catch {
        reloadDeals();
      }
    },
    [reloadDeals]
  );

  // Confirm loss reason
  const handleConfirmLoss = async () => {
    if (!pendingLossDealId) return;

    setShowLossModal(false);
    setDeals((prev) =>
      prev.map((d) =>
        d.id === pendingLossDealId ? { ...d, stage: 'closed_lost' } : d
      )
    );

    try {
      await fetch(`/api/deals/${pendingLossDealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'closed_lost',
          ...(lossReason ? { lossReason } : {}),
        }),
      });
      reloadDeals();
    } catch {
      reloadDeals();
    }

    setPendingLossDealId(null);
    setLossReason('');
  };

  // Confirm meeting outcome
  const handleConfirmOutcome = async () => {
    if (!pendingOutcomeLeadId || !meetingOutcome) return;

    setShowOutcomeModal(false);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === pendingOutcomeLeadId ? { ...l, stage: 'meeting_attended' } : l
      )
    );

    try {
      await fetch(`/api/leads/${pendingOutcomeLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'meeting_attended',
          meetingOutcome,
        }),
      });
      fetchLeads();
    } catch {
      fetchLeads();
    }

    setPendingOutcomeLeadId(null);
    setMeetingOutcome('');
  };

  // Build columns
  const leadColumns: KanbanColumn<LeadItem>[] = LEAD_STAGES.map((stage) => ({
    ...stage,
    items: leads.filter((l) => l.stage === stage.id),
  }));

  const dealColumns: KanbanColumn<DealItem>[] = DEAL_STAGES.map((stage) => ({
    ...stage,
    items: deals.filter((d) => d.stage === stage.id),
  }));

  // Deal summary stats
  const pipelineDeals = deals.filter(
    (d) => d.stage === 'quote_sent' || d.stage === 'follow_up_from_quote'
  );
  const wonDeals = deals.filter((d) => d.stage === 'closed_won');
  const lostDeals = deals.filter((d) => d.stage === 'closed_lost');

  const sumValue = (items: DealItem[]) =>
    items.reduce((acc, d) => {
      const v = d.value ? (typeof d.value === 'string' ? parseFloat(d.value) : d.value) : 0;
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

  const pipelineValue = sumValue(pipelineDeals);
  const wonValue = sumValue(wonDeals);
  const lostCount = lostDeals.length;

  const tabs = [
    { key: 'leads' as const, label: 'Lead Pipeline' },
    { key: 'deals' as const, label: 'Deal Pipeline' },
  ];

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-8 w-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
          <div className="h-4 w-56 rounded-lg mt-2 animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
          {['Lead Pipeline', 'Deal Pipeline'].map((t) => (
            <div key={t} className="px-4 py-2 rounded-t">
              <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
            </div>
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <div className="px-3 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
                <div className="h-4 w-28 rounded animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
              </div>
              <div className="p-2 space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                    <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
                    <div className="h-3 w-2/3 rounded mt-2 animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Pipeline
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Drag cards between columns to update stages
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={
              activeTab === tab.key
                ? { borderColor: 'var(--brand-green-accent)', color: 'var(--brand-green)' }
                : { borderColor: 'transparent', color: 'var(--text-secondary)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lead Pipeline */}
      {activeTab === 'leads' && (
        <KanbanBoard<LeadItem>
          columns={leadColumns}
          onDragEnd={handleLeadDragEnd}
          getItemId={(item) => item.id}
          renderCard={(item) => <LeadKanbanCard item={item} />}
        />
      )}

      {/* Deal Pipeline */}
      {activeTab === 'deals' && (
        <>
          <KanbanBoard<DealItem>
            columns={dealColumns}
            onDragEnd={handleDealDragEnd}
            getItemId={(item) => item.id}
            renderCard={(item) => <DealKanbanCard item={item} />}
          />

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Total Pipeline Value
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(pipelineValue)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {pipelineDeals.length} active deal{pipelineDeals.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--status-success)', backgroundColor: 'var(--status-success-bg)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--status-success)' }}>
                Won
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--status-success)' }}>
                {formatCurrency(wonValue)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {wonDeals.length} deal{wonDeals.length !== 1 ? 's' : ''} won
              </p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--status-danger)', backgroundColor: 'var(--status-danger-bg)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--status-danger)' }}>
                Lost
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--status-danger)' }}>
                {lostCount}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                deal{lostCount !== 1 ? 's' : ''} lost
              </p>
            </div>
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm text-white"
          style={{ backgroundColor: 'var(--brand-blue)' }}
        >
          {toast}
        </div>
      )}

      {/* Loss Reason Modal */}
      <Modal
        open={showLossModal}
        onClose={() => {
          setShowLossModal(false);
          setPendingLossDealId(null);
        }}
        title="Mark Deal as Lost"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Optionally provide a reason for losing this deal.
          </p>
          <textarea
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
            placeholder="Why was this deal lost? (optional)"
            rows={3}
            className="w-full px-3 py-2 text-sm border rounded-lg focus-brand"
            style={{ borderColor: 'var(--border)' }}
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowLossModal(false);
                setPendingLossDealId(null);
              }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLoss}
              className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90"
              style={{ backgroundColor: '#ef4444' }}
            >
              Mark as Lost
            </button>
          </div>
        </div>
      </Modal>

      {/* Meeting Outcome Modal */}
      <Modal
        open={showOutcomeModal}
        onClose={() => {
          setShowOutcomeModal(false);
          setPendingOutcomeLeadId(null);
        }}
        title="Meeting Outcome"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            How did the meeting go?
          </p>
          <select
            value={meetingOutcome}
            onChange={(e) => setMeetingOutcome(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus-brand"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="">Select outcome...</option>
            <option value="good">Good</option>
            <option value="bad">Bad</option>
            <option value="not_interested">Not Interested</option>
          </select>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowOutcomeModal(false);
                setPendingOutcomeLeadId(null);
              }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmOutcome}
              disabled={!meetingOutcome}
              className="px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
