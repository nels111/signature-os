'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, Clock, Users,
  Mail, ChevronRight, X, RefreshCw, Mic, MicOff, Loader2,
  CalendarCheck,
} from 'lucide-react';
import { useTwilioDevice, type CallState } from '@/hooks/useTwilioDevice';

interface QueueLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  stage: string;
  stageChangedAt: string;
  lastCalledAt: string | null;
  callbackDate: string | null;
  isCallback: boolean;
  notes: string | null;
  sector: string | null;
  owner: { id: string; name: string | null } | null;
}

const OUTCOME_OPTIONS = [
  { value: 'site_visit_booked', label: 'Site Visit Booked', color: '#10b981', icon: CalendarCheck },
  { value: 'answered',          label: 'Answered',          color: '#22c55e', icon: PhoneCall },
  { value: 'callback_needed',   label: 'Callback Needed',   color: '#f59e0b', icon: Clock },
  { value: 'no_answer',         label: 'No Answer',         color: '#6b7280', icon: PhoneMissed },
  { value: 'voicemail',         label: 'Voicemail',         color: '#8b5cf6', icon: Phone },
  { value: 'gatekeeper',        label: 'Gatekeeper',        color: '#3b82f6', icon: Users },
  { value: 'not_interested',    label: 'Not Interested',    color: '#ef4444', icon: PhoneOff },
];

const STAGE_LABEL: Record<string, string> = {
  new_lead: 'New Lead',
  cold_call: 'Cold Call',
  follow_up_sequence: 'Follow-up',
};

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// State label shown in the in-call banner
const CALL_STATE_LABEL: Record<CallState, string> = {
  idle: 'Ready',
  connecting: 'Connecting...',
  ringing: 'Ringing...',
  'in-call': 'On Call',
  ending: 'Call Ended',
  error: 'Error',
};

const CALL_STATE_COLOR: Record<CallState, string> = {
  idle: 'var(--text-secondary)',
  connecting: '#f59e0b',
  ringing: '#3b82f6',
  'in-call': '#22c55e',
  ending: 'var(--text-secondary)',
  error: '#ef4444',
};

// ───────────────────────────────────────────────────────────
// CallDialer — live Twilio calling + outcome logging in one panel
// ───────────────────────────────────────────────────────────
interface CallDialerProps {
  lead: QueueLead;
  onClose: () => void;
  onLogged: () => void;
}

function CallDialer({ lead, onClose, onLogged }: CallDialerProps) {
  const { callState, callSid, callDuration, isMuted, error: deviceError, startCall, hangUp, toggleMute } = useTwilioDevice();

  // Phase: 'ready' | 'calling' | 'log-outcome' | 'done'
  const [phase, setPhase] = useState<'ready' | 'calling' | 'log-outcome' | 'done'>('ready');

  // Outcome form state
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  // Site visit: best time for Nick to call back
  const [visitCallbackTime, setVisitCallbackTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Transition to log-outcome when call ends
  useEffect(() => {
    if (callState === 'ending' && phase === 'calling') {
      setPhase('log-outcome');
    }
  }, [callState, phase]);

  const handleStartCall = async () => {
    if (!lead.phone) return;
    setPhase('calling');
    await startCall(lead.phone);
  };

  const handleHangUp = () => {
    hangUp();
    // Transition handled by callState 'ending' effect above
  };

  const handleLog = async () => {
    if (!outcome) { setFormError('Select an outcome'); return; }
    if (outcome === 'callback_needed' && !callbackDate) { setFormError('Set a callback date'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const parts: string[] = [OUTCOME_OPTIONS.find(o => o.value === outcome)?.label || outcome];
      if (notes.trim()) parts.push(notes.trim());
      if (callbackDate && outcome === 'callback_needed') {
        parts.push(`Callback: ${new Date(callbackDate).toLocaleString('en-GB')}`);
      }
      if (visitCallbackTime.trim() && outcome === 'site_visit_booked') {
        parts.push(`Best time for Nick to call: ${visitCallbackTime.trim()}`);
      }

      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'call',
          description: parts.join('. '),
          entityType: 'lead',
          entityId: lead.id,
          metadata: {
            callOutcome: outcome,
            notes: notes.trim() || undefined,
            callbackDate: callbackDate || undefined,
            visitCallbackTime: visitCallbackTime.trim() || undefined,
            callSid: callSid || undefined,
            callDuration: callDuration || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to log call');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sigos:call-logged'));
      }
      setPhase('done');
      setTimeout(() => onLogged(), 600);
    } catch {
      setFormError('Failed to log call. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!lead.email) { setFormError('No email address for this lead'); return; }
    setEmailSending(true);
    setFormError('');
    try {
      const res = await fetch(`/api/leads/${lead.id}/send-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, notes: notes.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Send failed');
      }
      setEmailSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setEmailSending(false);
    }
  };

  const selectedOutcome = OUTCOME_OPTIONS.find(o => o.value === outcome);
  const isActiveCall = callState === 'connecting' || callState === 'ringing' || callState === 'in-call';

  return (
    <div
      className="fixed inset-y-0 right-0 w-full max-w-sm shadow-2xl flex flex-col z-50"
      style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Phone size={16} style={{ color: 'var(--brand-blue)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {phase === 'calling' ? CALL_STATE_LABEL[callState] : phase === 'log-outcome' ? 'Log Outcome' : phase === 'done' ? 'Logged' : 'Call Lead'}
          </span>
        </div>
        <button onClick={onClose} disabled={isActiveCall} aria-label="Close call panel" className="p-1 rounded hover:opacity-70 disabled:opacity-30">
          <X size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Lead info card — always visible */}
        <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{lead.companyName}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.contactName}</p>
          {lead.phone && (
            <p className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--brand-blue)' }}>
              <Phone size={11} /> {lead.phone}
            </p>
          )}
          {lead.email && (
            <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Mail size={11} /> {lead.email}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
              {STAGE_LABEL[lead.stage] || lead.stage}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>In stage: {daysAgo(lead.stageChangedAt)}</span>
          </div>
        </div>

        {/* PHASE: ready — script + call button */}
        {phase === 'ready' && (
          <>
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>SCRIPT OPENER</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                &ldquo;Oh hi, it&apos;s Jasmine from Signature Cleans. How are you?&rdquo;
              </p>
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>— wait for reply —</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                &ldquo;I was just ringing to see who looks after your cleaning over there?&rdquo;
              </p>
            </div>
            {deviceError && (
              <p className="text-xs rounded px-3 py-2" style={{ background: '#ef444418', color: '#ef4444' }}>{deviceError}</p>
            )}
            {!lead.phone && (
              <p className="text-xs" style={{ color: '#f59e0b' }}>No phone number — log manually below.</p>
            )}
          </>
        )}

        {/* PHASE: calling — in-call UI */}
        {phase === 'calling' && (
          <div className="flex flex-col items-center gap-6 py-6">
            {/* Status indicator */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: `${CALL_STATE_COLOR[callState]}20`, border: `2px solid ${CALL_STATE_COLOR[callState]}` }}
              >
                {callState === 'connecting' || callState === 'ringing' ? (
                  <Loader2 size={28} className="animate-spin" style={{ color: CALL_STATE_COLOR[callState] }} />
                ) : (
                  <Phone size={28} style={{ color: CALL_STATE_COLOR[callState] }} />
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: CALL_STATE_COLOR[callState] }}>
                {CALL_STATE_LABEL[callState]}
              </p>
              {callState === 'in-call' && (
                <p className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatDuration(callDuration)}
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Calling from +44 7480 486271
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Call is being recorded
              </p>
            </div>

            {/* In-call controls */}
            {callState === 'in-call' && (
              <div className="flex gap-4">
                <button
                  onClick={toggleMute}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all"
                  style={{
                    background: isMuted ? '#ef444418' : 'var(--surface)',
                    border: `1px solid ${isMuted ? '#ef4444' : 'var(--border)'}`,
                    color: isMuted ? '#ef4444' : 'var(--text-secondary)',
                  }}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
              </div>
            )}

            {deviceError && (
              <p className="text-xs text-center rounded px-3 py-2" style={{ background: '#ef444418', color: '#ef4444' }}>{deviceError}</p>
            )}
          </div>
        )}

        {/* PHASE: log-outcome — outcome form */}
        {(phase === 'log-outcome' || (phase === 'ready' && !lead.phone)) && (
          <>
            {phase === 'log-outcome' && callDuration > 0 && (
              <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: '#22c55e18', border: '1px solid #22c55e30' }}>
                <PhoneOff size={14} style={{ color: '#16a34a' }} />
                <p className="text-xs" style={{ color: '#16a34a' }}>
                  Call ended · {formatDuration(callDuration)} · Recording being processed
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>OUTCOME</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOME_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = outcome === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setOutcome(opt.value)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all"
                      style={{
                        border: `1px solid ${selected ? opt.color : 'var(--border)'}`,
                        background: selected ? `${opt.color}18` : 'var(--surface)',
                        color: selected ? opt.color : 'var(--text-secondary)',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      <Icon size={12} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {outcome === 'callback_needed' && (
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>CALLBACK DATE/TIME</label>
                <input
                  type="datetime-local"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {outcome === 'site_visit_booked' && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: '#10b98110', border: '1px solid #10b98130' }}>
                <p className="text-xs font-semibold" style={{ color: '#059669' }}>NICK TO ARRANGE</p>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Best time for Nick to call back (optional)</label>
                  <input
                    type="text"
                    value={visitCallbackTime}
                    onChange={(e) => setVisitCallbackTime(e.target.value)}
                    placeholder="e.g. Monday afternoon, after 2pm"
                    className="w-full border rounded px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                </div>
                <p className="text-[10px]" style={{ color: '#059669' }}>
                  Creates a task for Nick to call and arrange the visit. Nelson and Nick will be notified.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>NOTES (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Quick note about the call..."
                className="w-full border rounded px-3 py-2 text-sm resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              />
            </div>

            {formError && <p className="text-xs" style={{ color: '#ef4444' }}>{formError}</p>}
          </>
        )}

        {/* PHASE: done */}
        {phase === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#22c55e20' }}>
              <PhoneCall size={24} style={{ color: '#22c55e' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Call logged</p>
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              Recording will be attached automatically once processing is complete.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Ready phase — call button or manual log */}
        {phase === 'ready' && lead.phone && (
          <button
            onClick={handleStartCall}
            className="w-full py-3 text-sm font-semibold text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#22c55e' }}
          >
            <Phone size={16} />
            Call {lead.phone}
          </button>
        )}

        {/* Calling phase — hang up */}
        {phase === 'calling' && (
          <button
            onClick={handleHangUp}
            disabled={callState === 'connecting'}
            className="w-full py-3 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#ef4444' }}
          >
            <PhoneOff size={16} />
            {callState === 'connecting' ? 'Connecting...' : 'Hang Up'}
          </button>
        )}

        {/* Log outcome phase — follow-up email + log button */}
        {(phase === 'log-outcome' || (phase === 'ready' && !lead.phone)) && (
          <>
            {outcome && lead.email && !emailSent && (
              <button
                onClick={handleSendFollowUp}
                disabled={emailSending}
                className="w-full py-2 text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${selectedOutcome?.color || 'var(--border)'}`,
                  color: selectedOutcome?.color || 'var(--text-primary)',
                }}
              >
                <Mail size={14} />
                {emailSending ? 'Sending...' : 'Send Follow-up Email'}
              </button>
            )}
            {emailSent && (
              <p className="text-xs text-center" style={{ color: '#22c55e' }}>Follow-up email sent</p>
            )}
            <button
              onClick={handleLog}
              disabled={submitting || !outcome}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              {submitting ? 'Logging...' : 'Log and Next'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// CallQueue — the main queue list
// ───────────────────────────────────────────────────────────
interface CallQueueProps {
  isVa?: boolean;
}

export function CallQueue({ isVa: _isVa }: CallQueueProps) {
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cold-calling/queue');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const activeLead = leads.find(l => l.id === activeLeadId) || null;

  const handleLogged = useCallback(() => {
    if (activeLeadId) {
      setCompletedIds(prev => new Set([...prev, activeLeadId]));
      const currentIdx = leads.findIndex(l => l.id === activeLeadId);
      const nextLead = leads.slice(currentIdx + 1).find(l => !completedIds.has(l.id));
      setActiveLeadId(nextLead?.id || null);
      setTimeout(fetchQueue, 800);
    }
  }, [activeLeadId, leads, completedIds, fetchQueue]);

  const visibleLeads = leads.filter(l => !completedIds.has(l.id));
  const callbackLeads = visibleLeads.filter(l => l.isCallback);
  const freshLeads = visibleLeads.filter(l => !l.isCallback);

  const renderLeadRow = (lead: QueueLead, idx: number) => (
    <button
      key={lead.id}
      onClick={() => setActiveLeadId(lead.id)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity"
      style={{ background: activeLeadId === lead.id ? 'var(--surface-hover)' : 'transparent' }}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: lead.isCallback ? '#f59e0b' : 'var(--brand-blue)', color: '#fff' }}
      >
        {lead.isCallback ? '↩' : idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{lead.companyName}</p>
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {lead.contactName}
          {lead.phone ? ` · ${lead.phone}` : ' · No phone'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {lead.isCallback ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#d97706' }}>
            {lead.callbackDate
              ? new Date(lead.callbackDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Callback'}
          </span>
        ) : lead.lastCalledAt ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#22c55e18', color: '#16a34a' }}>
            called {daysAgo(lead.lastCalledAt)}
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
            not called
          </span>
        )}
        <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
      </div>
    </button>
  );

  return (
    <>
      <div className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Call Queue</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {loading ? 'Loading...' : `${freshLeads.length} to call${callbackLeads.length > 0 ? ` · ${callbackLeads.length} callback${callbackLeads.length !== 1 ? 's' : ''}` : ''}`}
            </p>
          </div>
          <button onClick={fetchQueue} aria-label="Refresh call queue" className="p-1.5 rounded hover:opacity-70">
            <RefreshCw size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--surface-hover)' }} />
            ))}
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Queue is empty. Import leads or add new leads to get started.
            </p>
          </div>
        ) : (
          <div>
            {/* Callbacks section */}
            {callbackLeads.length > 0 && (
              <>
                <div className="px-4 py-1.5" style={{ background: '#f59e0b10', borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#d97706' }}>
                    Callbacks ({callbackLeads.length})
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {callbackLeads.map((lead) => renderLeadRow(lead, 0))}
                </div>
                {freshLeads.length > 0 && (
                  <div className="px-4 py-1.5" style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Call Queue ({freshLeads.length})
                    </p>
                  </div>
                )}
              </>
            )}
            {/* Main queue */}
            {freshLeads.length > 0 && (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {freshLeads.map((lead, idx) => renderLeadRow(lead, idx))}
              </div>
            )}
          </div>
        )}
      </div>

      {activeLead && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setActiveLeadId(null)}
          />
          <CallDialer
            lead={activeLead}
            onClose={() => setActiveLeadId(null)}
            onLogged={handleLogged}
          />
        </>
      )}
    </>
  );
}
