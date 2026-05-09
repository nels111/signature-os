'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

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

export function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotifClick = (notif: Notification) => {
    // Mark individual as read
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    });

    // Navigate to entity if linked
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
    fetchNotifications();
  };

  return (
    <header
      className="h-14 bg-white border-b flex items-center justify-between px-6"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search..."
          className="px-3 py-1.5 text-sm border rounded-md w-64 focus:outline-none focus:ring-2"
          style={{ borderColor: '#e2e8f0' }}
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowMenu(false); }}
            className="relative p-1.5 rounded-md hover:bg-gray-100"
          >
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs text-white rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#dc2626', fontSize: '10px' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-md shadow-lg z-50"
              style={{ borderColor: '#e2e8f0' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#e2e8f0' }}>
                <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs" style={{ color: '#2c5f2d' }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm" style={{ color: '#64748b' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full text-left px-3 py-2 border-b hover:bg-gray-50 flex items-start gap-2"
                      style={{ borderColor: '#f1f5f9', backgroundColor: n.read ? 'transparent' : '#f0fdf4' }}
                    >
                      {!n.read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#2c5f2d' }} />
                      )}
                      <div className={n.read ? 'ml-4' : ''}>
                        <div className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{n.title}</div>
                        <div className="text-xs" style={{ color: '#64748b' }}>{n.message}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{timeAgo(n.createdAt)}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowMenu(!showMenu); setShowNotifs(false); }}
            className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-md px-2 py-1"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: '#2c5f2d' }}
            >
              {session?.user?.name?.charAt(0) || '?'}
            </div>
            {session?.user?.name && (
              <span style={{ color: '#1a1a1a' }}>{session.user.name}</span>
            )}
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-md shadow-lg py-1 z-50"
              style={{ borderColor: '#e2e8f0' }}
            >
              <div className="px-3 py-2 text-xs border-b" style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                {session?.user?.email}
                <br />
                <span className="capitalize">{session?.user?.role}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                style={{ color: '#1a1a1a' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
