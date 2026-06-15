'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Phone,
  Clock,
  UserCheck,
  BarChart2,
  Target,
  Activity,
  GraduationCap,
  Package,
  ArrowUpRight,
  Layers,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';

interface App {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  status: 'live' | 'soon';
  roles: string[] | null;
}

const APPS: App[] = [
  {
    id: 'quotes',
    name: 'Quote Generator',
    description: 'Build and send client quotes with automated pricing.',
    href: '/dashboard/quotes/list',
    icon: FileText,
    accentColor: '#2563eb',
    accentBg: 'rgba(37,99,235,0.08)',
    status: 'live',
    roles: ['admin', 'sales', 'operations', 'viewer'],
  },
  {
    id: 'cold-calling',
    name: 'Cold Calling',
    description: 'Log outbound calls and track prospect outcomes.',
    href: '/dashboard/cold-calling',
    icon: Phone,
    accentColor: '#ea580c',
    accentBg: 'rgba(234,88,12,0.08)',
    status: 'live',
    roles: null,
  },
  {
    id: 'va-hours',
    name: 'VA Hours',
    description: 'Monitor virtual assistant hours and utilisation.',
    href: '/dashboard/va-hours',
    icon: Clock,
    accentColor: '#7c3aed',
    accentBg: 'rgba(124,58,237,0.08)',
    status: 'live',
    roles: ['admin'],
  },
  {
    id: 'operatives',
    name: 'Operatives',
    description: 'Manage cleaning operatives and compliance records.',
    href: '/dashboard/operatives',
    icon: UserCheck,
    accentColor: '#7DB227',
    accentBg: 'rgba(125,178,39,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'clients',
    name: 'Clients',
    description: 'Client accounts, site audits, tickets, and portal access.',
    href: '/dashboard/clients',
    icon: Briefcase,
    accentColor: '#0ea5e9',
    accentBg: 'rgba(14,165,233,0.08)',
    status: 'live',
    roles: ['admin', 'sales', 'operations'],
  },
  {
    id: 'audits',
    name: 'Audits',
    description: 'Run site audits, score cleans, and publish to clients.',
    href: '/dashboard/audits',
    icon: ClipboardCheck,
    accentColor: '#2056A4',
    accentBg: 'rgba(32,86,164,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'financials',
    name: 'Financials',
    description: 'Revenue, margins, and contract-level P&L.',
    href: '/dashboard/financials',
    icon: BarChart2,
    accentColor: '#059669',
    accentBg: 'rgba(5,150,105,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Track progress toward 1,000 hours and business KPIs.',
    href: '/dashboard/growth',
    icon: Target,
    accentColor: '#d97706',
    accentBg: 'rgba(217,119,6,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'health',
    name: 'Contract Health',
    description: 'Audit scores, compliance, and operational risk.',
    href: '/dashboard/health',
    icon: Activity,
    accentColor: '#e11d48',
    accentBg: 'rgba(225,29,72,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'onboarding',
    name: 'Onboarding Platform',
    description: 'Admin view: who is in onboarding, progress, and documents.',
    href: 'https://onboarding.signature-cleans.co.uk/admin',
    icon: GraduationCap,
    accentColor: '#0ea5e9',
    accentBg: 'rgba(14,165,233,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
  {
    id: 'stock',
    name: 'Stock & Supplies',
    description: 'Admin view: supply requests and stock across all sites.',
    href: 'https://stock-request-omega.vercel.app/admin',
    icon: Package,
    accentColor: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.08)',
    status: 'live',
    roles: ['admin', 'operations'],
  },
];

export default function HubPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as string | undefined;

  const apps = APPS.filter(
    (app) => app.roles === null || (userRole && app.roles.includes(userRole))
  );

  const liveCount = apps.filter((a) => a.status === 'live').length;
  const soonCount = apps.filter((a) => a.status === 'soon').length;

  return (
    <>
      <style>{`
        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .hub-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.07);
          border-radius: 14px;
          padding: 20px 22px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02);
          transition:
            transform 160ms var(--ease-expo),
            box-shadow 160ms var(--ease-expo),
            border-color 160ms ease;
          animation: cardIn 350ms var(--ease-expo) both;
        }

        @media (hover: hover) and (pointer: fine) {
          .hub-card-live:hover {
            transform: translateY(-2px);
            box-shadow:
              0 4px 12px rgba(0,0,0,0.07),
              0 8px 24px rgba(0,0,0,0.05);
            border-color: rgba(0,0,0,0.12);
          }

          .hub-card-live:hover .hub-icon {
            transform: scale(1.06);
          }

          .hub-card-live:hover .hub-arrow {
            opacity: 1;
            transform: translate(2px, -2px);
          }
        }

        .hub-card-live:active {
          transform: scale(0.97);
          transition-duration: 100ms;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .hub-card-soon {
          opacity: 0.5;
          cursor: default;
          pointer-events: none;
        }

        .hub-icon {
          transition: transform 160ms var(--ease-expo);
        }

        .hub-arrow {
          opacity: 0;
          transition:
            opacity 160ms ease,
            transform 160ms var(--ease-expo);
        }

        @media (prefers-reduced-motion: reduce) {
          .hub-card {
            animation: none;
            transition: none;
          }
          .hub-icon,
          .hub-arrow {
            transition: none;
          }
        }

        .hub-grid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 639px) {
          .hub-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <div
        style={{
          height: '100%',
          background: '#f5f5f3',
          padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 24px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(125,178,39,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={16} color="#5a8f1c" strokeWidth={2} />
            </div>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#111',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Business Hub
            </h1>
          </div>
          <p style={{ color: '#8c8c8c', fontSize: '13px', margin: 0, paddingLeft: '42px' }}>
            {liveCount} apps live{soonCount > 0 ? ` · ${soonCount} coming soon` : ''}
          </p>
        </div>

        {/* Grid */}
        <div className="hub-grid">
          {apps.map((app, i) => (
            <AppCard key={app.id} app={app} index={i} />
          ))}
        </div>
      </div>
    </>
  );
}

function AppCard({ app, index }: { app: App; index: number }) {
  const Icon = app.icon;
  const isSoon = app.status === 'soon';

  const card = (
    <div
      className={`hub-card ${isSoon ? 'hub-card-soon' : 'hub-card-live'}`}
      style={{ animationDelay: `${index * 35}ms` }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div
          className="hub-icon"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: app.accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={17} color={app.accentColor} strokeWidth={1.75} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isSoon ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: '#aaa',
                letterSpacing: '0.01em',
              }}
            >
              Soon
            </span>
          ) : (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#16a34a',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#16a34a',
                    display: 'inline-block',
                  }}
                />
                Live
              </span>
              <ArrowUpRight
                size={13}
                color="#c4c4c4"
                className="hub-arrow"
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#111',
            marginBottom: '3px',
            letterSpacing: '-0.01em',
          }}
        >
          {app.name}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#999',
            lineHeight: 1.5,
          }}
        >
          {app.description}
        </div>
      </div>
    </div>
  );

  if (isSoon) return card;

  // External admin apps (hosted separately) open in a new tab.
  const isExternal = app.href.startsWith('http');
  if (isExternal) {
    return (
      <a href={app.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {card}
      </a>
    );
  }

  return (
    <Link href={app.href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      {card}
    </Link>
  );
}
