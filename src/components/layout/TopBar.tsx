'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, BellRing, BellOff, LogOut, ChevronDown, Clock, Timer, Menu } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useLayout } from './LayoutContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function useClockStatus(isVa: boolean) {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockedInAt, setClockedInAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!isVa) return;
    try {
      const res = await fetch('/api/time-tracking/status');
      const data = await res.json();
      setIsClockedIn(data.isClockedIn);
      setClockedInAt(data.clockedInAt || null);
    } catch { /* ignore */ }
  }, [isVa]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!isClockedIn || !clockedInAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 10000); // update every 10s
    return () => clearInterval(id);
  }, [isClockedIn, clockedInAt]);

  const toggle = async () => {
    setLoading(true);
    try {
      const endpoint = isClockedIn ? '/api/time-tracking/clock-out' : '/api/time-tracking/clock-in';
      await fetch(endpoint, { method: 'POST' });
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const fmtElapsed = () => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return { isClockedIn, elapsed, loading, toggle, fmtElapsed };
}

export function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toggleSidebar } = useLayout();
  const { state: pushState, enable: enablePush, disable: disablePush } = usePushNotifications();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const isVa = session?.user?.role === 'va';
  const clock = useClockStatus(isVa);
  const queryClient = useQueryClient();

  // Notifications — TanStack Query replaces manual setInterval + useState
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?limit=10');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json() as Promise<{ notifications: Notification[]; unreadCount: number }>;
    },
    refetchInterval: 30_000,   // poll every 30 s — matches previous setInterval
    refetchOnWindowFocus: true,
  });

  const notifications = notifData?.notifications ?? [];
  const unreadCount  = notifData?.unreadCount  ?? 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notif-dropdown') && !target.closest('.user-dropdown')) {
        setShowNotifs(false);
        setShowMenu(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    // Invalidate so TanStack Query re-fetches fresh data
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNotifClick = (notif: Notification) => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    }).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));

    if (notif.entityType && notif.entityId) {
      const routes: Record<string, string> = {
        task: '/dashboard/tasks',
        lead: '/dashboard/leads',
        deal: '/dashboard/deals',
        contact: '/dashboard/contacts',
        quote: '/dashboard/quotes',
      };
      const base = routes[notif.entityType];
      if (base) {
        router.push(`${base}/${notif.entityId}`);
      }
    }

    setShowNotifs(false);
  };

  return (
    <header
      className="flex flex-col justify-end shrink-0 px-4 sm:px-6"
      style={{
        background: 'color-mix(in srgb, var(--surface) 72%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
    <div className="h-14 flex items-center justify-between w-full">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={toggleSidebar}
          className="p-2 rounded-lg lg:hidden"
          style={{
            color: 'var(--text-secondary)',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
          style={{
            background: searchFocused ? 'var(--surface)' : 'var(--background)',
            border: searchFocused ? '1px solid var(--brand-blue)' : '1px solid var(--border)',
            boxShadow: searchFocused ? '0 0 0 3px color-mix(in srgb, var(--brand-blue) 10%, transparent)' : 'none',
            width: searchFocused ? '320px' : '240px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            className="text-sm w-full focus:outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {!searchFocused && (
            <kbd
              className="text-[10px] font-medium px-1.5 py-0.5 rounded hidden md:inline-block"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              ⌘K
            </kbd>
          )}
        </div>

      </div>

      <div className="flex items-center gap-1">
        {/* VA clock in/out pill */}
        {isVa && (
          <button
            onClick={clock.toggle}
            disabled={clock.loading}
            className="flex min-h-11 sm:min-h-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold mr-2 transition-all duration-150"
            style={clock.isClockedIn ? {
              background: 'var(--status-success-bg)',
              color: 'var(--status-success)',
              border: '1px solid color-mix(in srgb, var(--status-success) 25%, transparent)',
            } : {
              background: 'var(--brand-blue-subtle)',
              color: 'var(--brand-blue)',
              border: '1px solid var(--brand-blue-subtle)',
            }}
          >
            {clock.isClockedIn ? (
              <>
                <Timer size={13} />
                <span className="hidden sm:inline">{clock.fmtElapsed()} · </span>
                <span>Clock Out</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Clock In</span>
              </>
            )}
          </button>
        )}
        {/* Notification bell */}
        <div className="relative notif-dropdown">
          <button
            type="button"
            aria-label="Notifications"
            onClick={(e) => { e.stopPropagation(); setShowNotifs(!showNotifs); setShowMenu(false); }}
            className="relative p-2 rounded-lg transition-all duration-150"
            style={{
              color: 'var(--text-secondary)',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[16px] h-4 text-[10px] rounded-full flex items-center justify-center px-1 font-semibold"
                style={{ backgroundColor: 'var(--status-danger)', color: 'var(--surface)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="fixed sm:absolute right-2 sm:right-0 top-[calc(56px+env(safe-area-inset-top))] sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-[360px] rounded-xl z-50 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-modal)',
                maxHeight: 'calc(70svh - env(safe-area-inset-top))',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium"
                    style={{ color: 'var(--brand-blue)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: n.read ? 'transparent' : 'var(--brand-blue-subtle)',
                      }}
                    >
                      {!n.read && (
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'var(--brand-blue)' }}
                        />
                      )}
                      <div className={n.read ? 'ml-5' : ''}>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {n.title}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {n.message}
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 mx-1 sm:mx-2 hidden sm:block" style={{ background: 'var(--border)' }} />

        {/* User menu */}
        <div className="relative user-dropdown">
          <button
            type="button"
            aria-label="User menu"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowNotifs(false); }}
            className="flex items-center gap-1.5 sm:gap-2 text-sm rounded-lg px-1.5 sm:px-2 py-1.5 transition-all duration-150"
            style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand-blue)', color: 'var(--surface)' }}
            >
              {(session?.user?.name?.charAt(0) ?? 'U').toUpperCase()}
            </div>
            <span
              className="text-sm font-medium hidden sm:inline"
              style={{ color: 'var(--text-primary)' }}
            >
              {session?.user?.name?.split(' ')[0]}
            </span>
            <ChevronDown size={14} className="hidden sm:block" style={{ color: 'var(--text-muted)' }} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl py-1 z-50 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {session?.user?.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {session?.user?.email}
                </div>
                <div
                  className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                  style={{
                    background: 'var(--brand-blue-subtle)',
                    color: 'var(--brand-blue)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {session?.user?.role}
                </div>
              </div>
              {/* Push notification toggle */}
              {pushState !== 'unsupported' && (
                <button
                  onClick={pushState === 'granted' ? disablePush : enablePush}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                  style={{ color: pushState === 'denied' ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  disabled={pushState === 'denied' || pushState === 'loading'}
                >
                  {pushState === 'granted' ? (
                    <BellRing size={14} style={{ color: 'var(--brand-blue)' }} />
                  ) : pushState === 'denied' ? (
                    <BellOff size={14} style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <Bell size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  {pushState === 'granted' ? 'Push notifications on' :
                   pushState === 'denied' ? 'Notifications blocked' :
                   'Enable push notifications'}
                </button>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <LogOut size={14} style={{ color: 'var(--text-muted)' }} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </header>
  );
}
