'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  TrendingUp,
  Handshake,
  Building2,
  Users,
  UserPlus,
  CheckSquare,
  Calendar,
  Mail,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  X,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useLayout } from './LayoutContext';

const ALL_NAV_ITEMS = [
  // Overview
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview', roles: null },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare, section: 'overview', roles: null },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, section: 'overview', roles: ['admin', 'sales', 'operations', 'viewer'] },
  { href: '/dashboard/emails', label: 'Email', icon: Mail, section: 'overview', roles: ['admin', 'sales', 'operations', 'viewer'] },
  // CRM
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: TrendingUp, section: 'crm', roles: null },
  { href: '/dashboard/deals', label: 'Deals', icon: Handshake, section: 'crm', roles: null },
  { href: '/dashboard/accounts', label: 'Accounts', icon: Building2, section: 'crm', roles: null },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, section: 'crm', roles: null },
  { href: '/dashboard/leads', label: 'Leads', icon: UserPlus, section: 'crm', roles: null },
  // Business Hub
  { href: '/dashboard/hub', label: 'Business Hub', icon: LayoutGrid, section: 'hub', roles: null },
  // System
  { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon, section: 'system', roles: ['admin'] },
];

// VA role: dashboard + leads + tasks + hub (cold calling accessible from hub)
const VA_ALLOWED = ['/dashboard', '/dashboard/leads', '/dashboard/tasks', '/dashboard/hub'];

const sections = [
  { key: 'overview', label: 'Overview' },
  { key: 'crm', label: 'CRM' },
  { key: 'hub', label: 'Business Hub' },
  { key: 'system', label: null },
];

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { closeSidebar } = useLayout();
  const { data: session } = useSession();
  const userRole = session?.user?.role as string | undefined;

  const navItems = userRole === 'va'
    ? ALL_NAV_ITEMS.filter((item) => VA_ALLOWED.includes(item.href))
    : ALL_NAV_ITEMS.filter((item) => item.roles === null || item.roles.includes(userRole ?? ''));

  // On mobile, never collapse, always full width
  const isCollapsed = mobile ? false : collapsed;
  const width = mobile ? 'w-[280px]' : (isCollapsed ? 'w-[68px]' : 'w-[240px]');

  const handleNavClick = () => {
    if (mobile) closeSidebar();
  };

  // Hub page active: treat any /dashboard/hub/* as hub active
  const isHubActive = (href: string) =>
    href === '/dashboard/hub'
      ? pathname === '/dashboard/hub' || pathname.startsWith('/dashboard/hub/')
      : href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={`h-screen flex flex-col transition-all duration-300 ${width}`}
      style={{
        background: 'var(--sidebar-bg)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: isCollapsed ? '20px 16px' : '20px 20px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo-badge.jpg"
            alt="Signature Cleans"
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
            style={{ opacity: 0.95 }}
          />
          {!isCollapsed && (
            <span
              className="font-semibold text-[15px]"
              style={{ color: 'var(--sidebar-text)', letterSpacing: '-0.01em' }}
            >
              Signature Cleans
            </span>
          )}
        </div>
        {mobile && (
          <button
            onClick={closeSidebar}
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll">
        {sections.map((section) => {
          const sectionItems = navItems.filter((item) => item.section === section.key);
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.key} className="mb-1">
              {!isCollapsed && section.label && (
                <div
                  className="px-5 pt-5 pb-1.5"
                  style={{
                    color: 'var(--sidebar-text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </div>
              )}
              {isCollapsed && section.key !== 'overview' && (
                <div
                  className="mx-4 my-2"
                  style={{
                    height: '1px',
                    background: 'var(--sidebar-border)',
                  }}
                />
              )}
              {sectionItems.map((item) => {
                const Icon = item.icon;
                const isActive = isHubActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 transition-all duration-150 mx-2 rounded-lg ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                    }`}
                    style={{
                      background: isActive ? 'var(--sidebar-active)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--sidebar-text-muted)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '14px',
                      borderLeft: isActive && !isCollapsed ? '3px solid var(--brand-green-accent)' : '3px solid transparent',
                      paddingLeft: isCollapsed ? undefined : '10px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                        e.currentTarget.style.color = 'var(--sidebar-text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--sidebar-text-muted)';
                      }
                    }}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} style={isActive ? { color: 'var(--brand-green-accent)' } : undefined} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle - desktop only */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center p-2 mx-3 mb-2 rounded-lg transition-all duration-150"
          style={{ color: 'var(--sidebar-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text-muted)';
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}

      {/* Version */}
      <div
        className="px-5 py-3"
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          color: 'var(--sidebar-text-muted)',
          fontSize: '11px',
        }}
      >
        {!isCollapsed && 'Signature Cleans OS v1.0'}
      </div>
    </aside>
  );
}
