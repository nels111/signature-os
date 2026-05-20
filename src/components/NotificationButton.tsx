'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationButton() {
  const { state, enable, disable } = usePushNotifications();

  if (state === 'unsupported' || state === 'loading') return null;

  if (state === 'granted') {
    return (
      <button
        onClick={disable}
        title="Notifications enabled — tap to disable"
        className="p-2 rounded-lg transition-all"
        style={{ color: 'var(--brand-blue)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <BellRing size={18} />
      </button>
    );
  }

  if (state === 'denied') {
    return (
      <button
        title="Notifications blocked — enable in browser settings"
        className="p-2 rounded-lg opacity-40 cursor-not-allowed"
        style={{ color: 'var(--text-secondary)' }}
        disabled
      >
        <BellOff size={18} />
      </button>
    );
  }

  // default — not yet enabled
  return (
    <button
      onClick={enable}
      title="Enable push notifications"
      className="p-2 rounded-lg transition-all"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      <Bell size={18} />
    </button>
  );
}
