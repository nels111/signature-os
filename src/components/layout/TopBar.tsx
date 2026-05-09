'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export function TopBar() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

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
        <button className="relative p-1.5 rounded-md hover:bg-gray-100">
          <span className="text-lg">🔔</span>
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs text-white rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f9a825', fontSize: '10px' }}
          >
            0
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
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
