'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useTwilioDevice } from '@/hooks/useTwilioDevice';
import type { ColdCallingLead, DiallerState } from '@/lib/cold-calling/types';

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Props {
  lead: ColdCallingLead | null;
  state: DiallerState;
  durationSeconds: number;
  attemptId: string | null;
  onStartCall: () => void;
  onHangUp: () => void;
  onCallStateChange: (state: 'ringing' | 'in_call' | 'ended', callSid?: string) => void;
}

export function BrowserDiallerPanel({
  lead,
  state,
  durationSeconds,
  attemptId,
  onStartCall,
  onHangUp,
  onCallStateChange,
}: Props) {
  const {
    callState,
    callSid,
    isMuted,
    error: deviceError,
    startCall,
    hangUp,
    toggleMute,
  } = useTwilioDevice();

  const [callingPhone, setCallingPhone] = useState<string | null>(null);

  // Bridge Twilio device state to parent state machine
  useEffect(() => {
    if (callState === 'ringing') onCallStateChange('ringing');
    if (callState === 'in-call') onCallStateChange('in_call', callSid || undefined);
    if (callState === 'ending') onCallStateChange('ended');
  }, [callState, callSid, onCallStateChange]);

  const handleDial = useCallback(async () => {
    if (!lead?.phone) return;
    setCallingPhone(lead.phone);
    onStartCall();
    await startCall(lead.phone);
  }, [lead, onStartCall, startCall]);

  const handleHangUp = useCallback(() => {
    hangUp();
    onHangUp();
  }, [hangUp, onHangUp]);

  const isDialling = state === 'dialling' || state === 'ringing';
  const isInCall = state === 'in_call';
  const isActiveCall = isDialling || isInCall;
  const isEnded = state === 'ended';
  const isSaving = state === 'saving_outcome';

  // Script opener box
  const script = (
    <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Script opener</p>
      <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>
        &ldquo;Oh hi, it&apos;s Jasmine from Signature Cleans. How are you?&rdquo;
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>— wait for reply —</p>
      <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>
        &ldquo;I was just ringing to see who looks after your cleaning over there?&rdquo;
      </p>
    </div>
  );

  if (!lead) return null;

  if (isEnded || isSaving) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: '#22c55e12', border: '1px solid #22c55e25' }}>
          <PhoneOff size={15} style={{ color: '#16a34a' }} />
          <p className="text-sm font-medium" style={{ color: '#16a34a' }}>
            Call ended{durationSeconds > 0 ? ` · ${formatDuration(durationSeconds)}` : ''} · Select an outcome
          </p>
        </div>
      </div>
    );
  }

  if (isActiveCall) {
    const statusColor = callState === 'in-call' ? '#22c55e' : '#f59e0b';
    const statusLabel = callState === 'ringing' ? 'Ringing...' : callState === 'connecting' ? 'Connecting...' : 'On call';
    return (
      <div className="py-4 space-y-4">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `${statusColor}15`, border: `2px solid ${statusColor}` }}>
            {callState === 'connecting' || callState === 'ringing'
              ? <Loader2 size={24} className="animate-spin" style={{ color: statusColor }} />
              : <Phone size={24} style={{ color: statusColor }} />}
          </div>
          <p className="text-sm font-semibold" style={{ color: statusColor }}>{statusLabel}</p>
          {isInCall && (
            <p className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{formatDuration(durationSeconds)}</p>
          )}
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Calling {callingPhone} · Recording active</p>
        </div>

        <div className="flex items-center justify-center gap-4">
          {isInCall && (
            <button
              onClick={toggleMute}
              className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all"
              style={{
                background: isMuted ? '#ef444415' : 'var(--surface)',
                border: `1px solid ${isMuted ? '#ef4444' : 'var(--border)'}`,
                color: isMuted ? '#ef4444' : 'var(--text-secondary)',
              }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}
          <button
            onClick={handleHangUp}
            className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all"
            style={{ background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444' }}
          >
            <PhoneOff size={18} />
            <span className="text-xs">Hang up</span>
          </button>
        </div>
        {deviceError && <p className="text-xs text-center" style={{ color: '#ef4444' }}>{deviceError}</p>}
      </div>
    );
  }

  // Ready state
  return (
    <div className="py-4 space-y-4">
      {script}
      {deviceError && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#ef444412', color: '#ef4444' }}>{deviceError}</p>
      )}
      {lead.phone ? (
        <button
          onClick={handleDial}
          className="w-full py-3 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#22c55e' }}
        >
          <Phone size={16} />
          Call {lead.phone}
        </button>
      ) : (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#f59e0b12', border: '1px solid #f59e0b30', color: '#b45309' }}>
          No phone number — log the outcome manually using the panel on the right.
        </div>
      )}
    </div>
  );
}
