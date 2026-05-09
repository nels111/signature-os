'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/leads', label: 'Leads', icon: '🎯' },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: '📈' },
  { href: '/dashboard/deals', label: 'Deals', icon: '🤝' },
  { href: '/dashboard/contacts', label: 'Contacts', icon: '👤' },
  { href: '/dashboard/accounts', label: 'Accounts', icon: '🏢' },
  { href: '/dashboard/tasks', label: 'Tasks', icon: '✅' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: '📅' },
  { href: '/dashboard/emails', label: 'Email', icon: '✉️' },
  { href: '/dashboard/quotes', label: 'Quotes', icon: '💷' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-screen bg-white border-r flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
      style={{ borderColor: '#e2e8f0' }}
    >
      <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#e2e8f0' }}>
        {!collapsed && (
          <span className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>
            Signature Cleans
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-sm"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-white font-medium'
                  : 'hover:bg-gray-50'
              }`}
              style={
                isActive
                  ? { backgroundColor: '#2c5f2d', color: '#ffffff' }
                  : { color: '#64748b' }
              }
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t text-xs" style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
        {!collapsed && 'Signature Cleans OS v1.0'}
      </div>
    </aside>
  );
}
