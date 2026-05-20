'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ending' | 'error';

export interface TwilioDeviceState {
  callState: CallState;
  callSid: string | null;
  callDuration: number; // seconds
  isMuted: boolean;
  error: string | null;
  startCall: (phoneNumber: string) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
}

// Lazy type imports — actual import happens inside ensureDevice (browser only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwilioDevice = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwilioCall = any;

export function useTwilioDevice(): TwilioDeviceState {
  const deviceRef = useRef<TwilioDevice | null>(null);
  const callRef = useRef<TwilioCall | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [callSid, setCallSid] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureDevice = useCallback(async (): Promise<TwilioDevice> => {
    if (deviceRef.current && deviceRef.current.state !== 'destroyed') {
      return deviceRef.current;
    }

    // Dynamic import — browser only, avoids SSR
    const { Device } = await import('@twilio/voice-sdk');

    const res = await fetch('/api/twilio/token');
    if (!res.ok) throw new Error('Failed to get calling token');
    const { token } = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = new Device(token, { logLevel: 1, codecPreferences: ['opus', 'pcmu'] as any[] });

    device.on('error', (err: Error) => {
      console.error('Twilio Device error:', err);
      setError(err.message || 'Device error');
      setCallState('error');
    });

    device.on('tokenWillExpire', async () => {
      try {
        const r = await fetch('/api/twilio/token');
        if (r.ok) {
          const { token: newToken } = await r.json();
          device.updateToken(newToken);
        }
      } catch {
        console.warn('Failed to refresh calling token');
      }
    });

    await device.register();
    deviceRef.current = device;
    return device;
  }, []);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCall = useCallback(async (phoneNumber: string) => {
    try {
      setError(null);
      setCallState('connecting');
      setCallDuration(0);
      setIsMuted(false);
      setCallSid(null);

      const device = await ensureDevice();

      const call = await device.connect({ params: { To: phoneNumber } });
      callRef.current = call;

      call.on('ringing', () => setCallState('ringing'));

      call.on('accept', (c: TwilioCall) => {
        const sid = c.parameters?.CallSid || null;
        setCallSid(sid);
        setCallState('in-call');
        startTimer();
      });

      call.on('disconnect', () => {
        setCallState('ending');
        stopTimer();
        callRef.current = null;
      });

      call.on('cancel', () => {
        setCallState('idle');
        stopTimer();
        setCallSid(null);
        callRef.current = null;
      });

      call.on('error', (err: Error) => {
        console.error('Call error:', err);
        setError(err.message || 'Call failed');
        setCallState('error');
        stopTimer();
        callRef.current = null;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      setError(msg);
      setCallState('error');
    }
  }, [ensureDevice, startTimer, stopTimer]);

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const next = !isMuted;
      callRef.current.mute(next);
      setIsMuted(next);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (callRef.current) {
        try { callRef.current.disconnect(); } catch { /* ignore */ }
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  }, [stopTimer]);

  return {
    callState,
    callSid,
    callDuration,
    isMuted,
    error,
    startCall,
    hangUp,
    toggleMute,
  };
}
