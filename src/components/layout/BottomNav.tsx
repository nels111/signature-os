'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LayoutGrid,
  TrendingUp,
  CheckSquare,
  MoreHorizontal,
} from 'lucide-react';
import { useLayout } from './LayoutContext';

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home', exact: true },
  { href: '/dashboard/hub', icon: LayoutGrid, label: 'Hub', exact: false },
  { href: '/dashboard/pipeline', icon: TrendingUp, label: 'Pipeline', exact: false },
  { href: '/dashboard/tasks', icon: CheckSquare, label: 'Tasks', exact: false },
];

export function BottomNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useLayout();

  return (
    <nav
      className="lg:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '10px 4px',
              color: isActive ? 'var(--brand-green-accent)' : 'var(--sidebar-text-muted)',
              textDecoration: 'none',
              transition: 'color 120ms ease',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: '0.01em' }}>
              {tab.label}
            </span>
          </Link>
        );
      })}

      {/* More — opens the full sidebar */}
      <button
        onClick={toggleSidebar}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '10px 4px',
          color: 'var(--sidebar-text-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={22} strokeWidth={1.5} />
        <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.01em' }}>More</span>
      </button>
    </nav>
  );
}
