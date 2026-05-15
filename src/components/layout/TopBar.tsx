'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useLayout } from './LayoutContext';

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
  const { toggleSidebar } = useLayout();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

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
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotifClick = (notif: Notification) => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    });

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
      className="h-14 flex items-center justify-between px-4 sm:px-6"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger - mobile only */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg lg:hidden transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
          style={{
            background: searchFocused ? 'var(--surface)' : 'var(--background)',
            border: searchFocused ? '1px solid var(--brand-blue)' : '1px solid var(--border)',
            boxShadow: searchFocused ? '0 0 0 3px rgba(32, 86, 164, 0.1)' : 'none',
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

        {/* Mobile search icon */}
        <button
          className="p-2 rounded-lg sm:hidden"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Search size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <div className="relative notif-dropdown">
          <button
            onClick={(e) => { e.stopPropagation(); setShowNotifs(!showNotifs); setShowMenu(false); }}
            className="relative p-2 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[16px] h-4 text-[10px] text-white rounded-full flex items-center justify-center px-1 font-semibold"
                style={{ backgroundColor: 'var(--status-danger)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-[360px] rounded-xl z-50 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-modal)',
                maxHeight: '70vh',
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
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowNotifs(false); }}
            className="flex items-center gap-1.5 sm:gap-2 text-sm rounded-lg px-1.5 sm:px-2 py-1.5 transition-all duration-150"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              {session?.user?.name?.charAt(0) || '?'}
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
    </header>
  );
}
